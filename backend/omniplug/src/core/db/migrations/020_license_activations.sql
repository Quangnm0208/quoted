-- =====================================================================
-- v1.4.4 — License activations / replay detection (Migration 020)
--
-- Records every successful POST /api/admin/license/activate.
-- If activation_count for a `jti` > 1, alert via audit
-- (license.activation.replay_suspected) — could indicate:
--   - Legitimate re-activation on the same tenant after data wipe (OK)
--   - DB leak: same JWT being activated on a different tenant (BAD)
-- =====================================================================

CREATE TABLE IF NOT EXISTS license_activations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  jti                   TEXT    NOT NULL,
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  activated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  activated_by_user_id  INTEGER REFERENCES users(id),
  ip_address            TEXT,
  user_agent            TEXT
);

CREATE INDEX IF NOT EXISTS idx_license_act_jti    ON license_activations(jti);
CREATE INDEX IF NOT EXISTS idx_license_act_tenant ON license_activations(tenant_id);
