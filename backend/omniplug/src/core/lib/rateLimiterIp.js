/**
 * core/lib/rateLimiterIp.js — Per-IP token bucket, LRU bounded.
 *
 * v1.4.4 — see PROMPT v1.4.4 §3 SEC-3.
 *
 * Purpose: stop the bcrypt DoS amplifier on /api/v1/* (API-key middleware).
 * Without this, 60 req/s with bogus API keys = 60 bcrypt.compare per second
 * = a single CPU saturated by a single attacker. With this, the IP can fire
 * 60 req/min total → 1 req/s sustained → 1 bcrypt/s → 100ms CPU per second.
 *
 * Design:
 *   - In-process Map keyed by `req.ip` (post-trust-proxy normalization).
 *   - Each bucket: { tokens, lastRefill }.
 *   - Refill: tokens += elapsed_ms/60_000 * capacity, capped at capacity.
 *   - Max 10,000 keys (~1.5 MB). LRU eviction by `lastRefill` ascending
 *     when at cap.
 *   - Capacity default 60 (req/min). Caller can override per-call.
 *
 * Limitations:
 *   - Per-process. Multiple workers = multiplied effective limit. For
 *     single-host SQLite deployment this is fine; multi-host is v1.5.0+.
 *   - No persistence: bucket resets on reboot. That's a feature — the
 *     bucket exists to dampen sustained abuse, not to remember good
 *     citizens forever.
 */

const DEFAULT_CAPACITY = 60;      // tokens per minute
const REFILL_WINDOW_MS = 60_000;  // 1 minute
const MAX_BUCKETS = 10_000;       // SEC-5 (memory)

const _buckets = new Map();       // ip → { tokens, lastRefill, capacity }

function evictOldest() {
  // Find single oldest by `lastRefill`. O(n) but only runs when at cap,
  // and capacity is 10k so this is cheap in practice. If profiling
  // shows this hot, swap to a proper LRU (linked-list Map).
  let oldestKey = null;
  let oldestTs = Infinity;
  for (const [k, v] of _buckets) {
    if (v.lastRefill < oldestTs) {
      oldestTs = v.lastRefill;
      oldestKey = k;
    }
  }
  if (oldestKey != null) _buckets.delete(oldestKey);
}

/**
 * Attempt to consume one token from `ip`'s bucket.
 * Returns true if allowed, false if rate-limited.
 *
 * @param {string} ip       - the client IP (or 'unknown' if not resolvable)
 * @param {number} capacity - max burst within the 60s window (default 60)
 */
export function tryAcquire(ip, capacity = DEFAULT_CAPACITY) {
  const key = ip || 'unknown';
  const now = Date.now();
  let b = _buckets.get(key);

  if (!b) {
    if (_buckets.size >= MAX_BUCKETS) evictOldest();
    b = { tokens: capacity, lastRefill: now, capacity };
    _buckets.set(key, b);
  } else {
    // Refill proportional to elapsed time
    const elapsed = now - b.lastRefill;
    if (elapsed > 0) {
      const refill = (elapsed / REFILL_WINDOW_MS) * b.capacity;
      b.tokens = Math.min(b.capacity, b.tokens + refill);
      b.lastRefill = now;
    }
    // refresh LRU position: re-insert
    _buckets.delete(key);
    _buckets.set(key, b);
  }

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

/**
 * Test/diagnostic — return current bucket count. Used by SEC-3 / SEC-5
 * red-team tests to verify LRU bound holds.
 */
export function _sizeForTests() {
  return _buckets.size;
}

export function _resetForTests() {
  _buckets.clear();
}

export const rateLimitPerIp = { tryAcquire };
