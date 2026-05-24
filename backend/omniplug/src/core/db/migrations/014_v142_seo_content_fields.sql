-- =====================================================================
-- v1.4.2-FINAL — SEO content fields for articles, projects, pages.
--
-- These fields support:
--   1. The snippet endpoint (renders <head> meta tags from these)
--   2. The article SEO validator (computes 0-100 score from these)
--   3. The schema generator (uses these in JSON-LD output)
--
-- Why nullable with defaults instead of strict required:
--   We add to existing live tables. Production rows must not break.
--   Defaults are empty strings / 'index,follow' so legacy code that
--   doesn't yet read them sees no change.
--
-- Sizing rationale:
--   seo_title VARCHAR(70):      Google's display cap is ~60 chars at
--                                580px desktop width; 70 leaves room
--                                for the validator's warn-not-block.
--   seo_description VARCHAR(170): Google's snippet cap is ~155 chars
--                                desktop, ~120 mobile. 170 is generous.
--   focus_keyword VARCHAR(80):   Long-tail keyword (e.g. "căn hộ
--                                3 phòng ngủ quận 7 view sông") needs room.
--   secondary_keywords TEXT:    JSON array of strings, no fixed cap.
--   canonical_url TEXT:         Absolute URL or empty for self-reference.
--   robots_directive VARCHAR(50): comma-separated tokens, e.g.
--                                "noindex,follow" — max practical ~30 chars.
--   meta_keywords TEXT:         Legacy support. Rendered but not validated.
--                                Google ignores; some VN SEO consultants
--                                still expect the tag to exist.
--   og_image_id INTEGER:        Separate from cover_media_id so admin
--                                can use a 1200x630 OG-optimized image
--                                without changing the article cover.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ARTICLES — full set
-- ---------------------------------------------------------------------
ALTER TABLE articles ADD COLUMN seo_title          TEXT    NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN seo_description    TEXT    NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN focus_keyword      TEXT    NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN secondary_keywords TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE articles ADD COLUMN canonical_url      TEXT    NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN robots_directive   TEXT    NOT NULL DEFAULT 'index,follow';
ALTER TABLE articles ADD COLUMN meta_keywords      TEXT    NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN og_image_id        INTEGER REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN seo_score          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN seo_score_at       TEXT;
ALTER TABLE articles ADD COLUMN seo_score_breakdown TEXT   NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------
-- 2. PROJECTS — same fields (BĐS landing also benefit from SEO)
-- ---------------------------------------------------------------------
ALTER TABLE projects ADD COLUMN seo_title          TEXT    NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN seo_description    TEXT    NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN focus_keyword      TEXT    NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN secondary_keywords TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN canonical_url      TEXT    NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN robots_directive   TEXT    NOT NULL DEFAULT 'index,follow';
ALTER TABLE projects ADD COLUMN meta_keywords      TEXT    NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN og_image_id        INTEGER REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN seo_score          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN seo_score_at       TEXT;
ALTER TABLE projects ADD COLUMN seo_score_breakdown TEXT   NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------
-- 3. PAGES — DEFERRED to a future migration
-- ---------------------------------------------------------------------
-- Note: the v1.4.0 schema models landing pages as page_sections rows keyed
-- to a site (not a discrete pages table with one row per page). The original
-- v1.4.2 plan to add SEO fields to a `pages` table was incorrect — there is
-- no such table. SEO for landing pages will be handled differently in a
-- future release (likely via site_config keys per section group). For now,
-- we skip the ALTER TABLE pages statements which previously caused this
-- migration to fail with "no such table: pages".
-- v1.4.3 fix: was 6 ALTER TABLE pages statements that errored on apply.

-- ---------------------------------------------------------------------
-- 4. Indexes for the validator + snippet endpoints
-- ---------------------------------------------------------------------
-- Snippet endpoint hot path: lookup by (tenant_id, slug).
-- Articles already have this index from earlier migrations; verify.
CREATE INDEX IF NOT EXISTS idx_articles_seo_score
  ON articles(tenant_id, seo_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_seo_score
  ON projects(tenant_id, seo_score DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 5. Site-config seed for tenant-level SEO defaults
-- ---------------------------------------------------------------------
-- Tenant default OG image (used when an article has no og_image_id of
-- its own) + tenant default robots directive.
INSERT OR IGNORE INTO site_config (tenant_id, config_key, config_value, label, description) VALUES
  (1, 'seo.default_og_image_url', '""', 'Ảnh OG mặc định',
     'Dùng cho article/project chưa cấu hình og_image riêng. Phải là URL absolute, kích thước 1200x630.'),
  (1, 'seo.default_robots',       '"index,follow"', 'Robots mặc định',
     'Robots directive áp dụng khi article/project để rỗng.'),
  (1, 'seo.twitter_handle',       '""', 'Twitter @handle',
     'Dùng cho meta twitter:site. Có thể để trống.'),
  (1, 'seo.publisher_logo_url',   '""', 'Logo publisher cho JSON-LD',
     'Required cho Article schema. Kích thước >=112x112, format raster.'),
  (1, 'seo.publisher_logo_width', '600', 'Chiều rộng logo (px)', 'Cho JSON-LD ImageObject.'),
  (1, 'seo.publisher_logo_height','60',  'Chiều cao logo (px)',  'Cho JSON-LD ImageObject.');
