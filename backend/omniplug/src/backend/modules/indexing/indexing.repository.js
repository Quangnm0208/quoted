/**
 * indexing/indexing.repository.js — Persistence for IndexNow submissions.
 *
 * Two responsibilities:
 *   1. CRUD on the indexing_log table (audit trail).
 *   2. Read / write the per-tenant IndexNow key, stored in site_config.
 *
 * Tenant scoping: every method requires tenantId. Same contract as the
 * rest of OmniPlug — see kb/04_tenant_model.md.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  // Atomic insert with throttle check baked in. The INSERT only fires if no
  // recent row exists. Returns lastInsertRowid > 0 only if a row was actually
  // inserted; 0/-1 means throttled.
  //
  // Why this matters (v1.4.3 fix for BUG #16 — IndexNow TOCTOU race):
  //   Previous version was SELECT-then-INSERT. Under setImmediate(submit)
  //   from the article-publish subscriber, 100 concurrent events for the
  //   same URL all saw "no recent row" and all inserted — 100 fetches to
  //   api.indexnow.org. Bing detects abuse → ban tenant's IndexNow key.
  //
  //   INSERT ... WHERE NOT EXISTS is a single SQL statement, atomic at
  //   the SQLite engine level. Even though Node is single-threaded, the
  //   N event handlers each touch the DB in sequence; by the time the 2nd
  //   handler executes, the 1st handler's INSERT is committed and the
  //   NOT EXISTS subquery sees the row.
  insertLogIfNotRecent: db.prepare(`
    INSERT INTO indexing_log
      (tenant_id, url, provider, status, is_manual)
    SELECT @tenant_id, @url, @provider, 'pending', @is_manual
    WHERE NOT EXISTS (
      SELECT 1 FROM indexing_log
      WHERE tenant_id = @tenant_id AND url = @url
        AND submitted_at > datetime('now', '-' || @threshold || ' seconds')
    )
  `),

  insertLog: db.prepare(`
    INSERT INTO indexing_log
      (tenant_id, url, provider, status, is_manual)
    VALUES
      (@tenant_id, @url, @provider, 'pending', @is_manual)
  `),

  updateLogResult: db.prepare(`
    UPDATE indexing_log SET
      status = @status,
      status_code = @status_code,
      error_message = @error_message,
      responded_at = datetime('now')
    WHERE id = @id
  `),

  listRecent: db.prepare(`
    SELECT id, url, provider, status, status_code, error_message, is_manual,
           submitted_at, responded_at
    FROM indexing_log
    WHERE tenant_id = ?
    ORDER BY submitted_at DESC
    LIMIT ? OFFSET ?
  `),

  countByTenant: db.prepare(`
    SELECT COUNT(*) AS c FROM indexing_log WHERE tenant_id = ?
  `),

  // Throttle check: did we ping this URL in the last N seconds?
  // Used to enforce the THROTTLE_LIMIT in the service layer.
  recentByUrl: db.prepare(`
    SELECT id, submitted_at FROM indexing_log
    WHERE tenant_id = ? AND url = ?
      AND submitted_at > datetime('now', '-' || ? || ' seconds')
    ORDER BY submitted_at DESC LIMIT 1
  `),

  // --- Key persistence (via site_config) ---
  // site_config stores values as JSON strings — see site.repository for
  // the convention. We use config_key = 'indexnow.key'.
  getKey: db.prepare(`
    SELECT config_value FROM site_config
    WHERE tenant_id = ? AND config_key = 'indexnow.key'
  `),

  setKey: db.prepare(`
    INSERT INTO site_config (tenant_id, config_key, config_value, label, description, updated_at)
    VALUES (?, 'indexnow.key', ?, 'IndexNow API key', 'Auto-generated key', datetime('now'))
    ON CONFLICT(tenant_id, config_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_at = datetime('now')
  `),

  getEnabledFlag: db.prepare(`
    SELECT config_value FROM site_config
    WHERE tenant_id = ? AND config_key = 'indexnow.enabled'
  `),

  // Prune helper: same pattern as audit_log.
  prune: db.prepare(`
    DELETE FROM indexing_log
    WHERE submitted_at < datetime('now', '-' || ? || ' days')
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('indexing.repository: tenantId required (got: ' + typeof tenantId + ')');
  }
  return tenantId;
}

export const indexingRepository = {
  // --- Log operations ---
  insertLog(tenantId, url, provider, isManual) {
    return stmt().insertLog.run({
      tenant_id: requireTenant(tenantId),
      url,
      provider: provider || 'indexnow',
      is_manual: isManual ? 1 : 0,
    });
  },

  updateLogResult(id, status, statusCode, errorMessage) {
    return stmt().updateLogResult.run({
      id,
      status,
      status_code: statusCode || null,
      error_message: errorMessage || null,
    });
  },

  listRecent(tenantId, limit = 50, offset = 0) {
    return stmt().listRecent.all(
      requireTenant(tenantId),
      Math.min(limit, 200),
      Math.max(offset, 0),
    );
  },

  countByTenant(tenantId) {
    const r = stmt().countByTenant.get(requireTenant(tenantId));
    return r ? r.c : 0;
  },

  recentSubmissionExists(tenantId, url, thresholdSec) {
    return !!stmt().recentByUrl.get(requireTenant(tenantId), url, thresholdSec);
  },

  // v1.4.3 fix for BUG #16: atomic throttle + insert.
  // Returns { inserted: true, id } if a new row was created; { inserted: false }
  // if a recent row already existed (= throttled). Single SQL statement, no race.
  tryInsertLog(tenantId, url, provider, isManual, thresholdSec) {
    const r = stmt().insertLogIfNotRecent.run({
      tenant_id: requireTenant(tenantId),
      url,
      provider: provider || 'indexnow',
      is_manual: isManual ? 1 : 0,
      threshold: thresholdSec,
    });
    if (r.changes === 0) {
      return { inserted: false, id: null };
    }
    return { inserted: true, id: r.lastInsertRowid };
  },

  // --- Key operations ---
  getKey(tenantId) {
    const row = stmt().getKey.get(requireTenant(tenantId));
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.config_value);
      return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  },

  setKey(tenantId, key) {
    return stmt().setKey.run(
      requireTenant(tenantId),
      JSON.stringify(key),
    );
  },

  isEnabled(tenantId) {
    const row = stmt().getEnabledFlag.get(requireTenant(tenantId));
    if (!row) return true; // default on
    try {
      const v = JSON.parse(row.config_value);
      return v === true || v === 'true' || v === 1;
    } catch {
      return true;
    }
  },

  // --- Maintenance ---
  prune(days) {
    return stmt().prune.run(Math.max(parseInt(days, 10) || 90, 7));
  },
};
