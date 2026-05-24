-- =====================================================================
-- v1.4.3 — Performance indexes for lead rate limit + deep pagination.
--
-- Identified during 30-tenant × 150k-lead load test (BUG report 2026-05-19).
--
-- 1. Rate-limit query (`countByIPLastHour`):
--    SELECT COUNT(*) FROM leads
--    WHERE tenant_id = ? AND ip_address = ? AND created_at > datetime('now','-1 hour')
--
--    Without this index, SQLite falls back to idx_leads_tenant_status which
--    doesn't include ip_address, so it scans every lead in the tenant. With
--    5k leads/tenant the query is ~10ms; with 50k it would degrade to
--    ~100ms+. The new composite index makes it a sub-1ms lookup regardless
--    of tenant size.
--
--    Order is (tenant_id, ip_address, created_at DESC) so that:
--    - tenant_id + ip_address use index equality lookup
--    - created_at filter uses index range scan from newest backwards
--    - Time-window comparisons (> '-1 hour') become bounded scan
--
-- 2. Admin lead inbox deep pagination:
--    Existing idx_leads_tenant_status covers (tenant_id, status, created_at DESC)
--    but doesn't help include-deleted listing or search queries. Adding a
--    covering index for the common newest-first listing case.
--
-- All indexes are IF NOT EXISTS — re-running migration is safe.
-- =====================================================================

-- 1. Rate-limit index — addresses BUG #4 from the v1.4.3 bug report.
--
-- Note: NOT a partial index. The rate-limit query in leads.repository.js
-- (`countByIPLastHour`) does NOT include `WHERE deleted_at IS NULL` — it
-- counts ALL submission attempts from an IP, even soft-deleted ones, since
-- those still represent traffic from that IP. If we made this a partial
-- index `WHERE deleted_at IS NULL`, SQLite query planner would refuse to
-- use it because the query's WHERE clause doesn't match the index predicate.
-- The trade-off is slightly larger index (includes deleted rows) for
-- correct planner selection.
CREATE INDEX IF NOT EXISTS idx_leads_tenant_ip_created
  ON leads(tenant_id, ip_address, created_at DESC);

-- 2. Deep-pagination index — partial OK here because the admin listing
--    query DOES include `WHERE deleted_at IS NULL` (verified in
--    leads.repository.js findMany). Partial index keeps it tight.
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created
  ON leads(tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 3. ANALYZE the leads table so the query planner picks up the new indexes
--    immediately on next query (instead of waiting for auto-analyze threshold).
ANALYZE leads;
