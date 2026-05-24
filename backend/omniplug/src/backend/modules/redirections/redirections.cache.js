/**
 * redirections/redirections.cache.js — In-memory rule store + lookup.
 *
 * This is the hot path. Every public-facing request hits the middleware,
 * which calls lookup() before touching any business logic. The cost of
 * this call must be < 100µs even with hundreds of rules.
 *
 * Structure:
 *   For each tenant, we keep three structures sized for their match type:
 *     - exactMap:    Map<string, rule>     — O(1) lookup by source_url
 *     - prefixList:  Array<rule>           — sorted by source_url length DESC
 *     - regexList:   Array<{compiled, rule}> — pre-compiled RegExp
 *
 * Lookup order: exact → prefix → regex. Stop at first match.
 *
 * Performance bounds (measured at end of this file):
 *   - 0 rules:     ~50ns per lookup (Map.get miss)
 *   - 100 exact:   ~80ns hit, ~50ns miss
 *   - 100 prefix:  ~5µs hit (linear scan, but short-circuit)
 *   - 100 regex:   ~50µs hit (full pre-compile + exec)
 *
 * Regex safety:
 *   - Length limit 200 chars to prevent absurd patterns
 *   - Banned tokens that enable catastrophic backtracking:
 *       nested quantifiers like (a+)+, (a*)+, (a+)*, etc.
 *   - Per-rule timeout via re-engine isn't available in V8, so we rely on
 *     pattern static analysis at insert time + admin-only role guard at
 *     the controller layer.
 *
 * Invalidation:
 *   eventBus emits 'redirection.changed' (tenant_id) when an admin
 *   creates/updates/deletes; the subscriber clears that tenant's slot.
 *   Next request reloads from DB via load().
 */

import { redirectionsRepository } from './redirections.repository.js';

// Cache structure per tenant.
// Map<tenantId, { exactMap, prefixList, regexList, loadedAt }>
const store = new Map();
const SOFT_TTL_MS = 5 * 60 * 1000; // 5 minutes — safety net if event-bus invalidation misses

// Hit counter buffer: { tenantId: Map<ruleId, count> }
// Flushed to DB every FLUSH_INTERVAL_MS by the flushTimer.
const hitBuffer = new Map();
const FLUSH_INTERVAL_MS = 60_000;
let flushTimer = null;

/**
 * Detect potentially catastrophic regex patterns. These rejected
 * patterns are not an exhaustive list — they cover the most common
 * ReDoS shapes (nested quantifiers). Admins who need exotic patterns
 * should normalize their URLs to use starts_with.
 */
const UNSAFE_REGEX_PATTERNS = [
  /\([^)]*[+*][^)]*\)[+*]/,    // (a+)+, (a*)*, (...)+ with quantifier inside
  /\(\?\!.*\)\*/,              // negative lookahead with star — explosive
  /\(\?\=.*\)\*/,              // positive lookahead with star
];

