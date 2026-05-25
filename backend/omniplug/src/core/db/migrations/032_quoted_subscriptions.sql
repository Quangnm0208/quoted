-- Migration 032: subscriptions
--
-- LS subscription mirror. plan_id is OUR plan vocabulary (pro-monthly /
-- pro-yearly / agency-monthly / agency-yearly) derived from the LS
-- variant_id at webhook time. status follows LS's enum verbatim.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  lemon_subscription_id INTEGER NOT NULL UNIQUE,
  customer_id           INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id               TEXT    NOT NULL,           -- pro-monthly|pro-yearly|agency-*
  status                TEXT    NOT NULL,           -- on_trial|active|paused|past_due|cancelled|expired
  renews_at             TEXT,
  ends_at               TEXT,
  trial_ends_at         TEXT,
  update_payment_url    TEXT,
  raw_payload           TEXT    NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status   ON subscriptions(status);
