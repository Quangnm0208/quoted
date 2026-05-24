-- =============================================================================
-- 011_platform_admin_role.sql - Remove users.role CHECK constraint.
--
-- Sau migration nay DB chap nhan moi role string. src/core/lib/roles.js la
-- gate duy nhat (app-level Zod + canLogin). Khong thay doi data row nao.
--
-- v1.4: them platform_admin. v1.5: enable customer/vendor/b2b_partner login.
-- Khong can migration moi khi them role - chi sua roles.js.
-- =============================================================================

PRAGMA defer_foreign_keys = ON;

CREATE TABLE users_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,
  password_hash   TEXT    NOT NULL,
  display_name    TEXT    NOT NULL DEFAULT '',
  role            TEXT    NOT NULL DEFAULT 'editor',
  last_login_at   TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  is_active       INTEGER NOT NULL DEFAULT 1,
  deleted_at      TEXT
);

INSERT INTO users_new
  (id, email, password_hash, display_name, role, last_login_at,
   created_at, updated_at, tenant_id, is_active, deleted_at)
SELECT
  id, email, password_hash, display_name, role, last_login_at,
  created_at, updated_at, tenant_id, is_active, deleted_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
