-- Migration 028: quoted_notif_prefs
--
-- Per-tenant notification preferences. Absence of row = use defaults.
-- (The niche column on wp_sites is created up-front in migration 025;
-- the original ALTER from quoted/025 is removed because SQLite does not
-- support "ADD COLUMN IF NOT EXISTS" and a re-run would fail.)

CREATE TABLE IF NOT EXISTS notif_prefs (
  tenant_id          INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  push_enabled       INTEGER NOT NULL DEFAULT 1,
  email_daily        INTEGER NOT NULL DEFAULT 0,
  email_weekly       INTEGER NOT NULL DEFAULT 1,
  citation_alert     INTEGER NOT NULL DEFAULT 1,
  bot_crawl_alert    INTEGER NOT NULL DEFAULT 0,  -- noisy by default; off
  quiet_hours_json   TEXT,  -- {"start": 22, "end": 8, "tz": "America/New_York"}
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
