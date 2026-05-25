/**
 * citations repository — tenant-scoped reads/writes on the `citations` table
 * (schema in migration 027). Real implementation as of v0.4.1.
 */

import crypto from 'node:crypto';
import db from '../../../../core/db/connection.js';
import { lazyPrepare } from '../../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  countActiveSince: db.prepare(`
    SELECT COUNT(*) AS n FROM citations
    WHERE tenant_id = ? AND status = 'active'
      AND last_seen_at >= ? AND confidence >= ?
  `),

  upsert: db.prepare(`
    INSERT INTO citations
      (tenant_id, source, query, cited_url, cited_url_canonical, cited_article_id,
       response_excerpt, confidence, dedup_key, status, first_seen_at, last_seen_at)
    VALUES
      (@tenant_id, @source, @query, @cited_url, @cited_url_canonical, @cited_article_id,
       @response_excerpt, @confidence, @dedup_key, 'active', @now, @now)
    ON CONFLICT(tenant_id, dedup_key) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      confidence   = MAX(citations.confidence, excluded.confidence),
      status       = 'active'
  `),

  listByTenant: db.prepare(`
    SELECT id, source, query, cited_url, cited_url_canonical, cited_article_id,
           response_excerpt, confidence, status, first_seen_at, last_seen_at, lost_at,
           verified, notified
    FROM citations
    WHERE tenant_id = ?
      AND (@source IS NULL OR source = @source)
      AND (@status IS NULL OR status = @status)
      AND (@min_confidence IS NULL OR confidence >= @min_confidence)
      AND (@since IS NULL OR last_seen_at >= @since)
    ORDER BY last_seen_at DESC
    LIMIT @limit OFFSET @offset
  `),

  countByTenant: db.prepare(`
    SELECT COUNT(*) AS n FROM citations
    WHERE tenant_id = ?
      AND (@source IS NULL OR source = @source)
      AND (@status IS NULL OR status = @status)
      AND (@min_confidence IS NULL OR confidence >= @min_confidence)
      AND (@since IS NULL OR last_seen_at >= @since)
  `),

  markLost: db.prepare(`
    UPDATE citations SET status = 'lost', lost_at = datetime('now')
    WHERE tenant_id = ? AND id = ? AND status = 'active'
  `),
}));

export function makeDedupKey({ source, query, cited_url_canonical }) {
  const norm = `${source}|${String(query).trim().toLowerCase()}|${cited_url_canonical}`;
  return crypto.createHash('sha256').update(norm).digest('hex');
}

function normalizeUrl(u) {
  try {
    const url = new URL(String(u));
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch { return String(u); }
}

export const citationsRepo = {
  upsert({ tenantId, source, query, citedUrl, articleId = null, responseExcerpt = null, confidence = 0.5 }) {
    const canonical = normalizeUrl(citedUrl);
    const dedupKey  = makeDedupKey({ source, query, cited_url_canonical: canonical });
    stmt().upsert.run({
      tenant_id: tenantId,
      source,
      query: String(query).slice(0, 1000),
      cited_url: String(citedUrl).slice(0, 2048),
      cited_url_canonical: canonical,
      cited_article_id: articleId,
      response_excerpt: responseExcerpt ? String(responseExcerpt).slice(0, 2000) : null,
      confidence: Math.max(0, Math.min(1, Number(confidence))),
      dedup_key: dedupKey,
      now: new Date().toISOString(),
    });
  },

  list(tenantId, opts = {}) {
    const params = {
      source: opts.source || null,
      status: opts.status || 'active',
      min_confidence: opts.minConfidence ?? null,
      since: opts.since || null,
      limit: Math.min(Math.max(opts.limit || 50, 1), 200),
      offset: Math.max(opts.offset || 0, 0),
    };
    const rows  = stmt().listByTenant.all(tenantId, params);
    const total = stmt().countByTenant.get(tenantId, params).n;
    return { rows, total, limit: params.limit, offset: params.offset };
  },

  countVerifiedSince(tenantId, sinceIso) { return stmt().countActiveSince.get(tenantId, sinceIso, 0.85).n; },
  countLikelySince(tenantId, sinceIso)   { return stmt().countActiveSince.get(tenantId, sinceIso, 0.65).n; },

  markLost(tenantId, id) {
    return stmt().markLost.run(tenantId, id).changes > 0;
  },
};

// Back-compat with old stub callers — these names were exported before.
export function countVerifiedSince(tenantId, sinceIso) { return citationsRepo.countVerifiedSince(tenantId, sinceIso); }
export function countLikelySince(tenantId, sinceIso)   { return citationsRepo.countLikelySince(tenantId, sinceIso); }
export function findRecent(tenantId, limit = 20) {
  return citationsRepo.list(tenantId, { limit }).rows;
}
