-- Migration 023: bot_crawls
-- AI bot crawl events ingested from WP plugin hourly batches.
--
-- High write volume — partition by created_at month in future migration.
-- For now, retention policy: archive rows >90 days via nightly cron.
--
-- @author Nguyễn Mạnh Quang
-- @date 2026-05-23

CREATE TABLE IF NOT EXISTS bot_crawls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id     TEXT NOT NULL,
  wp_site_id    INTEGER REFERENCES wp_sites(id) ON DELETE CASCADE,
  bot_name      TEXT NOT NULL,
  url_path      TEXT NOT NULL,
  user_agent    TEXT,
  ip_hash       TEXT,
  crawled_at    DATETIME NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Dedup at minute granularity: same bot + url + minute = single row.
  -- Compose key as bot_name|url_path|YYYY-MM-DDTHH:MM minute precision.
  dedup_key     TEXT NOT NULL,
  UNIQUE(tenant_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_crawls_tenant_time
  ON bot_crawls(tenant_id, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_crawls_tenant_bot
  ON bot_crawls(tenant_id, bot_name, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_crawls_cleanup
  ON bot_crawls(created_at);
