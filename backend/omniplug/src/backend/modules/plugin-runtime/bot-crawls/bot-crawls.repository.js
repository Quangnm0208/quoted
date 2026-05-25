/**
 * bot-crawls repository.
 */

import db from '../../../../core/db/connection.js';
import { lazyPrepare } from '../../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  insertIfNew: db.prepare(`
    INSERT OR IGNORE INTO bot_crawls
      (tenant_id, wp_site_id, bot_name, url_path, user_agent, ip_hash, crawled_at, dedup_key)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  countSince: db.prepare(`
    SELECT COUNT(*) AS n FROM bot_crawls WHERE tenant_id = ? AND crawled_at >= ?
  `),

  countBetween: db.prepare(`
    SELECT COUNT(*) AS n FROM bot_crawls
    WHERE tenant_id = ? AND crawled_at >= ? AND crawled_at < ?
  `),

  countUniqueBotsSince: db.prepare(`
    SELECT COUNT(DISTINCT bot_name) AS n FROM bot_crawls
    WHERE tenant_id = ? AND crawled_at >= ?
  `),

  topBotsSince: db.prepare(`
    SELECT bot_name, COUNT(*) AS count FROM bot_crawls
    WHERE tenant_id = ? AND crawled_at >= ?
    GROUP BY bot_name ORDER BY count DESC LIMIT ?
  `),

  recentCrawls: db.prepare(`
    SELECT bot_name, url_path, crawled_at FROM bot_crawls
    WHERE tenant_id = ? ORDER BY crawled_at DESC LIMIT ?
  `),

  cleanupOld: db.prepare(`
    DELETE FROM bot_crawls
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `),
}));

export function insertIfNew({ tenantId, wpSiteId, botName, urlPath, userAgent, ipHash, crawledAt, dedupKey }) {
  const result = stmt().insertIfNew.run(
    tenantId, wpSiteId, botName, urlPath, userAgent, ipHash, crawledAt, dedupKey,
  );
  return result.changes > 0;
}

export function countSince(tenantId, sinceIso) {
  return stmt().countSince.get(tenantId, sinceIso).n;
}

export function countBetween(tenantId, fromIso, toIso) {
  return stmt().countBetween.get(tenantId, fromIso, toIso).n;
}

export function countUniqueBotsSince(tenantId, sinceIso) {
  return stmt().countUniqueBotsSince.get(tenantId, sinceIso).n;
}

export function topBotsSince(tenantId, sinceIso, limit = 5) {
  return stmt().topBotsSince.all(tenantId, sinceIso, limit);
}

export function recentCrawls(tenantId, limit = 8) {
  return stmt().recentCrawls.all(tenantId, limit);
}

/**
 * Nightly cleanup hook — drops bot_crawls rows older than `days`.
 * Not called yet (no cron in Phase 0). Wire from a scheduler when retention
 * matters; until then writes accumulate but indexes make reads cheap.
 */
export function cleanupOld(days = 90) {
  return stmt().cleanupOld.run(days).changes;
}
