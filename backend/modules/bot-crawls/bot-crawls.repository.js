/**
 * bot-crawls repository.
 *
 * @module bot-crawls/repository
 */

import { getDb } from '../../../core/db/connection.js';

let stmts = null;

function prepare() {
  if (stmts) return stmts;
  const db = getDb();

  stmts = {
    insertIfNew: db.prepare(`
      INSERT OR IGNORE INTO bot_crawls
        (tenant_id, wp_site_id, bot_name, url_path, user_agent, ip_hash, crawled_at, dedup_key)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
    `),

    countSince: db.prepare(`
      SELECT COUNT(*) AS n
      FROM bot_crawls
      WHERE tenant_id = ? AND crawled_at >= ?
    `),

    countBetween: db.prepare(`
      SELECT COUNT(*) AS n
      FROM bot_crawls
      WHERE tenant_id = ? AND crawled_at >= ? AND crawled_at < ?
    `),

    countUniqueBotsSince: db.prepare(`
      SELECT COUNT(DISTINCT bot_name) AS n
      FROM bot_crawls
      WHERE tenant_id = ? AND crawled_at >= ?
    `),

    topBotsSince: db.prepare(`
      SELECT bot_name, COUNT(*) AS count
      FROM bot_crawls
      WHERE tenant_id = ? AND crawled_at >= ?
      GROUP BY bot_name
      ORDER BY count DESC
      LIMIT ?
    `),

    recentCrawls: db.prepare(`
      SELECT bot_name, url_path, crawled_at
      FROM bot_crawls
      WHERE tenant_id = ?
      ORDER BY crawled_at DESC
      LIMIT ?
    `),

    cleanupOld: db.prepare(`
      DELETE FROM bot_crawls
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `),
  };

  return stmts;
}

// ─── Public API ──────────────────────────────────────────────────────

export function insertIfNew({ tenantId, wpSiteId, botName, urlPath, userAgent, ipHash, crawledAt, dedupKey }) {
  const result = prepare().insertIfNew.run(
    tenantId, wpSiteId, botName, urlPath, userAgent, ipHash, crawledAt, dedupKey
  );
  return result.changes > 0;
}

export function countSince(tenantId, sinceIso) {
  return prepare().countSince.get(tenantId, sinceIso).n;
}

export function countBetween(tenantId, fromIso, toIso) {
  return prepare().countBetween.get(tenantId, fromIso, toIso).n;
}

export function countUniqueBotsSince(tenantId, sinceIso) {
  return prepare().countUniqueBotsSince.get(tenantId, sinceIso).n;
}

export function topBotsSince(tenantId, sinceIso, limit = 5) {
  return prepare().topBotsSince.all(tenantId, sinceIso, limit);
}

export function recentCrawls(tenantId, limit = 8) {
  return prepare().recentCrawls.all(tenantId, limit);
}

/**
 * Nightly cleanup hook — drop rows older than `days`.
 */
export function cleanupOld(days = 90) {
  const result = prepare().cleanupOld.run(days);
  return result.changes;
}