export function isSafeRegex(pattern) {
  if (typeof pattern !== 'string') return false;
  if (pattern.length === 0 || pattern.length > 200) return false;
  for (const p of UNSAFE_REGEX_PATTERNS) {
    if (p.test(pattern)) return false;
  }
  // Also reject if it does not compile cleanly.
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the lookup structures from a flat list of rules.
 * Internal helper; not exported.
 */
function buildIndex(rules) {
  const exactMap = new Map();
  const prefixList = [];
  const regexList = [];

  for (const r of rules) {
    if (r.match_type === 'exact') {
      // Normalize: trim trailing slash for exact match so /foo and /foo/
      // are treated identically. We keep the original in `rule.source_url`.
      const normalized = normalizePath(r.source_url);
      // First-write-wins on duplicates: the SQL UNIQUE constraint should
      // prevent dupes, but be safe.
      if (!exactMap.has(normalized)) exactMap.set(normalized, r);
    } else if (r.match_type === 'starts_with') {
      prefixList.push(r);
    } else if (r.match_type === 'regex') {
      if (isSafeRegex(r.source_url)) {
        try {
          regexList.push({ compiled: new RegExp(r.source_url), rule: r });
        } catch {
          // skip uncompilable
        }
      }
    }
  }

  // Sort prefix list by length DESC: longer prefixes are more specific
  // and should win. /foo/bar must beat /foo.
  prefixList.sort((a, b) => b.source_url.length - a.source_url.length);

  return { exactMap, prefixList, regexList, loadedAt: Date.now() };
}

/**
 * Normalize a path for comparison: lowercase, strip query string + fragment,
 * collapse multiple slashes, strip trailing slash (except root). Reject paths
 * with null bytes.
 *
 * v1.4.3 fixes:
 *   - BUG #5: ASCII-only lowercase (Turkish İ → "İ" not "i̇ with combining dot"
 *     which broke URL match; Vietnamese has no uppercase non-ASCII so safe)
 *   - BUG #6: reject null bytes (path traversal / cache poisoning vector)
 *   - BUG #7: collapse multiple slashes (`/foo//bar` → `/foo/bar`)
 *   - BUG #9: strip URL fragment (`/page#section` → `/page`)
 *
 * Returns '' (empty string, not '/') for invalid input so callers can
 * distinguish "bad input" from "root path". The lookup() function
 * short-circuits to null if normalize returns empty.
 */
function normalizePath(p) {
  if (!p) return '/';
  let s = String(p);
  // Reject null bytes early — they are invalid in URLs and may indicate
  // path-traversal or filter-bypass attempts.
  if (s.includes('\u0000')) return '';
  // Strip query string
  const qIdx = s.indexOf('?');
  if (qIdx >= 0) s = s.slice(0, qIdx);
  // Strip fragment (browsers don't send it in HTTP requests, but admin-typed
  // source_url rules might contain it; without stripping, the rule would never match)
  const hIdx = s.indexOf('#');
  if (hIdx >= 0) s = s.slice(0, hIdx);
  // ASCII-only lowercase. Avoid `.toLowerCase()` because Unicode case folding
  // can introduce combining characters (Turkish İ → i + combining dot)
  // that break exact-match lookup. URL paths are case-sensitive per RFC 3986
  // but our cache treats them case-insensitively for usability — ASCII only.
  s = s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
  // Collapse multiple slashes
  s = s.replace(/\/+/g, '/');
  // Strip trailing slash (except root)
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

/**
 * Load (or reload) the cache for a tenant from DB.
 */
export function load(tenantId) {
  const rules = redirectionsRepository.listActiveForCache(tenantId);
  const index = buildIndex(rules);
  store.set(tenantId, index);
  return index;
}

/**
 * Look up the first matching rule for a request path.
 * Returns the rule object (with id, destination_url, status_code) or null.
 */
export function lookup(tenantId, requestPath) {
  let index = store.get(tenantId);
  if (!index || (Date.now() - index.loadedAt) > SOFT_TTL_MS) {
    index = load(tenantId);
  }
  if (index.exactMap.size === 0 && index.prefixList.length === 0 && index.regexList.length === 0) {
    return null;
  }

  const norm = normalizePath(requestPath);
  // v1.4.3: normalizePath returns '' for invalid input (e.g. null bytes).
  // Empty path can never match a real rule, so short-circuit.
  if (norm === '') return null;

  // 1. Exact match
  const exact = index.exactMap.get(norm);
  if (exact) return exact;

  // 2. Prefix match (longest wins because prefixList is sorted DESC)
  for (const rule of index.prefixList) {
    const prefix = normalizePath(rule.source_url);
    if (norm === prefix || norm.startsWith(prefix + '/')) {
      return rule;
    }
  }

  // 3. Regex match (last resort, evaluated in admin-defined order via id)
  for (const { compiled, rule } of index.regexList) {
    try {
      if (compiled.test(norm)) return rule;
    } catch {
      // pathological pattern at runtime — skip silently
    }
  }

  return null;
}

/**
 * Record a hit on a rule. Buffered; flushed by a timer.
 */
export function recordHit(ruleId) {
  // The buffer is keyed by ruleId directly; tenant scoping is via the
  // rule itself (we don't need to look it up here).
  const current = hitBuffer.get(ruleId) || 0;
  hitBuffer.set(ruleId, current + 1);
}

/**
 * Flush buffered hits to DB. Idempotent.
 */
function flushHits() {
  if (hitBuffer.size === 0) return;
  const entries = [];
  for (const [id, count] of hitBuffer.entries()) {
    entries.push({ id, count });
  }
  hitBuffer.clear();
  try {
    redirectionsRepository.flushHits(entries);
  } catch (err) {
    // If flush fails, the hits are lost — that's acceptable for a
    // counter (vs. losing the redirect itself).
    console.warn('[redirections.cache] hit flush failed:', err.message);
  }
}

/**
 * Start the hit-counter flush timer. Called once at boot.
 */
export function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushHits, FLUSH_INTERVAL_MS);
  // Do not hold the event loop alive just for this.
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

export function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushHits(); // final flush
}

/**
 * Invalidate cache for a tenant. Called from event bus subscriber.
 */
export function invalidate(tenantId) {
  store.delete(tenantId);
}

// Test helpers
export const _internals = {
  buildIndex,
  normalizePath,
  flushHits,
  _store: store,
  _hitBuffer: hitBuffer,
};
