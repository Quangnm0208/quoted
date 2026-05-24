-- =====================================================================
-- v1.4.4 — Performance indexes for public article list.
--
-- Identified during 90-tenant × 450-article load test (Fly.io 2026-05-20).
--
-- Symptom: p95 = 686ms for GET /api/public/articles?limit=10 on
-- shared-cpu-1x. EXPLAIN QUERY PLAN revealed:
--
--   SEARCH articles USING INDEX idx_articles_tenant_status (tenant_id=? AND status=?)
--   USE TEMP B-TREE FOR ORDER BY
--
-- The TEMP B-TREE is the killer — SQLite materializes all matching rows
-- (could be 100s per tenant once a real customer is in production) into
-- a sort buffer just to grab the top 10. That sort happens on every
-- request, even though the result is deterministic.
--
-- Existing index idx_articles_tenant_published (from migration 005) is
-- declared PARTIAL with predicate `WHERE deleted_at IS NULL`, but the
-- query planner doesn't always pick it because:
--   1. The query includes `status = 'published'` as a separate predicate
--   2. The partial index doesn't include status in its columns
--   3. Planner prefers the more-discriminating idx_articles_tenant_status
--
-- The fix: a covering index on (tenant_id, status, published_at DESC)
-- that includes ORDER BY columns directly. SQLite can then satisfy both
-- WHERE + ORDER BY from the index alone — no sort, no temp B-tree.
--
-- This is additive — does NOT replace the existing indexes. Re-runnable.
-- =====================================================================

-- Public article list + admin filtered list both benefit. The COALESCE
-- in the ORDER BY can't be indexed directly (SQLite indexes expressions
-- only if the expression matches exactly), so we cover the dominant case:
-- articles that ARE published always have published_at set.
CREATE INDEX IF NOT EXISTS idx_articles_tenant_status_published
  ON articles(tenant_id, status, published_at DESC)
  WHERE deleted_at IS NULL;

-- Also drop a covering index for the admin "newest" filter that uses
-- created_at. Same pattern, less hot path but still cheap to maintain.
CREATE INDEX IF NOT EXISTS idx_articles_tenant_created_at
  ON articles(tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Refresh stats so the planner sees the new indexes on next query.
ANALYZE articles;
