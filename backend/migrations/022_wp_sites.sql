-- Migration 022: wp_sites
-- Tracks each WordPress installation connected to a tenant.
-- One tenant can have multiple wp_sites (agency case: 30 sites under 1 tenant).
--
-- @author Nguyễn Mạnh Quang
-- @date 2026-05-23

CREATE TABLE IF NOT EXISTS wp_sites (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT NOT NULL,
  domain          TEXT NOT NULL,
  site_name       TEXT,
  admin_email     TEXT,
  wp_version      TEXT,
  plugin_version  TEXT,
  installed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sync_at    DATETIME,
  last_seen_at    DATETIME,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_wp_sites_tenant ON wp_sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wp_sites_domain ON wp_sites(domain);
CREATE INDEX IF NOT EXISTS idx_wp_sites_active ON wp_sites(is_active, last_seen_at);
