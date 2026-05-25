/**
 * quoted-admin/quoted-admin.controller.js
 *
 * Admin read-only endpoints for the Quoted SaaS surfaces:
 * customers, subscriptions, customer_licenses, wp_sites, orders,
 * bot_crawls, quoted_posts, citations, webhook_events.
 *
 * All endpoints are JWT-gated (mounted under /api/admin) and operate on
 * the operator-tenant (tenant 1 in single-product Quoted backend).
 *
 * Read-only by design — write paths come from real customer activity
 * (plugin install registers WP site, LS webhook creates customer/order,
 * etc.). Operator does not create these records by hand.
 *
 * SaaS dashboard: aggregated KPIs (MRR, active subs, total customers,
 * active sites, bot crawls last 7d, citations last 7d).
 */

import { Router } from 'express';
import { asyncHandler } from '../../../../core/lib/asyncHandler.js';
import { recordAudit } from '../../../../core/lib/audit.js';
import db from '../../../../core/db/connection.js';

export const adminRouter = Router();

function paginate(req, defaultLimit = 50) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

// ─── Customers ──────────────────────────────────────────────────────
adminRouter.get('/customers', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT c.id, c.email, c.name, c.lemon_customer_id, c.created_at,
           (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') AS active_subs,
           (SELECT COUNT(*) FROM customer_licenses l WHERE l.customer_id = c.id AND l.status = 'active') AS active_licenses,
           (SELECT plan_id FROM subscriptions s WHERE s.customer_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_plan
    FROM customers c
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
  res.json({ rows, limit, offset, total });
}));

// ─── Subscriptions ──────────────────────────────────────────────────
adminRouter.get('/subscriptions', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT s.id, s.lemon_subscription_id, s.plan_id, s.status,
           s.renews_at, s.ends_at, s.trial_ends_at, s.created_at,
           c.email AS customer_email, c.name AS customer_name, c.id AS customer_id
    FROM subscriptions s
    LEFT JOIN customers c ON c.id = s.customer_id
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM subscriptions').get().c;
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) AS c FROM subscriptions GROUP BY status
  `).all();
  res.json({ rows, limit, offset, total, by_status: byStatus });
}));

// ─── Customer licenses ──────────────────────────────────────────────
adminRouter.get('/licenses', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT l.id, l.lemon_license_id, l.license_key_short, l.status,
           l.activation_limit, l.instances_count, l.expires_at, l.created_at,
           c.email AS customer_email, c.id AS customer_id,
           s.plan_id, s.status AS subscription_status
    FROM customer_licenses l
    LEFT JOIN customers c ON c.id = l.customer_id
    LEFT JOIN subscriptions s ON s.id = l.subscription_id
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM customer_licenses').get().c;
  res.json({ rows, limit, offset, total });
}));

// ─── WP sites (installed plugin instances) ──────────────────────────
adminRouter.get('/wp-sites', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT w.id, w.domain, w.site_name, w.admin_email, w.wp_version,
           w.plugin_version, w.plan, w.niche, w.installed_at, w.last_sync_at,
           w.last_seen_at, w.is_active,
           c.email AS customer_email,
           (SELECT COUNT(*) FROM quoted_posts p WHERE p.wp_site_id = w.id) AS post_count,
           (SELECT COUNT(*) FROM bot_crawls b WHERE b.wp_site_id = w.id
              AND datetime(b.crawled_at) >= datetime('now','-7 days')) AS crawls_7d
    FROM wp_sites w
    LEFT JOIN customers c ON c.id = w.customer_id
    WHERE w.tenant_id = 1
    ORDER BY w.last_seen_at DESC NULLS LAST, w.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM wp_sites WHERE tenant_id = 1').get().c;
  const activeCount = db.prepare(`SELECT COUNT(*) AS c FROM wp_sites WHERE tenant_id = 1 AND is_active = 1`).get().c;
  res.json({ rows, limit, offset, total, active: activeCount });
}));

// ─── Orders / revenue ───────────────────────────────────────────────
adminRouter.get('/orders', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT o.id, o.lemon_order_id, o.amount_cents, o.currency, o.status, o.created_at,
           c.email AS customer_email, c.id AS customer_id
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount_cents),0) AS cents FROM orders WHERE status='paid'
  `).get().cents;
  res.json({ rows, limit, offset, total, total_revenue_cents: totalRevenue });
}));

