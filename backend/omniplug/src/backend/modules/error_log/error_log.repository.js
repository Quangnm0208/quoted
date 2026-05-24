/**
 * error_log/error_log.repository.js — 404 hit aggregation persistence.
 *
 * Storage model: one row per (tenant_id, uri) — aggregated, not per-event.
 * The hot path is an UPSERT that increments `hits` if the row exists.
 *
 * Why upsert and not separate insert+update:
 *   The middleware fires once per 404 request. Doing SELECT + (INSERT
 *   or UPDATE) is two DB roundtrips + a race. SQLite's
 *   ON CONFLICT(...) DO UPDATE is one statement, no race.
 *
 * Concurrency: better-sqlite3 is synchronous and serializes writes, so
 * even with the batched buffer in error_log.cache.js we're safe.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  upsert: db.prepare(`
    INSERT INTO error_404_log
      (tenant_id, uri, hits, last_referer, last_user_agent)
    VALUES
      (@tenant_id, @uri, @hits, @referer, @user_agent)
    ON CONFLICT(tenant_id, uri) DO UPDATE SET
      hits = hits + excluded.hits,
      last_referer = COALESCE(excluded.last_referer, last_referer),
      last_user_agent = COALESCE(excluded.last_user_agent, last_user_agent),
      last_seen_at = datetime('now')
  `),

  listForAdmin: db.prepare(`
    SELECT id, uri, hits, last_referer, last_user_agent, is_ignored,
           first_seen_at, last_seen_at
    FROM error_404_log
    WHERE tenant_id = ?
      AND (is_ignored = 0 OR ? = 1)
    ORDER BY last_seen_at DESC
    LIMIT ? OFFSET ?
  `),

  count: db.prepare(`
    SELECT COUNT(*) AS c FROM error_404_log
    WHERE tenant_id = ? AND (is_ignored = 0 OR ? = 1)
  `),

  setIgnored: db.prepare(`
    UPDATE error_404_log SET is_ignored = ?
    WHERE id = ? AND tenant_id = ?
  `),

  deleteRow: db.prepare(`
    DELETE FROM error_404_log WHERE id = ? AND tenant_id = ?
  `),

  prune: db.prepare(`
    DELETE FROM error_404_log
    WHERE last_seen_at < datetime('now', '-' || ? || ' days')
      AND is_ignored = 0
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('error_log.repository: tenantId required');
  }
  return tenantId;
}

export const errorLogRepository = {
  /**
   * Batch upsert. Takes an array of { tenant_id, uri, hits, referer, user_agent }.
   *
   * v1.4.3 fix for BUG #10: Previously wrapped in db.transaction(items).
   * If one row had a FK violation (e.g. tenant deleted between buffer-add and
   * flush), the entire transaction rolled back, losing all OTHER tenants'
   * legitimate 404 events in the same batch.
   *
   * New behaviour: per-row try/catch. Bad rows are skipped and counted; the
   * rest still commit. The flush stays inside one transaction for speed
   * (avoids fsync per row), but uses SAVEPOINT around each upsert so an
   * individual failure only rolls back that one savepoint.
   *
   * Returns { upserted: <int>, skipped: <int>, errors: [<msg>] }
   */
  batchUpsert(entries) {
    if (!entries || entries.length === 0) {
      return { upserted: 0, skipped: 0, errors: [] };
    }
    let upserted = 0;
    let skipped = 0;
    const errors = [];

    db.exec('BEGIN');
    try {
      for (const it of entries) {
        // SAVEPOINT lets us roll back just this one row on FK fail.
        db.exec('SAVEPOINT row');
        try {
          stmt().upsert.run({
            tenant_id: it.tenant_id,
            uri: it.uri,
            hits: it.hits,
            referer: it.referer ? String(it.referer).slice(0, 500) : null,
            user_agent: it.user_agent ? String(it.user_agent).slice(0, 300) : null,
          });
          db.exec('RELEASE row');
          upserted++;
        } catch (err) {
          db.exec('ROLLBACK TO row');
          db.exec('RELEASE row');
          skipped++;
          // Don't push every error message — bound the array
          if (errors.length < 5) errors.push(`tenant=${it.tenant_id} uri=${it.uri}: ${err.message}`);
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      // Only reaches here on BEGIN/COMMIT errors themselves (not per-row).
      try { db.exec('ROLLBACK'); } catch { /* nested rollback */ }
      throw err;
    }
    return { upserted, skipped, errors };
  },

  listForAdmin(tenantId, limit = 50, offset = 0, includeIgnored = false) {
    const includeFlag = includeIgnored ? 1 : 0;
    const tid = requireTenant(tenantId);
    return {
      rows: stmt().listForAdmin.all(tid, includeFlag, Math.min(limit, 200), Math.max(offset, 0)),
      total: stmt().count.get(tid, includeFlag).c,
    };
  },

  setIgnored(id, tenantId, ignored) {
    return stmt().setIgnored.run(ignored ? 1 : 0, id, requireTenant(tenantId));
  },

  deleteRow(id, tenantId) {
    return stmt().deleteRow.run(id, requireTenant(tenantId));
  },

  prune(days) {
    return stmt().prune.run(Math.max(parseInt(days, 10) || 90, 7));
  },
};
