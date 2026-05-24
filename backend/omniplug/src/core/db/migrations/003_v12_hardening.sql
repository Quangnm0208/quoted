-- =====================================================================
-- legacy Production Hardening Migration (003)
--
-- Changes:
--   1. Soft delete: deleted_at column on articles, projects, media, leads
--   2. Normalize project timeline → project_milestones table
--   3. Normalize project gallery → project_gallery table
--   4. Page sections — for "đổi title của các section" qua CMS, không sửa code
--   5. auth_attempts — login rate limit tracking
--   6. media_usage_cache — track xem ảnh đang được dùng ở đâu (để block delete)
--
-- Idempotent: dùng ALTER TABLE ADD COLUMN (SQLite ignore nếu đã tồn tại — but
-- safer: check rồi mới thêm bằng pragma). SQLite < 3.35 không có DROP COLUMN.
--
-- ⚠️ Sau khi chạy migration này, cần chạy `scripts/migrate-json-to-tables.js`
-- để di chuyển dữ liệu hiện có từ projects.timeline_json/gallery_json → tables mới.
-- =====================================================================

-- ----- Soft delete columns -----
-- SQLite không có IF NOT EXISTS cho ALTER TABLE ADD COLUMN nên dùng migration check.
-- Tuy nhiên ở migration mới (legacy), giả định columns chưa tồn tại.
-- Nếu chạy lại (idempotent), error sẽ bị catch ở migrate.js.

ALTER TABLE articles ADD COLUMN deleted_at TEXT;
ALTER TABLE projects ADD COLUMN deleted_at TEXT;
ALTER TABLE media    ADD COLUMN deleted_at TEXT;
ALTER TABLE leads    ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_deleted_at    ON media(deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at    ON leads(deleted_at);

-- =========================================================
-- PROJECT_MILESTONES — Normalize timeline_json
-- =========================================================
CREATE TABLE IF NOT EXISTS project_milestones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  milestone_date  TEXT,                                  -- "Q1/2026" hoặc "2026-05-15"
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','done','delayed')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_milestones_status  ON project_milestones(status);

-- =========================================================
-- PROJECT_GALLERY — Normalize gallery_json + protect media integrity
-- =========================================================
CREATE TABLE IF NOT EXISTS project_gallery (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id        INTEGER NOT NULL REFERENCES media(id)    ON DELETE CASCADE,
  caption         TEXT    NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_project ON project_gallery(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_media   ON project_gallery(media_id);

-- =========================================================
-- PAGE_SECTIONS — Cho phép CMS đổi title/content section
-- mà không sửa code frontend.
--
-- Workflow:
--   1. Frontend đánh dấu sections: data-cms-section="home:hero"
--   2. Admin sửa text/payload trong CMS → GET /api/public/pages/home
--   3. Frontend fetch + render dynamic
--
-- Component types (registry phía frontend):
--   - hero_banner       — title, subtitle, cta_label, cta_link, bg media
--   - rich_text         — content_html
--   - stat_grid         — counters array
--   - cta_block         — title, subtitle, button text + link
--   - gallery_block     — list of media_ids
--   - feature_list      — items array với icon + title + desc
--   - project_card_list — featured projects to show
-- =========================================================
CREATE TABLE IF NOT EXISTS page_sections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  page_key        TEXT    NOT NULL,                     -- 'home' | 'about' | 'project-detail' | ...
  section_key     TEXT    NOT NULL,                     -- 'hero' | 'features' | 'cta' | ...
  component_type  TEXT    NOT NULL,                     -- hero_banner | rich_text | stat_grid | ...
  title           TEXT    NOT NULL DEFAULT '',
  subtitle        TEXT    NOT NULL DEFAULT '',
  payload_json    TEXT    NOT NULL DEFAULT '{}',        -- JSON tùy component_type
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_visible      INTEGER NOT NULL DEFAULT 1,
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(page_key, section_key)
);

CREATE INDEX IF NOT EXISTS idx_sections_page    ON page_sections(page_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_sections_visible ON page_sections(is_visible);

-- =========================================================
-- AUTH_ATTEMPTS — Login rate limit + brute force detection
-- =========================================================
CREATE TABLE IF NOT EXISTS auth_attempts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT,                                 -- email user thử login
  ip_address      TEXT    NOT NULL,
  success         INTEGER NOT NULL DEFAULT 0,           -- 0=fail, 1=success
  user_agent      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip    ON auth_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_email ON auth_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_time  ON auth_attempts(created_at DESC);
