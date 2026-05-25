-- =====================================================================
-- Migration 041: Relax articles.status CHECK constraint to include 'scheduled'.
--
-- v0.7.0 (master prompt §1) introduces status='scheduled' but the
-- existing articles table has CHECK (status IN ('draft','published','archived')).
-- SQLite doesn't support DROP CONSTRAINT, so we rebuild the table.
--
-- SQLite-safe pattern:
--   1. CREATE TABLE _new with new CHECK
--   2. INSERT _new SELECT FROM old
--   3. DROP old
--   4. RENAME _new → old
--   5. Recreate indexes
--
-- Migration 040 already added the columns (scheduled_at, archived_at,
-- og_title, og_description, robots_index, robots_follow, schema_type,
-- content_type); this migration only touches the CHECK constraint.
--
-- Indexes are recreated explicitly because they don't survive the
-- rename pattern.
-- =====================================================================

-- Note: the migration runner already wraps each .sql file in a transaction,
-- so we do NOT issue BEGIN/COMMIT here (would error "cannot start a
-- transaction within a transaction").

CREATE TABLE articles_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id           INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  slug                TEXT    NOT NULL,
  title               TEXT    NOT NULL,
  excerpt             TEXT    NOT NULL DEFAULT '',
  content_html        TEXT    NOT NULL DEFAULT '',
  cover_media_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status              TEXT    NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  published_at        TEXT,
  meta_title          TEXT    NOT NULL DEFAULT '',
  meta_description    TEXT    NOT NULL DEFAULT '',
  meta_og_image       INTEGER REFERENCES media(id) ON DELETE SET NULL,
  author_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at          TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  seo_title           TEXT    NOT NULL DEFAULT '',
  seo_description     TEXT    NOT NULL DEFAULT '',
  focus_keyword       TEXT    NOT NULL DEFAULT '',
  secondary_keywords  TEXT    NOT NULL DEFAULT '[]',
  canonical_url       TEXT    NOT NULL DEFAULT '',
  robots_directive    TEXT    NOT NULL DEFAULT 'index,follow',
  meta_keywords       TEXT    NOT NULL DEFAULT '',
  og_image_id         INTEGER REFERENCES media(id) ON DELETE SET NULL,
  seo_score           INTEGER NOT NULL DEFAULT 0,
  seo_score_at        TEXT,
  seo_score_breakdown TEXT    NOT NULL DEFAULT '{}',
  scheduled_at        TEXT,
  archived_at         TEXT,
  og_title            TEXT,
  og_description      TEXT,
  robots_index        INTEGER NOT NULL DEFAULT 1,
  robots_follow       INTEGER NOT NULL DEFAULT 1,
  schema_type         TEXT    NOT NULL DEFAULT 'Article',
  content_type        TEXT    NOT NULL DEFAULT 'article',
  UNIQUE(tenant_id, slug)
);

INSERT INTO articles_new
SELECT
  id, tenant_id, slug, title, excerpt, content_html, cover_media_id, status,
  published_at, meta_title, meta_description, meta_og_image, author_id,
  deleted_at, created_at, updated_at, seo_title, seo_description,
  focus_keyword, secondary_keywords, canonical_url, robots_directive,
  meta_keywords, og_image_id, seo_score, seo_score_at, seo_score_breakdown,
  scheduled_at, archived_at, og_title, og_description, robots_index,
  robots_follow, schema_type, content_type
FROM articles;

DROP TABLE articles;
ALTER TABLE articles_new RENAME TO articles;

-- Recreate indexes (they don't survive table rename).
-- Original indexes from earlier migrations:
CREATE INDEX IF NOT EXISTS idx_articles_tenant_slug    ON articles(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_articles_tenant_status  ON articles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at   ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_author         ON articles(author_id);

-- v0.7.0 indexes (originally added in migration 040):
CREATE INDEX IF NOT EXISTS idx_articles_scheduled_at   ON articles(scheduled_at)
  WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_content_type   ON articles(content_type);
CREATE INDEX IF NOT EXISTS idx_articles_tenant_status_published
  ON articles(tenant_id, status, published_at DESC);
