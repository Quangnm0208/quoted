-- =====================================================================
-- v1.2 Multi-Tenant Foundation (Migration 005)
--
-- Goal: chuẩn bị foundation để clone CMS này thành N instances trong
-- tương lai mà không phá schema. SINGLE DB, SHARED SCHEMA, ROW-LEVEL TENANT.
--
-- Strategy:
--   1. Create `tenants` table + seed default tenant (id=1)
--   2. ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1 — cho tất cả data tables
--   3. Table REBUILD cho articles + projects (UNIQUE(slug) → UNIQUE(tenant_id, slug))
--   4. Indexes composite (tenant_id, ...) cho hot queries
--
-- Compatibility:
--   - Single-tenant deployment hiện tại KHÔNG bị thay đổi behavior
--   - Adding tenant #2 chỉ cần INSERT row vào `tenants` + map domain
--   - KHÔNG cần migration nào khác sau này
--
-- Safety:
--   - Toàn bộ migration trong 1 transaction (do migrate.js bao quanh)
--   - Table rebuild dùng pattern: CREATE new → INSERT FROM old → DROP old → RENAME
--   - Foreign keys CASCADE: xóa tenant → xóa toàn bộ data của tenant đó
-- =====================================================================

-- ===========================================================
-- 1. TENANTS TABLE
-- ===========================================================
CREATE TABLE IF NOT EXISTS tenants (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    UNIQUE NOT NULL,                  -- 'demo'
  name            TEXT    NOT NULL,                          -- 'Demo Tenant'
  domain          TEXT,                                      -- 'example.com' (nullable, dùng để Host header lookup)
  status          TEXT    NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'archived')),
  settings_json   TEXT    NOT NULL DEFAULT '{}',             -- tenant-specific config (theme, locale, ...)
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_domain  ON tenants(domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status  ON tenants(status);

-- Seed default tenant (id=1) — tương ứng với deployment hiện tại
INSERT OR IGNORE INTO tenants (id, slug, name, domain, status)
VALUES (1, 'demo', 'Demo Tenant', NULL, 'active');

-- ===========================================================
-- 2. USERS — add tenant_id (1 user thuộc 1 tenant)
-- ===========================================================
ALTER TABLE users ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ===========================================================
-- 3. ARTICLES — REBUILD để có UNIQUE(tenant_id, slug)
-- ===========================================================
-- Save old table
ALTER TABLE articles RENAME TO articles_rebuild_source;

CREATE TABLE articles (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id           INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  slug                TEXT    NOT NULL,
  title               TEXT    NOT NULL,
  excerpt             TEXT    NOT NULL DEFAULT '',
  content_html        TEXT    NOT NULL DEFAULT '',
  cover_media_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status              TEXT    NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'archived')),
  published_at        TEXT,
  meta_title          TEXT    NOT NULL DEFAULT '',
  meta_description    TEXT    NOT NULL DEFAULT '',
  meta_og_image       INTEGER REFERENCES media(id) ON DELETE SET NULL,
  author_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at          TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);

INSERT INTO articles
  (id, tenant_id, slug, title, excerpt, content_html, cover_media_id, status,
   published_at, meta_title, meta_description, meta_og_image, author_id,
   deleted_at, created_at, updated_at)
SELECT
  id, 1, slug, title, excerpt, content_html, cover_media_id, status,
  published_at, meta_title, meta_description, meta_og_image, author_id,
  deleted_at, created_at, updated_at
FROM articles_rebuild_source;

DROP TABLE articles_rebuild_source;

CREATE INDEX idx_articles_tenant_slug      ON articles(tenant_id, slug);
CREATE INDEX idx_articles_tenant_status    ON articles(tenant_id, status);
CREATE INDEX idx_articles_tenant_published ON articles(tenant_id, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_deleted_at       ON articles(deleted_at);

-- ===========================================================
-- 4. PROJECTS — REBUILD để có UNIQUE(tenant_id, slug)
-- ===========================================================
ALTER TABLE projects RENAME TO projects_rebuild_source;

CREATE TABLE projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  slug            TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'planning'
                  CHECK (status IN ('planning','foundation','construction','finishing','handover','completed','on_hold')),
  progress_pct    INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  timeline_json   TEXT    NOT NULL DEFAULT '[]',              -- LEGACY, giữ để rollback. legacy migrate sang project_milestones
  gallery_json    TEXT    NOT NULL DEFAULT '[]',              -- LEGACY
  is_featured     INTEGER NOT NULL DEFAULT 0,
  deleted_at      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);

