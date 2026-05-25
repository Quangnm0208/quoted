-- =====================================================================
-- Migration 040: Articles SEO + workflow extension (v0.7.0)
--
-- Master prompt v0.7.0 §6: extend existing `articles` table instead of
-- creating a duplicate `content_posts`. 24 of 33 master-prompt fields
-- already exist (slug, status, content_html, seo_title, seo_description,
-- canonical_url, og_image_id, etc.).
--
-- Adds the 9 missing fields:
--   - scheduled_at      — when to auto-publish (read query treats
--                          scheduled+past as public, no cron needed)
--   - archived_at       — distinct from soft-delete `deleted_at`
--   - og_title          — Open Graph title (separate from meta_title)
--   - og_description    — Open Graph description
--   - robots_index      — boolean (1=index, 0=noindex)
--   - robots_follow     — boolean (1=follow, 0=nofollow)
--   - schema_type       — Article | BlogPosting | Product | FAQPage
--   - content_type      — article | doc | changelog | faq | landing
--                          default 'article' (existing rows = articles)
--
-- All ADDITIVE only — no destructive ops, no data wipe. Idempotent
-- via the schema_migrations tracking table; ALTER TABLE ADD COLUMN
-- on SQLite is safe to re-run only if guarded by migration runner
-- (which we have).
--
-- Status enum extension: existing 'draft' | 'published' | 'archived'
-- + new 'scheduled'. The Zod schema in articles.schema.js is updated
-- in code; this SQL just stores the value as TEXT so no constraint
-- change needed.
-- =====================================================================

ALTER TABLE articles ADD COLUMN scheduled_at   TEXT;
ALTER TABLE articles ADD COLUMN archived_at    TEXT;
ALTER TABLE articles ADD COLUMN og_title       TEXT;
ALTER TABLE articles ADD COLUMN og_description TEXT;
ALTER TABLE articles ADD COLUMN robots_index   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE articles ADD COLUMN robots_follow  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE articles ADD COLUMN schema_type    TEXT NOT NULL DEFAULT 'Article';
ALTER TABLE articles ADD COLUMN content_type   TEXT NOT NULL DEFAULT 'article';

-- Index on scheduled_at so the public list query can efficiently filter
-- `published OR (scheduled AND scheduled_at <= NOW())` without scanning.
CREATE INDEX IF NOT EXISTS idx_articles_scheduled_at ON articles(scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Index on content_type so admin can filter (article vs doc vs changelog).
CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type);

-- Composite index for the most common public query path:
-- "list published articles for this tenant by published_at DESC".
CREATE INDEX IF NOT EXISTS idx_articles_tenant_status_published
  ON articles(tenant_id, status, published_at DESC);
