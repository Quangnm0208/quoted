-- =====================================================================
-- v1.4.4 — License Core (Migration 016)
--
-- One signed JWT per customer deployment, verified locally by the
-- operator public key. Tenants link to a license; licenses can be
-- revoked via license_revocations.
--
-- This migration creates the two tables. Tenant linkage is in 017.
--
-- @cross-tenant: licenses table is intentionally global (single-instance
-- deployment of OmniPlug CMS Core has its own license/key). The
-- tenant_id FK column is present so multi-tenant operator instances
-- (future v1.5.0+) can host multiple licenses on one process.
-- =====================================================================

CREATE TABLE IF NOT EXISTS licenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  jti             TEXT    NOT NULL UNIQUE,           -- JWT id (unique per issued license)
  raw_jwt         TEXT    NOT NULL,                  -- the full signed JWT, for re-verification + DR
  plan            TEXT    NOT NULL                   -- 'community' | 'lite' | 'standard' | 'pro' | 'pro_plus'
                  CHECK (plan IN ('community','lite','standard','pro','pro_plus')),
  signed_for      TEXT,                              -- domain the license is bound to (e.g. 'example.com')
  customer_name   TEXT    NOT NULL DEFAULT '',       -- human-readable label, for op listings
  customer_email  TEXT    NOT NULL DEFAULT '',       -- for support contact (not used at runtime)
  issued_at       TEXT    NOT NULL,                  -- ISO timestamp from JWT iat (not server clock)
  expires_at      TEXT,                              -- ISO timestamp from JWT exp (NULL = perpetual)
  features_json   TEXT    NOT NULL DEFAULT '{}',     -- plan-specific feature flags, optional
  status          TEXT    NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','expired','revoked')),
  tenant_id       INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_licenses_status      ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant      ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at  ON licenses(expires_at) WHERE expires_at IS NOT NULL;

-- license_revocations — local CRL cache.
-- Populated by manual `POST /api/admin/license/sync-crl` until Bridge
-- (v1.5.0) provides automatic distribution.
CREATE TABLE IF NOT EXISTS license_revocations (
  jti             TEXT    PRIMARY KEY,
  revoked_at      TEXT    NOT NULL,
  reason          TEXT    NOT NULL DEFAULT '',
  synced_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
