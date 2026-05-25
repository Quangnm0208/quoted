/**
 * citations service — orchestrates "did anyone cite this tenant?".
 *
 * Flow per /sync:
 *   1. For each queued query (sent by the plugin via /sync):
 *      a. For each configured provider, run search(query).
 *      b. For each result URL, check if it matches a tenant-owned canonical
 *         URL (quoted_posts.canonical_url) OR domain.
 *      c. Score confidence: domain match → 0.65, URL slug match → 0.85,
 *         exact canonical match → 1.0.
 *      d. citationsRepo.upsert(...) — idempotent dedup.
 *   2. Return summary { polled, matched, providers_used }.
 *
 * /submit is a single-citation insert from the plugin (user-curated).
 */

import db from '../../../../core/db/connection.js';
import { citationsRepo } from './citations.repository.js';
import { listConfigured } from './providers/index.js';
import { quotedPostsRepository } from '../_shared/quoted-posts.repository.js';

function err(code, message, httpStatus = 400) {
  const e = new Error(message); e.code = code; e.httpStatus = httpStatus; return e;
}

function getTenantDomain(tenantId) {
  const row = db.prepare(`SELECT domain FROM tenants WHERE id = ?`).get(tenantId);
  return row?.domain || null;
}

/**
 * Score a candidate URL against a tenant's owned canonical URLs.
 * Returns { confidence, articleId, matchedUrl } or null if no match.
 */
function matchAgainstTenant(tenantId, citedUrl) {
  let citedUrlObj;
  try { citedUrlObj = new URL(String(citedUrl)); }
  catch { return null; }

  const tenantDomain = getTenantDomain(tenantId);
  if (!tenantDomain) return null;

  // Domain mismatch → not ours.
  const citedHost = citedUrlObj.host.replace(/^www\./, '').toLowerCase();
  if (citedHost !== tenantDomain.toLowerCase()) return null;

  // 1. exact canonical match against quoted_posts.canonical_url
  const exactRow = db.prepare(
    `SELECT id FROM quoted_posts WHERE tenant_id = ? AND canonical_url = ?`
  ).get(tenantId, String(citedUrl));
  if (exactRow) return { confidence: 1.0, articleId: exactRow.id, matchedUrl: citedUrl };

  // 2. slug match (last path segment)
  const slug = citedUrlObj.pathname.replace(/\/+$/, '').split('/').pop();
  if (slug) {
    const slugRow = db.prepare(
      `SELECT id FROM quoted_posts WHERE tenant_id = ? AND slug = ?`
    ).get(tenantId, slug);
    if (slugRow) return { confidence: 0.85, articleId: slugRow.id, matchedUrl: citedUrl };
  }

  // 3. domain-only match (the AI cited the homepage or an unknown deep page)
  return { confidence: 0.65, articleId: null, matchedUrl: citedUrl };
}

/**
 * /sync — plugin sends N queries (e.g. "best running shoes 2026", "marathon
 * training plan", …). For each, hit every configured provider, score
 * results, persist matches. Returns counts so the plugin can show progress.
 */
export async function syncQueries(tenantId, queries) {
  const providers = listConfigured();
  if (providers.length === 0) {
    throw err(
      'PROVIDER_NOT_CONFIGURED',
      'No citation provider configured. Set PERPLEXITY_API_KEY, TAVILY_API_KEY, or SERPER_API_KEY (or CITATIONS_TEST_MODE=true for local dev).',
      503,
    );
  }

  let polled = 0;
  let matched = 0;
  const errors = [];

  for (const query of queries) {
    for (const provider of providers) {
      try {
        const { results } = await provider.search(query);
        polled++;
        for (const r of results) {
          const m = matchAgainstTenant(tenantId, r.url);
          if (!m) continue;
          citationsRepo.upsert({
            tenantId,
            source: provider.id,
            query,
            citedUrl: m.matchedUrl,
            articleId: m.articleId,
            responseExcerpt: r.snippet || null,
            // Composite confidence: provider's raw score × our URL-match score.
            confidence: m.confidence * (r.score || 0.8),
          });
          matched++;
        }
      } catch (e) {
        errors.push({ provider: provider.id, query, error: e.message });
      }
    }
  }

  return {
    polled,
    matched,
    providers_used: providers.map(p => p.id),
    errors,
  };
}

/**
 * /submit — user-curated single citation (no provider call).
 */
export function submitOne(tenantId, { source, query, cited_url, response_excerpt, confidence }) {
  const m = matchAgainstTenant(tenantId, cited_url);
  if (!m) {
    throw err('URL_NOT_OWNED', 'Cited URL is not on a domain owned by this tenant.', 400);
  }
  citationsRepo.upsert({
    tenantId,
    source: source || 'user_submitted',
    query,
    citedUrl: cited_url,
    articleId: m.articleId,
    responseExcerpt: response_excerpt,
    confidence: confidence != null ? Number(confidence) : m.confidence,
  });
  return { ok: true, confidence: m.confidence };
}

export function listForTenant(tenantId, opts) {
  return citationsRepo.list(tenantId, opts);
}

/**
 * Dashboard summary numbers — verified (≥0.85) + likely (≥0.65) in last N days.
 */
export function summary(tenantId, days = 7) {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  return {
    verified_count: citationsRepo.countVerifiedSince(tenantId, since),
    likely_count:   citationsRepo.countLikelySince(tenantId, since),
    since,
  };
}
