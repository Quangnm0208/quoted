/**
 * error_log/error_log.controller.js — 404 monitor middleware + admin API.
 *
 * Why this module is its own thing rather than inlined in error.js:
 *   The existing notFoundHandler in core/middleware/error.js just returns
 *   the 404 JSON. We want to ALSO log it, but logging must:
 *     1. Be tenant-scoped (the existing handler doesn't depend on tenant)
 *     2. Filter bot/scanner traffic so we don't pollute the dashboard
 *     3. Batch writes so 100 req/s of bot scans don't lock SQLite
 *
 * Architecture:
 *   - Buffer 404 events in memory keyed by (tenant_id, uri).
 *   - Flush buffer to DB every FLUSH_INTERVAL_MS via timer.
 *   - At flush, do ONE transaction with N upserts — fast.
 *
 * Bot filter:
 *   We filter on two signals:
 *     1. Path ends with a banned extension (.php, .env, .git, .well-known
 *        oddities) — almost always bot scan
 *     2. User-Agent matches well-known crawler patterns (Googlebot, etc.)
 *        — we filter Googlebot too, since they cache 404s and don't need
 *        our human-facing report
 *   The filter is cheap (regex on string) and runs before buffer insert.
 *
 * Performance bound: middleware runs only on 404 paths (after all
 * matched routes have returned). Most production traffic is 200 or 301;
 * the 404 path is naturally rare. Even so we keep it tight.
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { NotFoundError } from '../../../core/lib/errors.js';
import { errorLogRepository } from './error_log.repository.js';

// ---------------------------------------------------------------------
// Bot filter
// ---------------------------------------------------------------------

// Extensions that are almost always bot scans, never real human navigation.
const BOT_SCAN_EXTENSIONS = /\.(php|env|git|sql|bak|asp|aspx|jsp|cgi|swp|ini)$|\/\.git\/|\/\.env|\/wp-admin|\/wp-login|\/wordpress|\/phpmyadmin|\/xmlrpc|\/cgi-bin/i;

// User-Agent patterns we don't want in the human-facing report.
// We include both legitimate crawlers (Googlebot, Bingbot) and bad bots;
// the dashboard is for humans investigating broken human-facing links.
const FILTERED_USER_AGENTS = /Googlebot|Bingbot|YandexBot|DuckDuckBot|Baiduspider|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|WhatsApp|crawler|spider|bot\/|python-requests|curl\/|wget\//i;

function shouldFilterRequest(req) {
  const path = req.path || '';
  if (BOT_SCAN_EXTENSIONS.test(path)) return true;
  const ua = req.headers['user-agent'] || '';
  if (FILTERED_USER_AGENTS.test(ua)) return true;
  return false;
}

// ---------------------------------------------------------------------
// Buffer
// ---------------------------------------------------------------------
//
// Key = tenantId + '|' + uri. Value = { tenant_id, uri, hits, referer, user_agent }
const buffer = new Map();
const MAX_BUFFER_SIZE = 5000;        // hard cap to bound memory under attack
const FLUSH_INTERVAL_MS = 60_000;    // 60s
let flushTimer = null;

function bufferAdd(tenantId, uri, referer, userAgent) {
  const key = tenantId + '|' + uri;
  const existing = buffer.get(key);
  if (existing) {
    existing.hits += 1;
    if (referer) existing.referer = referer;
    if (userAgent) existing.user_agent = userAgent;
    return;
  }
  if (buffer.size >= MAX_BUFFER_SIZE) {
    // Drop on overflow — we are likely under bot attack despite the
    // filter. Loss is acceptable; the dashboard does not need perfect
    // counts.
    return;
  }
  buffer.set(key, {
    tenant_id: tenantId,
    uri,
    hits: 1,
    referer: referer || null,
    user_agent: userAgent || null,
  });
}

function flushBuffer() {
  if (buffer.size === 0) return;
  const entries = Array.from(buffer.values());
  buffer.clear();
  try {
    // v1.4.3 fix for BUG #10: batchUpsert now returns { upserted, skipped, errors }
    // instead of throwing on FK fail. Partial flushes succeed; orphan rows logged.
    const result = errorLogRepository.batchUpsert(entries);
    if (result.skipped > 0) {
      console.warn(
        `[error_log] flush: ${result.upserted} upserted, ${result.skipped} skipped (likely stale tenant_id). ` +
        `Sample errors: ${result.errors.join(' | ')}`,
      );
    }
  } catch (err) {
    console.warn('[error_log] flush failed:', err.message);
  }
}

export function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

export function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushBuffer();
}

// ---------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------

/**
 * Mount BEFORE notFoundHandler.
 *
 * The existing notFoundHandler is the terminal middleware in server.js.
 * We add a step before it that logs the 404 then passes through to the
 * existing handler, which sends the JSON response. The behavior of the
 * actual response is unchanged.
 *
 * If tenantId is not resolved (e.g., unknown host in production), we
 * still skip — we have no place to put the row.
 */
