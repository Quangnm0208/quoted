import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  list: db.prepare(`
    SELECT id, email, display_name, role, tenant_id, is_active, deleted_at,
           created_at, updated_at, last_login_at
    FROM users
    WHERE tenant_id = ? AND is_active = 1 AND deleted_at IS NULL
    ORDER BY id ASC
  `),
  listIncludingInactive: db.prepare(`
    SELECT id, email, display_name, role, tenant_id, is_active, deleted_at,
           created_at, updated_at, last_login_at
    FROM users
    WHERE tenant_id = ?
    ORDER BY is_active DESC, id ASC
  `),
  findById: db.prepare(`
    SELECT id, email, display_name, role, tenant_id, is_active, deleted_at,
           created_at, updated_at, last_login_at
    FROM users WHERE id = ? AND tenant_id = ?
  `),
  findActiveById: db.prepare(`
    SELECT id, email, display_name, role, tenant_id, is_active, deleted_at,
           created_at, updated_at, last_login_at
    FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1 AND deleted_at IS NULL
  `),
  findByEmail: db.prepare('SELECT id, tenant_id, is_active FROM users WHERE email = ? COLLATE NOCASE'),
  insert: db.prepare(`
    INSERT INTO users (tenant_id, email, password_hash, display_name, role, is_active)
    VALUES (@tenant_id, @email, @password_hash, @display_name, @role, 1)
  `),
  update: db.prepare(`
    UPDATE users SET display_name = ?, role = ?, updated_at = datetime('now')
    WHERE id = ? AND tenant_id = ?
  `),
  updatePassword: db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = datetime('now')
    WHERE id = ? AND tenant_id = ?
  `),
  softDelete: db.prepare(`
    UPDATE users SET
      is_active = 0,
      deleted_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  reactivate: db.prepare(`
    UPDATE users SET
      is_active = 1,
      deleted_at = NULL,
      updated_at = datetime('now')
    WHERE id = ? AND tenant_id = ?
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') throw new Error('users.repository: tenantId required');
  return tenantId;
}

export const usersRepository = {
  list(tenantId, { includeInactive = false } = {}) {
    return includeInactive
      ? stmt().listIncludingInactive.all(requireTenant(tenantId))
      : stmt().list.all(requireTenant(tenantId));
  },

  findById(id, tenantId) {
    return stmt().findById.get(id, requireTenant(tenantId)) || null;
  },

  findActiveById(id, tenantId) {
    return stmt().findActiveById.get(id, requireTenant(tenantId)) || null;
  },

  findByEmail(email) {
    return stmt().findByEmail.get(email) || null;
  },

  create(data) {
    return stmt().insert.run(data);
  },

  update(displayName, role, id, tenantId) {
    return stmt().update.run(displayName, role, id, requireTenant(tenantId));
  },

  updatePassword(passwordHash, id, tenantId) {
    return stmt().updatePassword.run(passwordHash, id, requireTenant(tenantId));
  },

  softDelete(id, tenantId) {
    return stmt().softDelete.run(id, requireTenant(tenantId));
  },

  reactivate(id, tenantId) {
    return stmt().reactivate.run(id, requireTenant(tenantId));
  },
};
