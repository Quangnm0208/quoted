-- =====================================================================
-- v1.4.4 — Per-tenant daily API usage counter (HR-04, Migration 023).
--
-- Migration 019 đã có api_usage(api_key_id, usage_date) cho per-key
-- counting. Nhưng plan quota (planQuotas.js api_calls_per_day) áp dụng
-- theo TENANT — tenant có thể có nhiều key share cùng quota.
--
-- Bảng riêng (additive, không alter 019) để O(1) lookup khi enforce
-- quota. Counter increment đồng thời với api_usage trong middleware
-- requireApiKey (best-effort, atomic per row).
-- =====================================================================

CREATE TABLE IF NOT EXISTS api_usage_tenant_daily (
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usage_date   TEXT    NOT NULL,                        -- 'YYYY-MM-DD' UTC
  count        INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_daily_date
  ON api_usage_tenant_daily(usage_date);
