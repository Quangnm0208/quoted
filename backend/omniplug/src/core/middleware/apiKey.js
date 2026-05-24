/**
 * core/middleware/apiKey.js — Verify API keys on /api/v1/* and similar.
 *
 * v1.4.4 — see PROMPT v1.4.4 §3 SEC-1, SEC-3, SEC-5.
 *
 * Defence layers (in order):
 *   1. Per-IP token bucket (SEC-3) — 60 req/min before any bcrypt. Rejects
 *      with HTTP 429 IP_RATE_LIMITED in <5ms. Stops bcrypt DoS amplifier.
 *   2. Parse Authorization: Bearer op_live_... header. Bad shape → 401 in
 *      ~constant time (still pass through bcrypt path).
 *   3. SELECT key_hash by prefix. Hit OR miss, we call bcrypt.compare —
 *      on miss against DUMMY_HASH, on hit against the real hash. Pad
 *      response to 80ms minimum on the miss path (SEC-1).
 *   4. Per-key burst bucket (LRU 10k max, SEC-5). 5 req/sec sustained.
 *
 * On success: sets req.apiKey = { id, tenant_id, license_id, scope, plan }.
 */

import db from '../db/connection.js';
import { parseApiKeyHeader, verifyApiKey, DUMMY_HASH, sleep } from '../lib/apiKeyMint.js';
import { rateLimitPerIp } from '../lib/rateLimiterIp.js';
import { BaseHttpError } from '../lib/errors.js';
import { getPlanQuotas } from '../lib/planQuotas.js';
import { expandApiKeyScopes } from '../lib/apiKeyScopes.js';

const KEY_BURST_MAX = 10_000;             // SEC-5 LRU bound
const KEY_BURST_CAPACITY = 5;             // 5 req/s sustained
const KEY_BURST_WINDOW_MS = 1000;
const MIN_RESPONSE_NS = 80_000_000n;      // SEC-1 — 80ms floor on reject paths
const IP_RATE_PER_MIN = 60;               // SEC-3

const _keyBuckets = new Map();            // prefix → { tokens, lastRefill }

function evictOldestKeyBucket() {
  let oldestKey = null;
  let oldestTs = Infinity;
  for (const [k, v] of _keyBuckets) {
    if (v.lastRefill < oldestTs) {
      oldestTs = v.lastRefill;
      oldestKey = k;
    }
  }
  if (oldestKey != null) _keyBuckets.delete(oldestKey);
}

function tryKeyBurst(prefix) {
  const now = Date.now();
  let b = _keyBuckets.get(prefix);
  if (!b) {
    if (_keyBuckets.size >= KEY_BURST_MAX) evictOldestKeyBucket();
    b = { tokens: KEY_BURST_CAPACITY, lastRefill: now };
    _keyBuckets.set(prefix, b);
  } else {
    const elapsed = now - b.lastRefill;
    if (elapsed > 0) {
      const refill = (elapsed / KEY_BURST_WINDOW_MS) * KEY_BURST_CAPACITY;
      b.tokens = Math.min(KEY_BURST_CAPACITY, b.tokens + refill);
      b.lastRefill = now;
    }
    _keyBuckets.delete(prefix);
    _keyBuckets.set(prefix, b);
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

// Prepared statements (lazy — DB connection may not exist at import)
const _stmts = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    cache = {
      byPrefix: db.prepare(`
        SELECT k.id, k.tenant_id, k.license_id, k.key_hash, k.status, k.scope,
               t.plan_cached AS plan
          FROM api_keys k
          LEFT JOIN tenants t ON t.id = k.tenant_id
         WHERE k.key_prefix = ?
      `),
      touchUsage: db.prepare(`
        INSERT INTO api_usage (api_key_id, usage_date, count)
        VALUES (?, date('now'), 1)
        ON CONFLICT(api_key_id, usage_date) DO UPDATE
          SET count = count + 1, updated_at = datetime('now')
      `),
      touchUsageByTenant: db.prepare(`
        INSERT INTO api_usage_tenant_daily (tenant_id, usage_date, count)
        VALUES (?, date('now'), 1)
        ON CONFLICT(tenant_id, usage_date) DO UPDATE
          SET count = count + 1, updated_at = datetime('now')
      `),
      countTenantToday: db.prepare(`
        SELECT count FROM api_usage_tenant_daily
         WHERE tenant_id = ? AND usage_date = date('now')
      `),
      touchLastUsed: db.prepare(`
        UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?
      `),
    };
    return cache;
  };
})();

function rejectBadKey(res) {
  return res.status(401).json({
    ok: false,
    error: {
      code: 'API_KEY_INVALID',
      message: 'API key is missing or invalid.',
    },
    message: 'API key is missing or invalid.',
  });
}

function rejectIpRateLimited(res) {
  return res.status(429).json({
    ok: false,
    error: {
      code: 'IP_RATE_LIMITED',
      message: 'Too many requests from this IP. Slow down or obtain a license.',
    },
    message: 'Too many requests from this IP. Slow down or obtain a license.',
  });
}

