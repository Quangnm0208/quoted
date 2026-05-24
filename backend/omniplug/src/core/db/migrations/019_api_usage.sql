-- =====================================================================
-- v1.4.4 — API key daily usage (Migration 019)
--
-- One row per (api_key_id, day). Incremented synchronously in the
-- apiKey middleware after successful bcrypt verify. Plan quota
-- (planQuotas.js) reads this to enforce daily rolling limits.
--
-- We do NOT track per-endpoint usage in v1.4.4 — that's v1.5.0+. This
-- table only answers "how many calls did this key make today?".
-- =====================================================================

CREATE TABLE IF NOT EXISTS api_usage (
  api_key_id   INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  usage_date   TEXT    NOT NULL,                                  -- 'YYYY-MM-DD' UTC
  count        INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (api_key_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(usage_date);