export function logMiddleware(req, res, next) {
  // Only log requests for resources that look like content (not API).
  // /api/ 404s are bot scans for vulnerabilities; they go to bot filter
  // immediately.
  const path = req.path || '';
  if (path.startsWith('/api/') || path.startsWith('/admin/')) {
    return next();
  }
  if (typeof req.tenantId !== 'number') {
    return next();
  }
  if (shouldFilterRequest(req)) {
    return next();
  }

  // v1.4.3 fix for BUG #11: reject URIs containing path traversal segments
  // or null bytes before they enter the buffer. Innocuous in current 404 UX
  // (admin just sees the URI in dashboard) but dangerous once we wire the
  // "Create redirect from 404" feature — admin click would persist `..` into
  // a redirect rule, which downstream code might then resolve as filesystem.
  if (path.includes('\u0000') || /(?:^|\/)\.\.(?:\/|$)/.test(path)) {
    return next();
  }

  // Truncate URI early to bound memory; the column accepts up to 500 chars.
  const uri = path.slice(0, 500);
  const referer = req.headers['referer'] || req.headers['referrer'] || null;
  const userAgent = req.headers['user-agent'] || null;
  bufferAdd(req.tenantId, uri, referer, userAgent);
  next();
}

// ---------------------------------------------------------------------
// Admin Router
// ---------------------------------------------------------------------

export const adminRouter = Router();
adminRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });
const ignoreBody = z.object({ ignored: z.boolean() });

adminRouter.get('/',
  requireRole('admin', 'editor', 'platform_admin'),
  asyncHandler((req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const includeIgnored = req.query.include_ignored === 'true';
    res.json(errorLogRepository.listForAdmin(req.tenantId, limit, offset, includeIgnored));
  }),
);

adminRouter.patch('/:id/ignore',
  requireRole('admin', 'platform_admin'),
  validate({ params: idParam, body: ignoreBody }),
  asyncHandler((req, res) => {
    const r = errorLogRepository.setIgnored(
      req.validated.params.id,
      req.tenantId,
      req.validated.body.ignored,
    );
    if (r.changes === 0) throw new NotFoundError('404 entry not found');
    recordAudit(req, 'error_404.ignore', {
      entityType: 'error_404',
      entityId: req.validated.params.id,
      metadata: { ignored: req.validated.body.ignored },
    });
    res.json({ ok: true });
  }),
);

adminRouter.delete('/:id',
  requireRole('admin', 'platform_admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const r = errorLogRepository.deleteRow(req.validated.params.id, req.tenantId);
    if (r.changes === 0) throw new NotFoundError('404 entry not found');
    recordAudit(req, 'error_404.delete', {
      entityType: 'error_404',
      entityId: req.validated.params.id,
    });
    res.json({ ok: true });
  }),
);

// Test helpers
export const _internals = {
  shouldFilterRequest,
  bufferAdd,
  flushBuffer,
  _buffer: buffer,
};
