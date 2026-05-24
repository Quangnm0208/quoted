-- =====================================================================
-- v1.4.4 — API Keys (Migration 018)
--
-- One license can mint N API keys. Each key is shown to the operator
-- ONCE at mint (op_live_<prefix>_<secret>), then the secret half is
-- bcrypt-hashed at rest. Lookup at request time:
--   1. Parse prefix from header
--   2. SELECT key_hash FROM api_keys WHERE key_prefix = ?
--   3. bcrypt.compare(secret_from_header, key_hash)
--
-- The `prefix` half is intentionally indexed (cheap O(log n) lookup);
-- `key_hash` is NEVER indexed (would defeat bcrypt randomness).
--
-- Burst limits enforced by middleware (in-memory LRU), not DB.
-- =====================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  license_id      INTEGER REFERENCES licenses(id) ON DELETE SET NULL,
  key_prefix      TEXT    NOT NULL UNIQUE,              -- e.g. 'op_live_AbCdEf12' — public half
  key_hash        TEXT    NOT NULL,                     -- bcrypt hash of the secret half
  name            TEXT    NOT NULL DEFAULT '',          -- operator label, e.g. 'Re-mint 2026-05-19'
  scope           TEXT    NOT NULL DEFAULT 'sdk',       -- 'sdk' | 'crm' | 'webhook'
  status          TEXT    NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','revoked','expired')),
  last_used_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,
  revoked_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant  ON api_keys(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_api_keys_license ON api_keys(license_id);
-- key_prefix already UNIQUE → implicit index used for lookup.
