/**
 * core/lib/audit.js — Centralized audit logging (v1.4.4 context-based).
 *
 * Architecture:
 *   recordAudit(context, action, opts)
 *
 *   context = {
 *     tenantId:   number,             // required
 *     actorId:    number | null,      // null for system/anonymous
 *     actorType:  'user' | 'system' | 'job',
 *     source:     'http' | 'job' | 'system' | 'cascade',
 *     ip:         string | null,
 *     userAgent:  string | null,
 *   }
 *
 * Why context, not req:
 *   - Service layer can audit (no req available)
 *   - Background jobs can audit
 *   - Cascading mutations can audit per-entity
 *   - Test cases can construct context directly
 *
 * Backward compatibility:
 *   recordAudit(req, ...) is still accepted if the first argument has
 *   `headers` or `app` (Express request shape). It is auto-converted to a
 *   context. Existing callers continue to work; new code MUST pass context.
 *
 * Errors: audit insert failures DO NOT throw — logged via console.warn.
 *   Rationale: audit is observation, not control flow. A failed audit must
 *   not roll back the operation it was recording.
 */

import db from '../db/connection.js';
import { lazyPrepare } from '../db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  insert: db.prepare(`
    INSERT INTO audit_log
      (user_id, tenant_id, action, entity_type, entity_id, ip_address, metadata_json)
    VALUES
      (@user_id, @tenant_id, @action, @entity_type, @entity_id, @ip_address, @metadata_json)
  `),
}));

/**
 * Detect: is this an Express request, or a context object?
 * Express requests carry `app` and `headers`. Context objects don't.
 */
function isExpressRequest(obj) {
  return obj && typeof obj === 'object' &&
         (obj.app !== undefined || obj.headers !== undefined);
}

/**
 * Build context from Express request. Use this in controllers; the controller
 * is the only place that has `req` access.
 */
export function auditContextFromRequest(req) {
  return {
    tenantId:  req?.tenantId ?? null,
    actorId:   req?.user?.id ?? null,
    actorType: req?.user ? 'user' : 'system',
    source:    'http',
    ip:        req?.ip ?? null,
    userAgent: req?.get?.('user-agent') ?? null,
  };
}

/**
 * Build context for a background job. Jobs do not have `req`. Caller MUST
 * supply tenantId — the job system is responsible for knowing which tenant
 * it is acting for.
 */
export function auditContextFromJob({ tenantId, jobName, actorId = null }) {
  if (tenantId === undefined || tenantId === null) {
    throw new Error('auditContextFromJob: tenantId is required');
  }
  return {
    tenantId,
    actorId,
    actorType: 'job',
    source:    'job',
    ip:        `job:${jobName}`,
    userAgent: null,
  };
}

/**
 * Build context for a system action (migration, cleanup, internal cascade).
 * tenantId may be null for global system events (vd. schema migration), but
 * for tenant-scoped system actions (vd. cron clean tenant data) it must be set.
 */
export function auditContextSystem({ tenantId = null, reason }) {
  if (!reason) {
    throw new Error('auditContextSystem: reason is required (audit trail integrity)');
  }
  return {
    tenantId,
    actorId:   null,
    actorType: 'system',
    source:    'system',
    ip:        `system:${reason}`,
    userAgent: null,
  };
}

/**
 * Record audit log entry.
 *
 * @param {object} contextOrReq  - context object (preferred) OR Express req (legacy)
 * @param {string} action        - vd: 'article.create', 'auth.login.fail'
 * @param {object} opts          - { entityType, entityId, metadata }
 */
export function recordAudit(contextOrReq, action, opts = {}) {
  // Auto-convert if caller passed an Express request (transitional support).
  const ctx = isExpressRequest(contextOrReq)
    ? auditContextFromRequest(contextOrReq)
    : contextOrReq;

  if (!ctx || typeof ctx !== 'object') {
    console.warn('[audit] recordAudit called without context. action=' + action);
    return;
  }

  try {
    stmt().insert.run({
      user_id:       ctx.actorId,
      tenant_id:     ctx.tenantId,
      action,
      entity_type:   opts.entityType || null,
      entity_id:     opts.entityId || null,
      ip_address:    ctx.ip,
      metadata_json: JSON.stringify({
        ...(opts.metadata || {}),
        // Audit context envelope — makes async/cascading audit traceable
        _source:    ctx.source,
        _actor:     ctx.actorType,
        _userAgent: ctx.userAgent || undefined,
      }),
    });
  } catch (err) {
    console.warn('[audit] insert failed:', err.message, { action, tenant: ctx.tenantId });
  }
}

/**
 * @deprecated since v1.2 — use `recordAudit(auditContextSystem({...}), action, opts)`.
 * Kept for backward compatibility. Will be removed in a future breaking release.
 */
export function recordSystemAudit(action, opts = {}) {
  recordAudit(
    auditContextSystem({ tenantId: opts.tenantId ?? null, reason: opts.reason || 'unknown' }),
    action,
    opts
  );
}

/**
 * Prune audit_log records older than retention period.
 * Batch 1000 rows de tranh lock SQLite lau. Goi 1 lan khi startup.
 */
export function pruneOldAuditLog(retentionDays = 180) {
  try {
    const cutoff = `-${retentionDays} days`;
    // @cross-tenant: startup retention prune is a global maintenance job.
    const result = db.prepare(`
      -- @cross-tenant: startup retention prune is a global maintenance job.
      DELETE FROM audit_log
      WHERE id IN (
        -- @cross-tenant: startup retention prune is a global maintenance job.
        SELECT id FROM audit_log
        WHERE created_at < datetime('now', ?)
        LIMIT 1000
      )
    `).run(cutoff);
    if (result.changes > 0) {
      console.log(`[audit] Pruned ${result.changes} old audit_log rows (>${retentionDays}d)`);
    }
  } catch (err) {
    console.warn('[audit] pruneOldAuditLog failed:', err.message);
  }
}

// =============================================================================
// Query API (admin dashboard)
// =============================================================================

export const auditQuery = {
  /**
   * List audit entries for ONE tenant. tenantId is required — passing
   * undefined throws. To query across tenants (platform admin tooling), use
   * `listAcrossTenants()` explicitly.
   *
   * This separation makes cross-tenant access a deliberate API choice, not
   * an accidental default.
   */
  list({ tenantId, limit = 100, offset = 0, action, userId, since } = {}) {
    if (tenantId === undefined || tenantId === null) {
      throw new Error(
        'auditQuery.list: tenantId is required. Use listAcrossTenants() ' +
        'for platform-admin cross-tenant queries.'
      );
    }
    const where = ['a.tenant_id = ?'];
    const params = [tenantId];

    if (action) {
      if (action.endsWith('.')) {
        where.push('a.action LIKE ?'); params.push(action + '%');
      } else {
        where.push('a.action = ?'); params.push(action);
      }
    }
    if (userId) { where.push('a.user_id = ?'); params.push(userId); }
    if (since)  { where.push('a.created_at > ?'); params.push(since); }
    const whereSQL = 'WHERE ' + where.join(' AND ');

    return runAuditListQuery(whereSQL, params, limit, offset);
  },

  /**
   * Platform-admin only. Caller MUST verify the actor has platform-level
   * authority before invoking. There is no tenant filter — all rows
   * returned regardless of tenant.
   *
   * Separated from `list()` so cross-tenant access cannot happen by
   * accidentally omitting a parameter.
   */
  listAcrossTenants({ limit = 100, offset = 0, action, userId, since } = {}) {
    const where = [];
    const params = [];
    if (action) {
      if (action.endsWith('.')) {
        where.push('a.action LIKE ?'); params.push(action + '%');
      } else {
        where.push('a.action = ?'); params.push(action);
      }
    }
    if (userId) { where.push('a.user_id = ?'); params.push(userId); }
    if (since)  { where.push('a.created_at > ?'); params.push(since); }
    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    return runAuditListQuery(whereSQL, params, limit, offset);
  },
};

function runAuditListQuery(whereSQL, params, limit, offset) {
  const sql = `
    SELECT a.*, u.email AS user_email
    -- @cross-tenant: scope enforced by caller (see list/listAcrossTenants)
    FROM audit_log a
    -- @cross-tenant: users join is by id only, role-checked above
    LEFT JOIN users u ON u.id = a.user_id
    ${whereSQL}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...params, limit, offset);
  // @cross-tenant: same whereSQL as above (caller-enforced)
  const countSQL = `SELECT COUNT(*) AS c FROM audit_log a ${whereSQL}`;
  const { c } = db.prepare(countSQL).get(...params);
  return { rows, total: c, limit, offset };
}
