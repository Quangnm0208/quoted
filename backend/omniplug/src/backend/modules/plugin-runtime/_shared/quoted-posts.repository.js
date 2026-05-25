/**
 * quoted_posts repository — WP posts synced from the Quoted plugin.
 *
 * Lives in its own table (see migration 029) so we don't have to add
 * wp-specific columns to the upstream OmniPlug articles table. This also
 * keeps the OmniPlug admin clean: the WP-synced corpus does NOT appear in
 * the articles list.
 */

import db from '../../../../core/db/connection.js';
import { lazyPrepare } from '../../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  countByTenant: db.prepare(`SELECT COUNT(*) AS n FROM quoted_posts WHERE tenant_id = ?`),

  findByWpRef: db.prepare(`
    SELECT * FROM quoted_posts
    WHERE tenant_id = ? AND wp_site_id = ? AND wp_post_id = ?
  `),

  findBySlug: db.prepare(`
    SELECT * FROM quoted_posts WHERE tenant_id = ? AND slug = ?
  `),

  insert: db.prepare(`
    INSERT INTO quoted_posts
      (tenant_id, wp_site_id, wp_post_id, slug, title, excerpt, content_html,
       author, categories_json, tags_json, published_at, modified_at, canonical_url)
    VALUES
      (@tenant_id, @wp_site_id, @wp_post_id, @slug, @title, @excerpt, @content_html,
       @author, @categories_json, @tags_json, @published_at, @modified_at, @canonical_url)
  `),

  update: db.prepare(`
    UPDATE quoted_posts SET
      slug = @slug,
      title = @title,
      excerpt = @excerpt,
      content_html = @content_html,
      author = @author,
      categories_json = @categories_json,
      tags_json = @tags_json,
      published_at = @published_at,
      modified_at = @modified_at,
      canonical_url = @canonical_url,
      updated_at = datetime('now')
    WHERE id = @id
  `),

  findPublishedByTenant: db.prepare(`
    SELECT * FROM quoted_posts
    WHERE tenant_id = ? AND published_at IS NOT NULL
    ORDER BY published_at DESC
    LIMIT ?
  `),
}));

export const quotedPostsRepository = {
  countByTenant(tenantId) {
    return stmt().countByTenant.get(tenantId).n;
  },

  findByWpRef(tenantId, wpSiteId, wpPostId) {
    return stmt().findByWpRef.get(tenantId, wpSiteId, wpPostId) || null;
  },

  findBySlug(tenantId, slug) {
    return stmt().findBySlug.get(tenantId, slug) || null;
  },

  findPublishedByTenant(tenantId, { limit = 200 } = {}) {
    return stmt().findPublishedByTenant.all(tenantId, Math.min(Math.max(limit, 1), 1000));
  },

  insert(data) {
    return stmt().insert.run({
      tenant_id:       data.tenantId,
      wp_site_id:      data.wpSiteId,
      wp_post_id:      data.wpPostId,
      slug:            data.slug,
      title:           data.title,
      excerpt:         data.excerpt || '',
      content_html:    data.contentHtml || '',
      author:          data.author || '',
      categories_json: data.categoriesJson || '[]',
      tags_json:       data.tagsJson || '[]',
      published_at:    data.publishedAt || null,
      modified_at:     data.modifiedAt || null,
      canonical_url:   data.canonicalUrl || null,
    });
  },

  update(id, data) {
    return stmt().update.run({
      id,
      slug:            data.slug,
      title:           data.title,
      excerpt:         data.excerpt || '',
      content_html:    data.contentHtml || '',
      author:          data.author || '',
      categories_json: data.categoriesJson || '[]',
      tags_json:       data.tagsJson || '[]',
      published_at:    data.publishedAt || null,
      modified_at:     data.modifiedAt || null,
      canonical_url:   data.canonicalUrl || null,
    });
  },
};
