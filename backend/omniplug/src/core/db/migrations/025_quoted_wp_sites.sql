-- Migration 025: quoted_wp_sites
--
-- Tracks each WordPress installation connected to a tenant.
-- One tenant can have multiple wp_sites (agency case).
--
-- tenant_id is INTEGER to match OmniPlug v1.4.4 tenants(id).
-- plan, license_jti, niche are stored on this row so we can look up
-- per-site state without changing the upstream tenants table.
--
-- Renumbered from quoted/022 → 025 to avoid collision with OmniPlug 022.

CREATE TABLE IF NOT EXISTS wp_sites (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain          TEXT    NOT NULL,
  site_name       TEXT,
  admin_email     TEXT,
  wp_version      TEXT,
  plugin_version  TEXT,
  plan            TEXT    NOT NULL DEFAULT 'free',
  license_jti     TEXT,
  niche           TEXT,
  installed_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_sync_at    TEXT,
  last_seen_at    TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_wp_sites_tenant ON wp_sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wp_sites_domain ON wp_sites(domain);
CREATE INDEX IF NOT EXISTS idx_wp_sites_active ON wp_sites(is_active, last_seen_at);
