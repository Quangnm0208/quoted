-- =====================================================================
-- v1.2 Soft delete users + Tenant archive safety (Migration 006)
--
-- Goal: prevent destructive admin operations.
--
-- Changes:
--   1. users — add `is_active` + `deleted_at` columns
--   2. (admin endpoint changes in controller, không schema change)
--      - DELETE /api/admin/users/:id → soft delete (UPDATE) thay vì DELETE row
--      - DELETE /api/admin/tenants/:id → status='archived' thay vì DELETE row
--
--   3. NO schema changes for tenant CASCADE — giữ ON DELETE CASCADE để DBA
--      vẫn có thể manual SQL purge (super_admin operation, ngoài admin UI).
--      Admin UI chỉ archive, không trigger CASCADE.
--
-- Idempotent: dùng ALTER TABLE ADD COLUMN với defaults.
-- =====================================================================

-- 1. Add is_active + deleted_at to users
ALTER TABLE users ADD COLUMN is_active   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN deleted_at  TEXT;

CREATE INDEX IF NOT EXISTS idx_users_is_active  ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
