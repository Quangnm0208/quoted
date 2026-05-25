-- Migration 034: entitlements
--
-- The "what is this customer allowed to do" cache. Computed from
-- subscription + license at webhook time and refreshed on validate.
-- The plugin reads features_json (e.g. {"live_test": true, "citations": "pro"})
-- to render its admin UI without round-tripping to LS.

CREATE TABLE IF NOT EXISTS entitlements (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_license_id INTEGER NOT NULL REFERENCES customer_licenses(id) ON DELETE CASCADE,
  plan_id             TEXT    NOT NULL,
  feature_flags_json  TEXT    NOT NULL DEFAULT '{}',
  quota_json          TEXT    NOT NULL DEFAULT '{}',
  status              TEXT    NOT NULL,             -- active|expired|disabled
  source              TEXT    NOT NULL DEFAULT 'lemonsqueezy',
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, customer_license_id)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements(status);