function rejectKeyBurst(res) {
  return res.status(429).json({
    ok: false,
    error: {
      code: 'API_KEY_BURST',
      message: 'Too many requests for this API key. Sustained limit is 5/sec.',
    },
    message: 'Too many requests for this API key. Sustained limit is 5/sec.',
  });
}

export async function requireApiKey(req, res, next) {
  // SEC-3: cheap IP-level token bucket BEFORE any bcrypt work
  if (!rateLimitPerIp.tryAcquire(req.ip || 'unknown', IP_RATE_PER_MIN)) {
    return rejectIpRateLimited(res);
  }

  // Parse header
  const auth = req.headers.authorization || req.headers['x-api-key'] || '';
  const headerValue = typeof auth === 'string' && auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : String(auth).trim();
  const parsed = parseApiKeyHeader(headerValue);

  const startNs = process.hrtime.bigint();

  if (!parsed) {
    // SEC-1: still do a bcrypt compare against DUMMY_HASH so the
    // attacker can't distinguish "bad shape" vs "good shape, bad secret"
    // by timing.
    await verifyApiKey('not-a-real-secret-but-string-shape', DUMMY_HASH);
    await padToMin(startNs);
    return rejectBadKey(res);
  }

  const row = _stmts().byPrefix.get(parsed.prefix);
  const hashToCheck = row && row.status === 'active' ? row.key_hash : DUMMY_HASH;
  const secretOk = await verifyApiKey(parsed.secret, hashToCheck);

  if (!row || row.status !== 'active' || !secretOk) {
    await padToMin(startNs);
    return rejectBadKey(res);
  }

  // SEC-5: per-key burst limit
  if (!tryKeyBurst(parsed.prefix)) {
    return rejectKeyBurst(res);
  }

  // Success: touch usage + last-used (best-effort; never fails the request)
  try {
    _stmts().touchUsage.run(row.id);
    _stmts().touchUsageByTenant.run(row.tenant_id);
    _stmts().touchLastUsed.run(row.id);
  } catch (err) {
    console.warn('[apiKey] usage update failed:', err.message);
  }

  req.apiKey = {
    id: row.id,
    tenant_id: row.tenant_id,
    license_id: row.license_id,
    scope: row.scope,
    plan: row.plan || 'community',
  };
  // Convenience: set req.tenantId for downstream tenant-scoped controllers
  if (!req.tenantId) req.tenantId = row.tenant_id;
  next();
}

async function padToMin(startNs) {
  const elapsedNs = process.hrtime.bigint() - startNs;
  if (elapsedNs < MIN_RESPONSE_NS) {
    const remainMs = Number((MIN_RESPONSE_NS - elapsedNs) / 1_000_000n);
    await sleep(remainMs);
  }
}

// Test diagnostics
export function _burstBucketSizeForTests() {
  return _keyBuckets.size;
}

export function _resetBurstBucketsForTests() {
  _keyBuckets.clear();
}

/**
 * F7a — Scope enforcement middleware factory.
 *
 * Usage: app.use('/api/v1/leads', requireScope('leads:write'), router);
 * Pass if api key has ANY of allowedScopes. Scopes stored as space-separated
 * string in api_keys.scope (set at mint time).
 */
export function requireScope(...allowedScopes) {
  return (req, res, next) => {
    const scope = req.apiKey && req.apiKey.scope;
    if (!scope) {
      return next(new BaseHttpError(403, 'API key has no scope', 'SCOPE_REQUIRED'));
    }
    const scopes = expandApiKeyScopes(scope);
    const ok = allowedScopes.some((s) => scopes.has(s));
    if (!ok) {
      return next(new BaseHttpError(
        403,
        `Scope ${allowedScopes.join('/')} required`,
        'SCOPE_INSUFFICIENT'
      ));
    }
    next();
  };
}

/**
 * F7b — Per-tenant daily quota enforcement.
 *
 * Reads api_usage_tenant_daily (migration 023). Counter is incremented
 * in requireApiKey before this middleware runs, so the count read here
 * already includes the current request.
 */
export function enforceQuota(req, res, next) {
  const plan = req.licensePlan || (req.apiKey && req.apiKey.plan) || 'community';
  const { api_calls_per_day } = getPlanQuotas(plan);
  const tenantId = req.apiKey && req.apiKey.tenant_id;
  if (!tenantId || !api_calls_per_day) return next();
  const row = _stmts().countTenantToday.get(tenantId);
  const count = (row && row.count) || 0;
  if (count > api_calls_per_day) {
    return res.status(429).json({
      ok: false,
      error: {
        code: 'QUOTA_EXCEEDED',
        message: `Daily quota exceeded (${api_calls_per_day} calls/day for ${plan})`,
        plan,
        upgrade_url: 'https://omniplug.com/pricing',
      },
    });
  }
  next();
}

/**
 * Direct test hook — drives tryKeyBurst without going through the full
 * middleware chain. Used by SEC-5 to verify LRU eviction at 10k entries.
 * Returns the boolean from tryKeyBurst so tests can also confirm token logic.
 */
export function _tryKeyBurstForTests(prefix) {
  return tryKeyBurst(prefix);
}

export function _burstBucketMaxForTests() {
  return KEY_BURST_MAX;
}
