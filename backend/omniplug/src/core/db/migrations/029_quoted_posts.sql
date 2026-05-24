-- Migration 029: quoted_posts
--
-- WP posts synced from the Quoted plugin live in their OWN table — not in
-- OmniPlug's articles table — so:
--   - the OmniPlug admin authoring flow stays clean (articles is for first-party
--     CMS content, not external sync), and
--   - we don't need to add wp-specific columns (wp_post_id, canonical_url,
--     categories_json, tags_json, modified_at) to the upstream articles schema.
--
-- Unique key: (tenant_id, wp_site_id, wp_post_id). One WP post can only sync
-- to one row per site.

CREATE TABLE IF NOT EXISTS quoted_posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wp_site_id      INTEGER NOT NULL REFERENCES wp_sites(id) ON DELETE CASCADE,
  wp_post_id      INTEGER NOT NULL,
  slug            TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  excerpt         TEXT    NOT NULL DEFAULT '',
  content_html    TEXT    NOT NULL DEFAULT '',
  author          TEXT    NOT NULL DEFAULT '',
  categories_json TEXT    NOT NULL DEFAULT '[]',
  tags_json       TEXT    NOT NULL DEFAULT '[]',
  published_at    TEXT,
  modified_at     TEXT,
  canonical_url   TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, wp_site_id, wp_post_id)
);

CREATE INDEX IF NOT EXISTS idx_quoted_posts_tenant_slug
  ON quoted_posts(tenant_id, slug);

CREATE INDEX IF NOT EXISTS idx_quoted_posts_tenant_pub
  ON quoted_posts(tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_quoted_posts_site
  ON quoted_posts(wp_site_id, wp_post_id);
