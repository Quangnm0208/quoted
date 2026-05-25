-- Migration 035: webhook_events
--
-- Idempotency log for incoming LS webhooks. event_id is LS's webhook event
-- UUID — the UNIQUE constraint is what makes duplicate delivery safe:
-- the handler tries INSERT and bails out on conflict.
--
-- raw_payload is kept indefinitely for replay/debug. Trim with a retention
-- cron later (mirrors the existing audit_log retention pattern).

CREATE TABLE IF NOT EXISTS webhook_events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id            TEXT    NOT NULL UNIQUE,
  event_name          TEXT    NOT NULL,             -- order_created, subscription_updated, license_*
  signature_valid     INTEGER NOT NULL,
  processed           INTEGER NOT NULL DEFAULT 0,
  raw_payload         TEXT    NOT NULL,
  received_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  processed_at        TEXT,
  error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_name     ON webhook_events(event_name, received_at DESC);
