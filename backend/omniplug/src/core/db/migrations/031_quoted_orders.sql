-- Migration 031: orders
--
-- One row per LS order. raw_payload keeps the full LS event for debugging.
-- lemon_order_id is the dedupe key — webhook idempotency relies on it.

CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  lemon_order_id      INTEGER NOT NULL UNIQUE,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount_cents        INTEGER NOT NULL,
  currency            TEXT    NOT NULL,
  status              TEXT    NOT NULL,             -- pending|paid|refunded|failed
  raw_payload         TEXT    NOT NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
