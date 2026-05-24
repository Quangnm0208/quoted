-- =====================================================================
-- v1.4.4 — Tenant ↔ License linkage (Migration 017)
--
-- Each tenant points to at most one active license. We cache `plan` on
-- the tenant row to keep the hot path (every API request) free of any
-- JOIN to `licenses`. The cache is refreshed by the license middleware
-- when it verifies the JWT (every 60s via in-process cache).
--
-- All columns NULLABLE so existing single-tenant rows continue to work
-- in "community" mode without a license — the licenseGate middleware
-- treats NULL plan as `community` for free-tier limits.
-- =====================================================================

ALTER TABLE tenants ADD COLUMN license_id        INTEGER REFERENCES licenses(id) ON DELETE SET NULL;
ALTER TABLE tenants ADD COLUMN plan_cached       TEXT;                  -- cached from licenses.plan
ALTER TABLE tenants ADD COLUMN plan_checked_at   TEXT;                  -- ISO timestamp of last verification

CREATE INDEX IF NOT EXISTS idx_tenants_license_id ON tenants(license_id);
