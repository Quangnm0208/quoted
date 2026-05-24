/**
 * articles/articles.repository.js — Data access (v1.4.4 tenant-aware).
 *
 * Tenant guarantees:
 *   - All queries have WHERE tenant_id = ?
 *   - INSERT sets tenant_id
 *   - findBySlug/slugExists scope theo tenant
 *
 * Contract: caller PHẢI pass tenantId. Không có default — fail loud nếu thiếu.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

// v1.4.3 fix for BUG #4: bounded LRU-ish cache of prepared statements for
// dynamic-WHERE queries (findMany). Same SQL string → same prepared statement,
// no re-parse. Bound the cache so a pathological caller can't grow it unbounded.
const _preparedCache = new Map();
const PREPARED_CACHE_MAX = 50;
function preparedSelect(sql) {
  let s = _preparedCache.get(sql);
  if (s) return s;
  if (_preparedCache.size >= PREPARED_CACHE_MAX) {
    // Drop oldest entry (Map iteration order = insertion order).
    const firstKey = _preparedCache.keys().next().value;
    _preparedCache.delete(firstKey);
  }
  s = db.prepare(sql);
  _preparedCache.set(sql, s);
  return s;
}

const stmt = lazyPrepare(() => ({
  insert: db.prepare(`
    INSERT INTO articles (tenant_id, slug, title, excerpt, content_html, cover_media_id,
                         status, published_at, meta_title, meta_description,
                         meta_og_image, author_id)
    VALUES (@tenant_id, @slug, @title, @excerpt, @content_html, @cover_media_id,
            @status, @published_at, @meta_title, @meta_description,
            @meta_og_image, @author_id)
  `),

  findById:    db.prepare(`SELECT * FROM articles WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`),
  findByIdAny: db.prepare(`SELECT * FROM articles WHERE id = ? AND tenant_id = ?`),
  findBySlug:  db.prepare(`SELECT * FROM articles WHERE slug = ? AND tenant_id = ? AND deleted_at IS NULL`),
  slugExists:  db.prepare(`SELECT 1 FROM articles WHERE slug = ? AND tenant_id = ? AND deleted_at IS NULL`),

  update: db.prepare(`
    UPDATE articles SET
      slug = @slug,
      title = @title,
      excerpt = @excerpt,
      content_html = @content_html,
      cover_media_id = @cover_media_id,
      status = @status,
      published_at = @published_at,
      meta_title = @meta_title,
      meta_description = @meta_description,
      meta_og_image = @meta_og_image,
      updated_at = datetime('now')
    WHERE id = @id AND tenant_id = @tenant_id AND deleted_at IS NULL
  `),

  softDelete: db.prepare(`
    UPDATE articles SET deleted_at = datetime('now')
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  restore: db.prepare(`
    UPDATE articles SET deleted_at = NULL WHERE id = ? AND tenant_id = ?
  `),
  hardDelete: db.prepare(`DELETE FROM articles WHERE id = ? AND tenant_id = ?`),

  countPublished: db.prepare(`
    SELECT COUNT(*) AS c FROM articles
    WHERE tenant_id = ? AND status = 'published' AND deleted_at IS NULL
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('articles.repository: tenantId required (got: ' + typeof tenantId + ')');
  }
  return tenantId;
}

export const articlesRepository = {
  findById(id, tenantId) {
    return stmt().findById.get(id, requireTenant(tenantId)) || null;
  },

  findByIdAny(id, tenantId) {
    return stmt().findByIdAny.get(id, requireTenant(tenantId)) || null;
  },

  findBySlug(slug, tenantId) {
    return stmt().findBySlug.get(slug, requireTenant(tenantId)) || null;
  },

  slugExists(slug, tenantId) {
    return !!stmt().slugExists.get(slug, requireTenant(tenantId));
  },

  findMany(opts = {}) {
    const tenantId = requireTenant(opts.tenantId);
    const where = ['tenant_id = ?'];
    const params = [tenantId];

    if (!opts.includeDeleted) where.push('deleted_at IS NULL');
    if (opts.status) {
      where.push('status = ?');
      params.push(opts.status);
    }
    if (opts.search) {
      where.push('(title LIKE ? OR excerpt LIKE ?)');
      params.push('%' + opts.search + '%', '%' + opts.search + '%');
    }

    const whereSQL = 'WHERE ' + where.join(' AND ');

    // v1.4.4 perf: when status='published' is filtered, EVERY row has
    // published_at NOT NULL (enforced at publish time in the service layer).
    // Using `ORDER BY published_at DESC` (instead of COALESCE) lets the
    // planner walk idx_articles_tenant_status_published in index order with
    // NO temp B-tree sort. EXPLAIN QUERY PLAN before fix:
    //   SEARCH ... USING INDEX ... + USE TEMP B-TREE FOR ORDER BY
    // After fix:
    //   SEARCH ... USING INDEX idx_articles_tenant_status_published
    //   (no temp B-tree — index is already in DESC order)
    //
    // For drafts / mixed-status listings (admin only), fall back to the
    // original COALESCE — it's the only correct sort key when published_at
    // can be NULL. The TEMP B-TREE cost is acceptable for admin paths.
    const isPublishedOnly = opts.status === 'published';
    const orderMap = isPublishedOnly
      ? {
          newest: 'published_at DESC',
          oldest: 'published_at ASC',
          title:  'title ASC',
        }
      : {
          newest: 'COALESCE(published_at, created_at) DESC',
          oldest: 'COALESCE(published_at, created_at) ASC',
          title:  'title ASC',
        };
    const orderSQL = 'ORDER BY ' + (orderMap[opts.order] || orderMap.newest);

    const limit = Math.min(Math.max(opts.limit || 20, 1), 100);
    const offset = Math.max(opts.offset || 0, 0);

    const sql = `SELECT * FROM articles ${whereSQL} ${orderSQL} LIMIT ? OFFSET ?`;
    const queryParams = [...params, limit, offset];

    const countSQL = `SELECT COUNT(*) AS total FROM articles ${whereSQL}`;

    // v1.4.3 fix for BUG #4: cache prepared statements by SQL shape.
    // Previous: db.prepare(sql) called per request → 2.5x slower than cached.
    // The SQL string is deterministic from filter+order combo, so we cache by it.
    // Bounded at ~50 entries (statusOptions × orderOptions × {search?} × {deleted?}).
    const rows = preparedSelect(sql).all(...queryParams);
    const { total } = preparedSelect(countSQL).get(...params);

    return { rows, total, limit, offset };
  },

  create(tenantId, data) {
    requireTenant(tenantId);
    const info = stmt().insert.run({
      tenant_id: tenantId,
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt || '',
      content_html: data.content_html || '',
      cover_media_id: data.cover_media_id || null,
      status: data.status || 'draft',
      published_at: data.published_at || null,
      meta_title: data.meta_title || '',
      meta_description: data.meta_description || '',
      meta_og_image: data.meta_og_image || null,
      author_id: data.author_id || null,
    });
    return this.findById(info.lastInsertRowid, tenantId);
  },

  update(id, tenantId, data) {
    const existing = this.findById(id, tenantId);
    if (!existing) return null;
    stmt().update.run({
      id,
      tenant_id: tenantId,
      slug: data.slug ?? existing.slug,
      title: data.title ?? existing.title,
      excerpt: data.excerpt ?? existing.excerpt,
      content_html: data.content_html ?? existing.content_html,
      cover_media_id: data.cover_media_id !== undefined ? data.cover_media_id : existing.cover_media_id,
      status: data.status ?? existing.status,
      published_at: data.published_at !== undefined ? data.published_at : existing.published_at,
      meta_title: data.meta_title ?? existing.meta_title,
      meta_description: data.meta_description ?? existing.meta_description,
      meta_og_image: data.meta_og_image !== undefined ? data.meta_og_image : existing.meta_og_image,
    });
    return this.findById(id, tenantId);
  },

  softDelete(id, tenantId) {
    return stmt().softDelete.run(id, requireTenant(tenantId)).changes > 0;
  },

  restore(id, tenantId) {
    return stmt().restore.run(id, requireTenant(tenantId)).changes > 0;
  },

  hardDelete(id, tenantId) {
    return stmt().hardDelete.run(id, requireTenant(tenantId)).changes > 0;
  },

  countPublished(tenantId) {
    return stmt().countPublished.get(requireTenant(tenantId)).c;
  },
};
