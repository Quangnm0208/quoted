-- Migration 030: customers (commercial layer)
--
-- One row per Lemon Squeezy customer. Identity = email (case-insensitive),
-- with lemon_customer_id as the join key against LS webhook payloads.
-- We never store payment cards or PII beyond email + name + LS's customer id.

CREATE TABLE IF NOT EXISTS customers (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email               TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name                TEXT,
  lemon_customer_id   INTEGER UNIQUE,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_lemon ON customers(lemon_customer_id);
