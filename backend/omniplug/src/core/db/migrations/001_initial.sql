-- =====================================================================
-- Demo Tenant Mini-CMS — Initial Schema (v1.2.0)
--
-- Design principles:
--   * SQLite-flavored DDL for the v1.2 core.
--   * Foreign keys ON DELETE behavior chọn theo nguyên tắc least-surprise:
--       - Article cover_image → Media: SET NULL (xóa ảnh, bài vẫn còn)
--       - Lead created_by_user: SET NULL (xóa user, lead vẫn còn)
--   * Mọi bảng đều có created_at / updated_at (timestamp ISO 8601).
--   * Indexes trên các cột query nhiều (slug, status, published_at).
--   * Soft delete chưa implement — đợi user request, MVP dùng hard delete.
-- =====================================================================

-- =========================================================
-- USERS — Admin/Editor accounts cho CMS dashboard
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,
  password_hash   TEXT    NOT NULL,                -- bcrypt 12 rounds
  display_name    TEXT    NOT NULL DEFAULT '',
  role            TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor')),
  last_login_at   TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =========================================================
-- MEDIA — Uploaded images / files
-- =========================================================
CREATE TABLE IF NOT EXISTS media (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  filename        TEXT    NOT NULL UNIQUE,         -- "2026-05-08-abc123.webp"
  original_name   TEXT    NOT NULL,                -- name lúc upload
  mime_type       TEXT    NOT NULL,
  size_bytes      INTEGER NOT NULL,
  width           INTEGER,
  height          INTEGER,
  alt             TEXT    NOT NULL DEFAULT '',
  uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);

-- =========================================================
-- ARTICLES — Tin tức / Bài viết
-- =========================================================
CREATE TABLE IF NOT EXISTS articles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    NOT NULL UNIQUE,
  title           TEXT    NOT NULL,
  excerpt         TEXT    NOT NULL DEFAULT '',
  content_html    TEXT    NOT NULL DEFAULT '',     -- HTML từ rich text editor
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status          TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at    TEXT,                            -- NULL nếu draft
  meta_title      TEXT    NOT NULL DEFAULT '',
  meta_description TEXT   NOT NULL DEFAULT '',
  meta_og_image   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  author_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_slug         ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status       ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

-- =========================================================
-- PROJECTS — Tiến độ dự án (timeline + gallery)
-- =========================================================
-- Lưu ý:
--   * timeline_json / gallery_json là JSON array string (SQLite native JSON1).
--   * Pattern timeline_json: [{ "date": "2026-Q1", "title": "...", "description": "...", "done": true }]
--   * Pattern gallery_json:  [{ "media_id": 12, "caption": "..." }]
CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'planning'
                  CHECK (status IN ('planning','foundation','construction','finishing','handover','completed','on_hold')),
  progress_pct    INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  timeline_json   TEXT    NOT NULL DEFAULT '[]',
  gallery_json    TEXT    NOT NULL DEFAULT '[]',
  is_featured     INTEGER NOT NULL DEFAULT 0,      -- 0/1 boolean
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_slug       ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_featured   ON projects(is_featured);

-- =========================================================
-- SITE_CONFIG — Key-value cho text/cấu hình toàn site
-- =========================================================
-- Pattern key dạng dot-path: "hero.title", "hotline", "footer.copyright"
-- Value lưu JSON (cho phép string/number/array/object). Reader phải JSON.parse.
CREATE TABLE IF NOT EXISTS site_config (
  config_key      TEXT    PRIMARY KEY,
  config_value    TEXT    NOT NULL DEFAULT '""',
  label           TEXT    NOT NULL DEFAULT '',    -- nhãn hiển thị trong CMS
  description     TEXT    NOT NULL DEFAULT '',    -- gợi ý cho editor
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- LEADS — Form đăng ký từ frontend
-- =========================================================
CREATE TABLE IF NOT EXISTS leads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  phone           TEXT    NOT NULL,
  email           TEXT,
  source          TEXT    NOT NULL DEFAULT 'landing',
  status          TEXT    NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','contacted','qualified','converted','lost')),
  notes           TEXT    NOT NULL DEFAULT '',
  user_agent      TEXT,
  ip_address      TEXT,
  referer         TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- =========================================================
-- AUDIT_LOG — Log hành động admin (tùy chọn, security baseline)
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT    NOT NULL,           -- "article.create", "lead.update", etc.
  entity_type     TEXT,
  entity_id       INTEGER,
  ip_address      TEXT,
  metadata_json   TEXT    NOT NULL DEFAULT '{}',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);
