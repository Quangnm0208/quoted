/**
 * customer-portal/customer-portal.controller.js
 *
 * Customer-facing dashboard endpoints. Mounted at /api/customer/*.
 *
 * Auth model: license key is the bearer credential. Customer pastes their
 * license key into the frontend; client sends it as `Authorization: License <key>`.
 * Server hashes the key + looks up `customer_licenses.license_key_hash` →
 * resolves customer + subscription + sites.
 *
 * No password, no signup, no session. The license key the customer received
 * after checkout IS their identity for read-only self-service. Same key the
 * plugin uses to activate; here it just queries the customer's own data.
 *
 * Why bearer-with-license instead of session/password:
 *   - 1-2 min onboarding goal (master prompt §7): no password to set up.
 *   - Customer already has the key (email from LS).
 *   - Read-only surface — no destructive operations.
 *   - Per-license rate limit (60/min via rateLimiterIp) caps brute force.
 *
 * Sensitive data NOT exposed in this surface (operator-only):
 *   - other customers' data
 *   - raw license key (we return masked short prefix only)
 *   - revenue aggregates
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { asyncHandler } from '../../../../core/lib/asyncHandler.js';
import { tryAcquire } from '../../../../core/lib/rateLimiterIp.js';
import db from '../../../../core/db/connection.js';

export const customerRouter = Router();

// Per-IP rate limit for the dashboard (60/min) — relaxed because
// authenticated customers will poll their own data, but enough to
// stop brute-force key scanning. Production-only; dev exempts 127.0.0.1
// via the rate-limiter's built-in localhost exemption.
function dashboardRateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  if (!tryAcquire('cust:' + ip, 60)) {
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } });
  }
  next();
}

// License-key auth — header `Authorization: License <key>`
function hashLicenseKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function requireLicenseAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  let key = null;
  if (header.startsWith('License ')) {
    key = header.slice(8).trim();
  } else if (header.startsWith('Bearer ')) {
    // Tolerate Bearer for clients that auto-set it; still treat as license key
    key = header.slice(7).trim();
  }
  if (!key || key.length < 8 || key.length > 128) {
    return res.status(401).json({
      error: { code: 'LICENSE_REQUIRED', message: 'Authorization: License <your_license_key> required' },
    });
  }
  const hash = hashLicenseKey(key);
  const lic = db.prepare(`
    SELECT l.id AS license_id, l.customer_id, l.subscription_id, l.license_key_short,
           l.status AS license_status, l.activation_limit, l.instances_count, l.expires_at,
           c.id AS cust_id, c.email AS customer_email, c.name AS customer_name
    FROM customer_licenses l
    LEFT JOIN customers c ON c.id = l.customer_id
    WHERE l.license_key_hash = ?
  `).get(hash);
  if (!lic) {
    return res.status(401).json({
      error: { code: 'LICENSE_INVALID', message: 'License key not recognized.' },
    });
  }
  req.customerCtx = lic;
  next();
}

customerRouter.use(dashboardRateLimit);

// ─── GET /api/customer/dashboard ─────────────────────────────────────
//
// Returns everything the customer needs on their own dashboard:
//   - their own identity (email, name)
//   - their license (status, plan, limits, masked key)
//   - their subscription (status, renews/ends)
//   - their wp_sites (domain, plan, last_seen, post_count, crawls_7d)
//   - aggregate sync metrics
//
// Strictly scoped to the customer resolved from the license key.
// NEVER touches other customers' data.
customerRouter.get('/dashboard', requireLicenseAuth, asyncHandler((req, res) => {
  const ctx = req.customerCtx;

  // Subscription
  const subscription = ctx.subscription_id
    ? db.prepare(`
        SELECT id, plan_id, status, renews_at, ends_at, trial_ends_at, update_payment_url
        FROM subscriptions WHERE id = ?
      `).get(ctx.subscription_id)
    : null;

  // Sites belonging to this customer
  const sites = db.prepare(`
    SELECT id, domain, site_name, plan, plugin_version, wp_version, is_active,
           last_seen_at, last_sync_at, installed_at,
           (SELECT COUNT(*) FROM quoted_posts p WHERE p.wp_site_id = wp_sites.id) AS post_count,
           (SELECT COUNT(*) FROM bot_crawls b WHERE b.wp_site_id = wp_sites.id
              AND datetime(b.crawled_at) >= datetime('now','-7 days')) AS crawls_7d
    FROM wp_sites
    WHERE customer_id = ?
    ORDER BY is_active DESC, last_seen_at DESC NULLS LAST
  `).all(ctx.cust_id);

  // Aggregates
  const totalPosts = sites.reduce((n, s) => n + (s.post_count || 0), 0);
  const totalCrawls7d = sites.reduce((n, s) => n + (s.crawls_7d || 0), 0);
  const activeSites = sites.filter(s => s.is_active).length;

  // Setup checklist for the UI
  const checklist = [
    { id: 'license-active', label: 'License đang active', done: ctx.license_status === 'active' },
    { id: 'subscription-active', label: 'Subscription đang active', done: subscription?.status === 'active' },
    { id: 'site-connected', label: 'Có ít nhất 1 website kết nối', done: sites.length > 0 },
    { id: 'site-synced', label: 'Site đã sync content (ít nhất 1 post)', done: totalPosts > 0 },
    { id: 'bots-detected', label: 'AI bot đã crawl site (7 ngày)', done: totalCrawls7d > 0 },
  ];

  res.json({
    customer: {
      email: ctx.customer_email,
      name: ctx.customer_name,
    },
    license: {
      status: ctx.license_status,
      key_short: ctx.license_key_short,        // masked — never the full key
      activation_limit: ctx.activation_limit,
      instances_used: ctx.instances_count,
      expires_at: ctx.expires_at,
    },
    subscription: subscription ? {
      plan_id: subscription.plan_id,
      status: subscription.status,
      renews_at: subscription.renews_at,
      ends_at: subscription.ends_at,
      trial_ends_at: subscription.trial_ends_at,
      update_payment_url: subscription.update_payment_url,
    } : null,
    sites: sites.map(s => ({
      id: s.id,
      domain: s.domain,
      site_name: s.site_name,
      plan: s.plan,
      plugin_version: s.plugin_version,
      wp_version: s.wp_version,
      is_active: !!s.is_active,
      installed_at: s.installed_at,
      last_seen_at: s.last_seen_at,
      last_sync_at: s.last_sync_at,
      post_count: s.post_count,
      crawls_7d: s.crawls_7d,
    })),
    aggregates: {
      sites_total: sites.length,
      sites_active: activeSites,
      posts_synced: totalPosts,
      bot_crawls_7d: totalCrawls7d,
    },
    setup_checklist: checklist,
  });
}));

export default customerRouter;
