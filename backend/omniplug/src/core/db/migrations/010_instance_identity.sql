-- =============================================================================
-- 010_instance_identity.sql - Instance UUID for telemetry identification.
--
-- Stores a stable random UUID generated on first boot. Used by telemetry
-- heartbeat to identify unique deployments without collecting any PII.
-- =============================================================================

CREATE TABLE IF NOT EXISTS instance_identity (
  id              INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  instance_uuid   TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
