-- =============================================================================
-- 009_industry_flex.sql — Remove industry-specific CHECK constraints.
--
-- v1.2.0 makes status enum + progress_pct constraint app-level rather than
-- DB-level, so the same codebase can deploy as spa / branding / real-estate
-- without per-industry migration files.
--
-- Behavior preserved: BĐS deployments (INDUSTRY=real-estate, default) keep
-- the same status values. The app-level state machine (industry-aware) still
-- rejects invalid status values, just at the service layer instead of DB.
--
-- Why not industry-specific migration files?
--   Per-industry migrations would split the codebase by deployment target.
--   App-level validation keeps the schema universal + behavior strict.
--
-- Safety:
--   - Wrapped in transaction (migrate.js auto-wraps every .sql file)
--   - defer_foreign_keys lets us drop+rename despite project_milestones /
--     project_gallery referencing projects(id) ON DELETE CASCADE
--   - All existing indexes recreated
--   - Row count preserved (verified by app-level smoke test post-migration)
-- =============================================================================

-- Defer FK enforcement until COMMIT. Required because project_milestones
-- and project_gallery have FK → projects(id) ON DELETE CASCADE. Without
-- defer, the DROP TABLE projects step would fail.
PRAGMA defer_foreign_keys = ON;

-- Step 1: Create new projects table — identical schema MINUS the two
-- CHECK constraints. All columns, defaults, FK, and UNIQUE preserved.
CREATE TABLE projects_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  slug            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  -- status: no longer CHECK-constrained. App-level state machine validates.
  status          TEXT    NOT NULL DEFAULT 'planning',
  -- progress_pct: no longer CHECK-constrained (some industries don't use %).
  -- App-level validation in schema.js still enforces 0-100 for industries
  -- that include this field.
  progress_pct    INTEGER NOT NULL DEFAULT 0,
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  timeline_json   TEXT    NOT NULL DEFAULT '[]',
  gallery_json    TEXT    NOT NULL DEFAULT '[]',
  is_featured     INTEGER NOT NULL DEFAULT 0,
  deleted_at      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);

-- Step 2: Copy all data. Column order matches; ids preserved so existing
-- FK references stay valid.
INSERT INTO projects_new
  (id, tenant_id, slug, name, description, status, progress_pct,
   cover_media_id, timeline_json, gallery_json, is_featured,
   deleted_at, created_at, updated_at)
SELECT
  id, tenant_id, slug, name, description, status, progress_pct,
  cover_media_id, timeline_json, gallery_json, is_featured,
  deleted_at, created_at, updated_at
FROM projects;

-- Step 3: Drop the old table. FK checks deferred — won't fail here.
DROP TABLE projects;

-- Step 4: Rename new → projects. After COMMIT, project_milestones and
-- project_gallery FK references resolve to this new table (same name + ids).
ALTER TABLE projects_new RENAME TO projects;

-- Step 5: Recreate indexes (DROP TABLE removed them).
CREATE INDEX idx_projects_tenant_slug
  ON projects(tenant_id, slug);

CREATE INDEX idx_projects_tenant_featured
  ON projects(tenant_id, is_featured DESC, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_projects_status
  ON projects(tenant_id, status);

-- COMMIT (automatic via migrate.js transaction wrapper) will trigger
-- the deferred FK check. Since ids are preserved, all FK from
-- project_milestones / project_gallery resolve correctly.
