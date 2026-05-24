import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
  updateLastLogin: db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?"),
  findById: db.prepare(`
    SELECT id, email, display_name, role, tenant_id, created_at, last_login_at
    -- @cross-tenant: auth/me loads by verified JWT user id
    FROM users
    WHERE id = ?
  `),
  // @cross-tenant: password change loads by verified JWT user id
  findPasswordById: db.prepare('SELECT id, password_hash FROM users WHERE id = ?'),
  // @cross-tenant: password change updates by verified JWT user id
  updatePassword: db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"),
  tenantStatusById: db.prepare('SELECT status FROM tenants WHERE id = ?'),
}));

export const authRepository = {
  findByEmail(email) {
    return stmt().findByEmail.get(email) || null;
  },

  updateLastLogin(userId) {
    return stmt().updateLastLogin.run(userId);
  },

  findById(userId) {
    return stmt().findById.get(userId) || null;
  },

  findPasswordById(userId) {
    return stmt().findPasswordById.get(userId) || null;
  },

  updatePassword(passwordHash, userId) {
    return stmt().updatePassword.run(passwordHash, userId);
  },

  tenantStatusById(tenantId) {
    return stmt().tenantStatusById.get(tenantId) || null;
  },
};
