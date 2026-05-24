import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

// v1.4.3 fix for BUG #4: bounded cache of prepared statements for dynamic
// WHERE queries (list). Same SQL → same statement, no re-parse on each request.
// Bound prevents unbounded growth under attack.
const _preparedCache = new Map();
const PREPARED_CACHE_MAX = 30;
function preparedSelect(sql) {
  let s = _preparedCache.get(sql);
  if (s) return s;
  if (_preparedCache.size >= PREPARED_CACHE_MAX) {
    const firstKey = _preparedCache.keys().next().value;
    _preparedCache.delete(firstKey);
  }
  s = db.prepare(sql);
  _preparedCache.set(sql, s);
  return s;
}

const stmt = lazyPrepare(() => ({
  insert: db.prepare(`
    INSERT INTO leads (tenant_id, name, phone, email, source, notes, user_agent, ip_address, referer)
    VALUES (@tenant_id, @name, @phone, @email, @source, @notes, @user_agent, @ip_address, @referer)
  `),
  findById: db.prepare('SELECT * FROM leads WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL'),
  findByIdAny: db.prepare('SELECT * FROM leads WHERE id = ? AND tenant_id = ?'),
  updateStatus: db.prepare(`
    UPDATE leads SET status = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  softDelete: db.prepare(`
    UPDATE leads SET deleted_at = datetime('now')
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  restore: db.prepare('UPDATE leads SET deleted_at = NULL WHERE id = ? AND tenant_id = ?'),
  countByIPLastHour: db.prepare(`
    SELECT COUNT(*) AS c FROM leads
    WHERE tenant_id = ? AND ip_address = ? AND created_at > datetime('now', '-1 hour')
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') throw new Error('leads.repository: tenantId required');
  return tenantId;
}

export const leadsRepository = {
  create(data) {
    return stmt().insert.run(data);
  },

  findById(id, tenantId) {
    return stmt().findById.get(id, requireTenant(tenantId)) || null;
  },

  findByIdAny(id, tenantId) {
    return stmt().findByIdAny.get(id, requireTenant(tenantId)) || null;
  },

  updateStatus(status, notes, id, tenantId) {
    return stmt().updateStatus.run(status, notes, id, requireTenant(tenantId));
  },

  softDelete(id, tenantId) {
    return stmt().softDelete.run(id, requireTenant(tenantId));
  },

  restore(id, tenantId) {
    return stmt().restore.run(id, requireTenant(tenantId));
  },

  countByIPLastHour(tenantId, ip) {
    return stmt().countByIPLastHour.get(requireTenant(tenantId), ip).c;
  },

  list({ tenantId, status, search, includeDeleted, limit, offset }) {
    requireTenant(tenantId);
    const where = ['tenant_id = ?'];
    const params = [tenantId];

    if (!includeDeleted) where.push('deleted_at IS NULL');
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const q = '%' + search + '%';
      params.push(q, q, q);
    }

    const whereSQL = 'WHERE ' + where.join(' AND ');
    // @cross-tenant: whereSQL is built above with tenant_id = ? as the first clause
    // v1.4.3 fix for BUG #4: cache prepared statements (was db.prepare() per request)
    const rows = preparedSelect(`SELECT * FROM leads ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    // @cross-tenant: whereSQL is built above with tenant_id = ? as the first clause
    const { total } = preparedSelect(`SELECT COUNT(*) AS total FROM leads ${whereSQL}`).get(...params);

    return { rows, total };
  },
};
