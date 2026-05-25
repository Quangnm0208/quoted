-- Migration 037: live_test_usage
--
-- Per-tenant monthly counter for /api/v1/live-test/query calls. Used to
-- enforce the free-tier 3/month and pro-tier 100/month soft cap from
-- docs/API-CONTRACT.md §"Live AI Test".
--
-- One row per (tenant, year_month). Increment on each successful query.
-- Reset implicit — querying a new month creates a new row.

CREATE TABLE IF NOT EXISTS live_test_usage (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year_month      TEXT    NOT NULL,             -- 'YYYY-MM' (UTC)
  used_count      INTEGER NOT NULL DEFAULT 0,
  last_used_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_live_test_usage_tenant_month
  ON live_test_usage(tenant_id, year_month DESC);
