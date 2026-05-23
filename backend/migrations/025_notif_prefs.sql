-- Migration 025: notif_prefs
-- Per-tenant notification preferences (push, email digest cadence, etc.).
-- Populated lazily — absence of row = use defaults.
--
-- @author Nguyễn Mạnh Quang
-- @date 2026-05-23

CREATE TABLE IF NOT EXISTS notif_prefs (
  tenant_id          TEXT PRIMARY KEY,
  push_enabled       INTEGER NOT NULL DEFAULT 1,
  email_daily        INTEGER NOT NULL DEFAULT 0,
  email_weekly       INTEGER NOT NULL DEFAULT 1,
  citation_alert     INTEGER NOT NULL DEFAULT 1,
  bot_crawl_alert    INTEGER NOT NULL DEFAULT 0,  -- noisy by default; off
  quiet_hours_json   TEXT,  -- JSON: {"start": 22, "end": 8, "tz": "America/New_York"}
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Also add a column to wp_sites for the niche (set during onboarding).
-- Defensive ALTER — only adds if not present (idempotent at runtime).
-- Note: SQLite doesn't support "ADD COLUMN IF NOT EXISTS" — runner handles this.
ALTER TABLE wp_sites ADD COLUMN niche TEXT;