// ─── Bot crawls (the product's value-prop data) ─────────────────────
adminRouter.get('/bot-crawls', asyncHandler((req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  const recent = db.prepare(`
    SELECT bot_name, COUNT(*) AS hits
    FROM bot_crawls
    WHERE tenant_id = 1 AND datetime(crawled_at) >= datetime('now', ? || ' days')
    GROUP BY bot_name
    ORDER BY hits DESC
    LIMIT 20
  `).all('-' + days);
  const recentByDay = db.prepare(`
    SELECT date(crawled_at) AS day, COUNT(*) AS hits
    FROM bot_crawls
    WHERE tenant_id = 1 AND datetime(crawled_at) >= datetime('now', ? || ' days')
    GROUP BY date(crawled_at)
    ORDER BY day DESC
    LIMIT ?
  `).all('-' + days, days);
  const topSites = db.prepare(`
    SELECT w.domain, COUNT(*) AS hits
    FROM bot_crawls b
    LEFT JOIN wp_sites w ON w.id = b.wp_site_id
    WHERE b.tenant_id = 1 AND datetime(b.crawled_at) >= datetime('now', ? || ' days')
    GROUP BY w.domain
    ORDER BY hits DESC
    LIMIT 10
  `).all('-' + days);
  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM bot_crawls
    WHERE tenant_id = 1 AND datetime(crawled_at) >= datetime('now', ? || ' days')
  `).get('-' + days).c;
  res.json({ days, total, by_bot: recent, by_day: recentByDay, top_sites: topSites });
}));

// ─── Synced posts ───────────────────────────────────────────────────
adminRouter.get('/posts', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT p.id, p.wp_post_id, p.slug, p.title, p.excerpt, p.author,
           p.published_at, p.modified_at, p.canonical_url, p.created_at,
           w.domain AS site_domain
    FROM quoted_posts p
    LEFT JOIN wp_sites w ON w.id = p.wp_site_id
    WHERE p.tenant_id = 1
    ORDER BY p.modified_at DESC NULLS LAST, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM quoted_posts WHERE tenant_id = 1').get().c;
  res.json({ rows, limit, offset, total });
}));

// ─── Citations (Phase-2 feature; today empty but queryable) ─────────
adminRouter.get('/citations', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT id, source, query, cited_url, response_excerpt, confidence,
           status, first_seen_at, last_seen_at
    FROM citations
    WHERE tenant_id = 1
    ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM citations WHERE tenant_id = 1').get().c;
  res.json({ rows, limit, offset, total });
}));

// ─── Revoke a WP site (force-disconnect compromised installation) ───
// SaaS threat T10 mitigation — see docs/SECURITY_THREAT_MODEL.md.
//
// Sets is_active=0 + clears license_jti (the plugin's JWT carries this
// jti; once cleared, the next plugin request fails JWT-jti check and
// the plugin is forced through re-activation).
//
// Audit-logged as `wp_site.revoke` for incident-response trail.
adminRouter.post('/wp-sites/:id/revoke', asyncHandler((req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'wp_site id must be a positive integer.' } });
  }
  const reason = String(req.body?.reason || 'manual_operator_action').slice(0, 200);
  const row = db.prepare('SELECT id, domain FROM wp_sites WHERE id = ? AND tenant_id = 1').get(id);
  if (!row) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'WP site not found.' } });
  }
  const result = db.prepare(`
    UPDATE wp_sites
    SET is_active = 0, license_jti = NULL, updated_at = datetime('now')
    WHERE id = ? AND tenant_id = 1
  `).run(id);
  // Audit trail — uses the standard helper so schema/columns stay in sync
  // with the rest of OmniPlug (metadata_json, not metadata; no user_email
  // column — the auditContextFromRequest helper handles the mapping).
  try {
    recordAudit(req, 'wp_site.revoke', {
      entityType: 'wp_site',
      entityId: id,
      metadata: { domain: row.domain, reason },
    });
  } catch { /* audit failure must not block the revocation */ }
  res.json({ revoked: true, wp_site_id: id, domain: row.domain, changes: result.changes });
}));

// ─── Webhook events log ─────────────────────────────────────────────
adminRouter.get('/webhook-events', asyncHandler((req, res) => {
  const { limit, offset } = paginate(req);
  const rows = db.prepare(`
    SELECT id, event_id, event_name, signature_valid, processed,
           received_at, processed_at, error_message
    FROM webhook_events
    ORDER BY received_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM webhook_events').get().c;
  const failures = db.prepare(`
    SELECT COUNT(*) AS c FROM webhook_events
    WHERE signature_valid = 0 OR (processed = 0 AND error_message IS NOT NULL)
  `).get().c;
  res.json({ rows, limit, offset, total, failures });
}));

