-- Migration 026: quoted_bot_crawls
--
-- AI bot crawl events ingested from WP plugin hourly batches.
-- High write volume — retention via nightly cron (see bot-crawls service).
--
-- tenant_id is INTEGER (matches OmniPlug tenants(id)). FK to wp_sites with
-- CASCADE so removing a site cleans up its crawls.

CREATE TABLE IF NOT EXISTS bot_crawls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wp_site_id    INTEGER REFERENCES wp_sites(id) ON DELETE CASCADE,
  bot_name      TEXT    NOT NULL,
  url_path      TEXT    NOT NULL,
  user_agent    TEXT,
  ip_hash       TEXT,
  crawled_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Dedup at minute granularity: bot|url|YYYY-MM-DDTHH:MM
  dedup_key     TEXT    NOT NULL,
  UNIQUE(tenant_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_crawls_tenant_time
  ON bot_crawls(tenant_id, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_crawls_tenant_bot
  ON bot_crawls(tenant_id, bot_name, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_crawls_cleanup
  ON bot_crawls(created_at);
