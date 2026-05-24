-- =====================================================================
-- previous release Repair project child-table foreign keys
--
-- Context:
--   The core hardening migration creates project_milestones/project_gallery with FKs
--   to projects(id). 005_multi_tenant later renames projects to
--   projects_rebuild_source during table rebuild. SQLite rewrites existing child
--   FKs to projects_rebuild_source, then 005 drops that old table.
--
-- Symptom:
--   SqliteError: no such table: main.projects_rebuild_source
--
-- Fix:
--   Rebuild project_milestones and project_gallery so their FKs point to
--   the current projects table.
-- =====================================================================

CREATE TABLE project_milestones_repaired (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  milestone_date  TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','done','delayed')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO project_milestones_repaired
  (id, tenant_id, project_id, title, description, milestone_date, status,
   sort_order, cover_media_id, created_at, updated_at)
SELECT
  id, tenant_id, project_id, title, description, milestone_date, status,
  sort_order, cover_media_id, created_at, updated_at
FROM project_milestones;

DROP TABLE project_milestones;
ALTER TABLE project_milestones_repaired RENAME TO project_milestones;

CREATE INDEX IF NOT EXISTS idx_milestones_project
  ON project_milestones(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_milestones_status
  ON project_milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_tenant
  ON project_milestones(tenant_id, project_id, sort_order);

CREATE TABLE project_gallery_repaired (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id        INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  caption         TEXT    NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO project_gallery_repaired
  (id, tenant_id, project_id, media_id, caption, sort_order, created_at)
SELECT
  id, tenant_id, project_id, media_id, caption, sort_order, created_at
FROM project_gallery;

DROP TABLE project_gallery;
ALTER TABLE project_gallery_repaired RENAME TO project_gallery;

CREATE INDEX IF NOT EXISTS idx_gallery_project
  ON project_gallery(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_media
  ON project_gallery(media_id);
CREATE INDEX IF NOT EXISTS idx_gallery_tenant
  ON project_gallery(tenant_id, project_id, sort_order);