// ─── SaaS Dashboard — aggregated KPIs ───────────────────────────────
adminRouter.get('/dashboard', asyncHandler((req, res) => {
  // Pricing per plan tag — MRR estimate. These mirror the LS variants
  // env; if the env changes, edit here. (Production-correct MRR would
  // sum subscription.amount but LS webhook doesn't always carry that
  // field for us — plan_id is reliable.)
  const PRICE_CENTS = {
    'pro-monthly': 1900,
    'pro-yearly': 19000,
    'agency-monthly': 2900,
    'agency-yearly': 29000,
  };

  const activeSubs = db.prepare(`
    SELECT plan_id, COUNT(*) AS c FROM subscriptions WHERE status = 'active' GROUP BY plan_id
  `).all();
  let mrrCents = 0;
  for (const s of activeSubs) {
    const price = PRICE_CENTS[s.plan_id] || 0;
    const monthly = s.plan_id.endsWith('-yearly') ? Math.round(price / 12) : price;
    mrrCents += monthly * s.c;
  }

  const totalRevenueCents = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS c FROM orders WHERE status = 'paid'
  `).get().c;

  const totalCustomers = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
  const activeSubsTotal = db.prepare(`SELECT COUNT(*) AS c FROM subscriptions WHERE status='active'`).get().c;
  const totalLicenses = db.prepare(`SELECT COUNT(*) AS c FROM customer_licenses WHERE status='active'`).get().c;
  const activeSites = db.prepare(`SELECT COUNT(*) AS c FROM wp_sites WHERE tenant_id=1 AND is_active=1`).get().c;
  const totalSites = db.prepare(`SELECT COUNT(*) AS c FROM wp_sites WHERE tenant_id=1`).get().c;

  const crawls7d = db.prepare(`
    SELECT COUNT(*) AS c FROM bot_crawls
    WHERE tenant_id = 1 AND datetime(crawled_at) >= datetime('now','-7 days')
  `).get().c;
  const citations7d = db.prepare(`
    SELECT COUNT(*) AS c FROM citations
    WHERE tenant_id = 1 AND datetime(first_seen_at) >= datetime('now','-7 days')
  `).get().c;
  const posts = db.prepare(`SELECT COUNT(*) AS c FROM quoted_posts WHERE tenant_id=1`).get().c;

  const webhookFailures = db.prepare(`
    SELECT COUNT(*) AS c FROM webhook_events
    WHERE signature_valid = 0 OR (processed = 0 AND error_message IS NOT NULL)
  `).get().c;

  res.json({
    mrr_cents: mrrCents,
    arr_cents: mrrCents * 12,
    total_revenue_cents: totalRevenueCents,
    customers: totalCustomers,
    active_subscriptions: activeSubsTotal,
    active_subscriptions_by_plan: activeSubs,
    active_licenses: totalLicenses,
    wp_sites_active: activeSites,
    wp_sites_total: totalSites,
    bot_crawls_7d: crawls7d,
    citations_7d: citations7d,
    posts_synced: posts,
    webhook_failures: webhookFailures,
  });
}));

export default adminRouter;
