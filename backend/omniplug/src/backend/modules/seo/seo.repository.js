/**
 * seo/seo.repository.js — Read-only queries for SEO surface generation.
 *
 * Design notes:
 *   - All queries are tenant-scoped (WHERE tenant_id = ?).
 *   - Only SELECT the columns the sitemap/feed/jsonld generators actually
 *     read. Articles `content_html` is intentionally NOT fetched for the
 *     sitemap — that column is large and never needed for url+lastmod.
 *   - The feed path needs excerpt + cover_media_id; it has its own statement.
 *   - Lazy-prepared so this file is safe to import before migrations run
 *     (matches the rest of the codebase's pattern — see articles.repository).
 *
 * Why no SQL in service:
 *   The seo.service.js layer formats XML/JSON. It must not embed SQL — that
 *   would prevent us from swapping SQLite for Postgres later without touching
 *   the rendering layer. This is the same controller/service/repository
 *   contract documented in docs/MODULE_PACKAGING.md.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  // --- Sitemap / llms.txt: lightweight (slug + lastmod only) ---
  listArticlesForSitemap: db.prepare(`
    SELECT slug,
           COALESCE(updated_at, published_at, created_at) AS lastmod,
           published_at,
           title
    FROM articles
    WHERE tenant_id = ?
      AND status = 'published'
      AND deleted_at IS NULL
    ORDER BY COALESCE(published_at, updated_at) DESC
    LIMIT 50000
  `),

  listProjectsForSitemap: db.prepare(`
    SELECT slug,
           name,
           COALESCE(updated_at, created_at) AS lastmod
    FROM projects
    WHERE tenant_id = ?
      AND deleted_at IS NULL
    ORDER BY is_featured DESC, updated_at DESC
    LIMIT 50000
  `),

  listPageKeysForSitemap: db.prepare(`
    SELECT page_key,
           MAX(updated_at) AS lastmod
    FROM page_sections
    WHERE tenant_id = ? AND is_visible = 1
    GROUP BY page_key
  `),

  // --- Feed: needs excerpt + cover media filename in a single query ---
  listArticlesForFeed: db.prepare(`
    SELECT a.slug,
           a.title,
           a.excerpt,
           a.published_at,
           a.updated_at,
           a.meta_description,
           m.filename AS cover_filename
    FROM articles a
    LEFT JOIN media m ON m.id = a.cover_media_id AND m.tenant_id = a.tenant_id
    WHERE a.tenant_id = ?
      AND a.status = 'published'
      AND a.deleted_at IS NULL
    ORDER BY COALESCE(a.published_at, a.created_at) DESC
    LIMIT ?
  `),

  // --- Tenant identity for canonical URL + Organization JSON-LD ---
  tenantById: db.prepare(`
    SELECT id, slug, name, domain, settings_json
    FROM tenants
    WHERE id = ?
  `),

  // --- Site config: harvested for Organization / WebSite JSON-LD ---
  siteConfigMap: db.prepare(`
    SELECT config_key, config_value
    FROM site_config
    WHERE tenant_id = ?
  `),

  // --- Single article for JSON-LD (BlogPosting / NewsArticle) ---
  articleForJsonLd: db.prepare(`
    SELECT a.id, a.slug, a.title, a.excerpt, a.meta_title, a.meta_description,
           a.published_at, a.updated_at,
           u.display_name AS author_name,
           m.filename AS cover_filename,
           og.filename AS og_filename
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    LEFT JOIN media m ON m.id = a.cover_media_id AND m.tenant_id = a.tenant_id
    LEFT JOIN media og ON og.id = a.meta_og_image AND og.tenant_id = a.tenant_id
    WHERE a.tenant_id = ? AND a.slug = ?
      AND a.status = 'published' AND a.deleted_at IS NULL
  `),

  // --- Single project for JSON-LD (vertical-specific shape) ---
  projectForJsonLd: db.prepare(`
    SELECT p.id, p.slug, p.name, p.description, p.status,
           p.progress_pct, p.created_at, p.updated_at,
           m.filename AS cover_filename
    FROM projects p
    LEFT JOIN media m ON m.id = p.cover_media_id AND m.tenant_id = p.tenant_id
    WHERE p.tenant_id = ? AND p.slug = ? AND p.deleted_at IS NULL
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('seo.repository: tenantId required (got: ' + typeof tenantId + ')');
  }
  return tenantId;
}

export const seoRepository = {
  listArticlesForSitemap(tenantId) {
    return stmt().listArticlesForSitemap.all(requireTenant(tenantId));
  },

  listProjectsForSitemap(tenantId) {
    return stmt().listProjectsForSitemap.all(requireTenant(tenantId));
  },

  listPageKeysForSitemap(tenantId) {
    return stmt().listPageKeysForSitemap.all(requireTenant(tenantId));
  },

  listArticlesForFeed(tenantId, limit = 20) {
    return stmt().listArticlesForFeed.all(requireTenant(tenantId), limit);
  },

  tenantById(tenantId) {
    return stmt().tenantById.get(requireTenant(tenantId)) || null;
  },

  siteConfigMap(tenantId) {
    const rows = stmt().siteConfigMap.all(requireTenant(tenantId));
    const out = Object.create(null);
    for (const r of rows) {
      try {
        out[r.config_key] = JSON.parse(r.config_value);
      } catch {
        out[r.config_key] = r.config_value;
      }
    }
    return out;
  },

  articleForJsonLd(tenantId, slug) {
    return stmt().articleForJsonLd.get(requireTenant(tenantId), slug) || null;
  },

  projectForJsonLd(tenantId, slug) {
    return stmt().projectForJsonLd.get(requireTenant(tenantId), slug) || null;
  },
};
