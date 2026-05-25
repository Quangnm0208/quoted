/**
 * core/rateLimit.js - SQLite-backed rate limiter.
 *
 * Rate limiting lives inside SQLite to avoid extra infrastructure.
 *
 * Strategies:
 *   1. checkAuthRateLimit: auth_attempts table, tracked by IP and email.
 *   2. checkGenericLimit: time-windowed count against whitelisted tables.
 *
 * Cleanup: pruneOldAttempts() removes auth attempts older than 30 days.
 */

import db from '../db/connection.js';
import { HttpError } from './asyncHandler.js';

let _stmt = null;
function stmt() {
  if (_stmt) return _stmt;
  _stmt = {
    insertAuth: db.prepare(`
      INSERT INTO auth_attempts (email, ip_address, success, user_agent)
      VALUES (?, ?, ?, ?)
    `),
    countFailsByIP: db.prepare(`
      SELECT COUNT(*) AS c FROM auth_attempts
      WHERE ip_address = ? AND success = 0 AND created_at > datetime('now', ?)
    `),
    countFailsByEmail: db.prepare(`
      SELECT COUNT(*) AS c FROM auth_attempts
      WHERE email = ? AND success = 0 AND created_at > datetime('now', ?)
    `),
    pruneOld: db.prepare(`
      DELETE FROM auth_attempts WHERE created_at < datetime('now', '-30 days')
    `),
  };
  return _stmt;
}

export const AUTH_LIMITS = {
  ipMax: 5,
  ipWindow: '-15 minutes',
  emailMax: 10,
  emailWindow: '-1 hour',
};

export function checkAuthRateLimit(email, ip) {
  if (!ip) return;

  // Dev-mode localhost exemption (same rationale as rateLimiterIp.js).
  // Tests at 127.0.0.1 do many intentional-failure logins per suite to
  // verify error paths; without this, OmniPlug Smoke + Quoted commercial
  // suites accumulate failures across runs → next test hits RATE_LIMITED_IP.
  // Production traffic never originates from 127.0.0.1.
  if (process.env.NODE_ENV !== 'production' &&
      (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
    return;
  }

  const ipFails = stmt().countFailsByIP.get(ip, AUTH_LIMITS.ipWindow).c;
  if (ipFails >= AUTH_LIMITS.ipMax) {
    throw new HttpError(
      429,
      'Too many failed login attempts from this IP. Try again later.',
      'RATE_LIMITED_IP'
    );
  }

  if (email) {
    const emailFails = stmt().countFailsByEmail.get(email, AUTH_LIMITS.emailWindow).c;
    if (emailFails >= AUTH_LIMITS.emailMax) {
      throw new HttpError(
        429,
        'This account is temporarily rate limited after failed login attempts.',
        'RATE_LIMITED_EMAIL'
      );
    }
  }
}

export function recordAuthAttempt(email, ip, success, userAgent) {
  try {
    stmt().insertAuth.run(
      email || null,
      ip || 'unknown',
      success ? 1 : 0,
      String(userAgent || '').slice(0, 500)
    );
  } catch (e) {
    console.warn('[rateLimit] insertAuth failed:', e.message);
  }
}

export function checkGenericLimit(table, ipColumn, ipValue, maxPerHour, label = 'request') {
  if (!ipValue) return;
  const ALLOWED = {
    media: { uploaded_by: true, ip_address: true },
    leads: { ip_address: true },
    articles: { author_id: true },
  };
  if (!ALLOWED[table] || !ALLOWED[table][ipColumn]) {
    throw new Error('Invalid table/column for rate limit: ' + table + '.' + ipColumn);
  }

  const sql = `
    SELECT COUNT(*) AS c FROM ${table}
    WHERE ${ipColumn} = ? AND created_at > datetime('now', '-1 hour')
  `;
  const { c } = db.prepare(sql).get(ipValue);
  if (c >= maxPerHour) {
    throw new HttpError(
      429,
      `Too many ${label} requests. Try again later.`,
      'RATE_LIMITED'
    );
  }
}

export function pruneOldAttempts() {
  try {
    const info = stmt().pruneOld.run();
    if (info.changes > 0) {
      console.log(`Pruned ${info.changes} old auth_attempts rows`);
    }
  } catch (e) {
    console.warn('[rateLimit] prune failed:', e.message);
  }
}