INSERT INTO projects
  (id, tenant_id, slug, name, description, status, progress_pct, cover_media_id,
   timeline_json, gallery_json, is_featured, deleted_at, created_at, updated_at)
SELECT
  id, 1, slug, name, description, status, progress_pct, cover_media_id,
  timeline_json, gallery_json, is_featured, deleted_at, created_at, updated_at
FROM projects_rebuild_source;

DROP TABLE projects_rebuild_source;

CREATE INDEX idx_projects_tenant_slug     ON projects(tenant_id, slug);
CREATE INDEX idx_projects_tenant_featured ON projects(tenant_id, is_featured DESC, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_deleted_at      ON projects(deleted_at);

-- ===========================================================
-- 5. MEDIA — add tenant_id (mỗi tenant có media library riêng)
-- ===========================================================
ALTER TABLE media ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_media_tenant ON media(tenant_id, created_at DESC);

-- ===========================================================
-- 6. LEADS — add tenant_id (mỗi site có inbox riêng)
-- ===========================================================
ALTER TABLE leads ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status, created_at DESC);

-- ===========================================================
-- 7. SITE_CONFIG — REBUILD để có UNIQUE(tenant_id, config_key)
-- Note: legacy/legacy dùng config_key làm PRIMARY KEY (không có id).
-- v1.2 giữ nguyên design key-value, chỉ thêm tenant scoping.
-- ===========================================================
ALTER TABLE site_config RENAME TO site_config_rebuild_source;

CREATE TABLE site_config (
  tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  config_key      TEXT    NOT NULL,
  config_value    TEXT    NOT NULL DEFAULT '""',
  label           TEXT    NOT NULL DEFAULT '',
  description     TEXT    NOT NULL DEFAULT '',
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, config_key)
);

INSERT INTO site_config
  (tenant_id, config_key, config_value, label, description, updated_by, updated_at)
SELECT
  1, config_key, config_value, label, description, updated_by, updated_at
FROM site_config_rebuild_source;

DROP TABLE site_config_rebuild_source;

CREATE INDEX idx_site_config_tenant ON site_config(tenant_id);

-- ===========================================================
-- 8. PAGE_SECTIONS — REBUILD để có UNIQUE(tenant_id, page_key, section_key)
-- ===========================================================
ALTER TABLE page_sections RENAME TO page_sections_rebuild_source;

CREATE TABLE page_sections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  page_key        TEXT    NOT NULL,
  section_key     TEXT    NOT NULL,
  component_type  TEXT    NOT NULL,
  title           TEXT    NOT NULL DEFAULT '',
  subtitle        TEXT    NOT NULL DEFAULT '',
  payload_json    TEXT    NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_visible      INTEGER NOT NULL DEFAULT 1,
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, page_key, section_key)
);

INSERT INTO page_sections
  (id, tenant_id, page_key, section_key, component_type, title, subtitle,
   payload_json, sort_order, is_visible, updated_by, updated_at)
SELECT
  id, 1, page_key, section_key, component_type, title, subtitle,
  payload_json, sort_order, is_visible, updated_by, updated_at
FROM page_sections_rebuild_source;

DROP TABLE page_sections_rebuild_source;

CREATE INDEX idx_sections_tenant_page ON page_sections(tenant_id, page_key, sort_order);

-- ===========================================================
-- 9. PROJECT_MILESTONES / PROJECT_GALLERY — add tenant_id (denormalized cho query speed)
-- ===========================================================
ALTER TABLE project_milestones ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE project_gallery    ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_milestones_tenant ON project_milestones(tenant_id, project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_tenant    ON project_gallery(tenant_id, project_id, sort_order);

-- ===========================================================
-- 10. AUDIT_LOG — add tenant_id (NULLABLE: system actions không gắn tenant)
-- ===========================================================
ALTER TABLE audit_log ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);

-- ===========================================================
-- 11. AUTH_ATTEMPTS — add tenant_id (NULLABLE: pre-auth không biết tenant)
-- ===========================================================
ALTER TABLE auth_attempts ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_auth_attempts_tenant ON auth_attempts(tenant_id, created_at DESC);
