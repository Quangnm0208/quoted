/**
 * articles/articles.service.js — Business logic (v1.4.4 tenant-aware).
 *
 * Every method accepts tenantId từ controller. Service KHÔNG biết về req.
 */

import { articlesRepository } from './articles.repository.js';
import { slugify, ensureUniqueSlug } from '../../../core/lib/slug.js';
import { NotFoundError, ValidationError } from '../../../core/lib/errors.js';
import { sanitizeArticleHtml, stripHtml } from '../../../core/lib/sanitize.js';
import db from '../../../core/db/connection.js';

let _mediaById = null;
function mediaByIdStmt() {
  if (_mediaById) return _mediaById;
  _mediaById = db.prepare(
    'SELECT id, filename FROM media WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL'
  );
  return _mediaById;
}

function attachMediaUrls(article, tenantId, uploadBaseUrl) {
  if (!article) return null;
  const decorate = (mediaId) => {
    if (!mediaId) return null;
    const m = mediaByIdStmt().get(mediaId, tenantId);
    if (!m) return null;
    return { id: m.id, url: uploadBaseUrl + '/' + m.filename };
  };
  return {
    ...article,
    cover_image: decorate(article.cover_media_id),
    meta_og_image_url: decorate(article.meta_og_image),
  };
}

export const articlesService = {

  list(opts, tenantId, uploadBaseUrl) {
    const result = articlesRepository.findMany({ ...opts, tenantId });
    return {
      ...result,
      rows: result.rows.map(r => attachMediaUrls(r, tenantId, uploadBaseUrl)),
    };
  },

  getPublishedBySlug(slug, tenantId, uploadBaseUrl) {
    const article = articlesRepository.findBySlug(slug, tenantId);
    if (!article || article.status !== 'published') {
      throw new NotFoundError('Article not found', 'ARTICLE_NOT_FOUND');
    }
    return attachMediaUrls(article, tenantId, uploadBaseUrl);
  },

  getById(id, tenantId, uploadBaseUrl) {
    const article = articlesRepository.findById(id, tenantId);
    if (!article) {
      throw new NotFoundError('Article not found', 'ARTICLE_NOT_FOUND');
    }
    return attachMediaUrls(article, tenantId, uploadBaseUrl);
  },

  create(input, userId, tenantId, uploadBaseUrl) {
    if (!input.title || input.title.trim() === '') {
      throw new ValidationError('Title is required');
    }

    const baseSlug = input.slug ? slugify(input.slug) : slugify(input.title);
    const slug = ensureUniqueSlug(baseSlug, (s) => articlesRepository.slugExists(s, tenantId));

    let publishedAt = input.published_at || null;
    if (input.status === 'published' && !publishedAt) {
      publishedAt = new Date().toISOString();
    }
    if (input.status !== 'published') {
      publishedAt = null;
    }

    const cleanContent = sanitizeArticleHtml(input.content_html || '');
    const cleanExcerpt = stripHtml(input.excerpt || '').slice(0, 500);
    const cleanMetaDesc = stripHtml(input.meta_description || '').slice(0, 300);

    const created = articlesRepository.create(tenantId, {
      slug,
      title: input.title.trim(),
      excerpt: cleanExcerpt,
      content_html: cleanContent,
      cover_media_id: input.cover_media_id || null,
      status: input.status || 'draft',
      published_at: publishedAt,
      meta_title: (input.meta_title || '').trim().slice(0, 160),
      meta_description: cleanMetaDesc,
      meta_og_image: input.meta_og_image || null,
      author_id: userId,
    });

    return attachMediaUrls(created, tenantId, uploadBaseUrl);
  },

  update(id, input, tenantId, uploadBaseUrl) {
    const existing = articlesRepository.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundError('Article not found', 'ARTICLE_NOT_FOUND');
    }

    let newSlug = existing.slug;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      const base = slugify(input.slug || input.title || existing.title);
      newSlug = ensureUniqueSlug(base, (s) => s !== existing.slug && articlesRepository.slugExists(s, tenantId));
    }

    let publishedAt = input.published_at !== undefined ? input.published_at : existing.published_at;
    const newStatus = input.status || existing.status;
    if (newStatus === 'published' && !publishedAt) {
      publishedAt = new Date().toISOString();
    }
    if (newStatus !== 'published') {
      publishedAt = null;
    }

    const updateData = {
      ...input,
      slug: newSlug,
      published_at: publishedAt,
    };
    if (input.content_html !== undefined) {
      updateData.content_html = sanitizeArticleHtml(input.content_html);
    }
    if (input.excerpt !== undefined) {
      updateData.excerpt = stripHtml(input.excerpt).slice(0, 500);
    }
    if (input.meta_description !== undefined) {
      updateData.meta_description = stripHtml(input.meta_description).slice(0, 300);
    }

    const updated = articlesRepository.update(id, tenantId, updateData);
    return attachMediaUrls(updated, tenantId, uploadBaseUrl);
  },

  publish(id, tenantId, uploadBaseUrl) {
    return this.update(id, { status: 'published' }, tenantId, uploadBaseUrl);
  },

  archive(id, tenantId, uploadBaseUrl) {
    return this.update(id, { status: 'archived' }, tenantId, uploadBaseUrl);
  },

  softDelete(id, tenantId) {
    const ok = articlesRepository.softDelete(id, tenantId);
    if (!ok) throw new NotFoundError('Article not found', 'ARTICLE_NOT_FOUND');
    return { deleted: true, soft: true };
  },

  restore(id, tenantId) {
    const ok = articlesRepository.restore(id, tenantId);
    if (!ok) throw new NotFoundError('Article not found or not deleted', 'NOT_DELETED');
    return { restored: true };
  },

  hardDelete(id, tenantId) {
    const ok = articlesRepository.hardDelete(id, tenantId);
    if (!ok) throw new NotFoundError('Article not found', 'ARTICLE_NOT_FOUND');
    return { deleted: true, hard: true };
  },
};
