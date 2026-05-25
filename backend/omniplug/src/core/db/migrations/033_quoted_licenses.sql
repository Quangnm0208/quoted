-- Migration 033: customer_licenses (commercial layer)
--
-- NOT to be confused with upstream `licenses` (mig 016), which stores the
-- operator-issued OmniPlug deployment license. `customer_licenses` stores
-- LS-issued per-customer license keys (one per purchase).
--
-- LS issues UUID license keys ("8a7b6c5d-..."). We never store the plaintext.
--   license_key_hash  = sha256(uuid)             — lookup key for /activate
--   license_key_short = first 8 chars + "..."    — for admin/plugin display
--
-- activation_limit comes from the LS variant config.
-- instances_count is maintained by webhook + our own activate/deactivate.

CREATE TABLE IF NOT EXISTS customer_licenses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  lemon_license_id    INTEGER NOT NULL UNIQUE,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id     INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  license_key_hash    TEXT    NOT NULL,
  license_key_short   TEXT    NOT NULL,
  status              TEXT    NOT NULL,             -- active|expired|disabled
  activation_limit    INTEGER NOT NULL DEFAULT 1,
  instances_count     INTEGER NOT NULL DEFAULT 0,
  expires_at          TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_licenses_hash      ON customer_licenses(license_key_hash);
CREATE INDEX IF NOT EXISTS idx_customer_licenses_customer  ON customer_licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_licenses_status    ON customer_licenses(status);
