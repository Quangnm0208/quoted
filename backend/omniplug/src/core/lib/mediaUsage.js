/**
 * core/mediaUsage.js — Media reference tracking (v1.4.4 tenant-scoped).
 *
 * Mục đích: chặn admin xóa nhầm ảnh đang dùng làm cover.
 * Quan trọng cho multi-tenant: KHÔNG được expose usage của tenant khác,
 * nên mọi query có WHERE tenant_id = ?.
 *
 * Performance note: cho landing scale (< 1000 articles/projects per tenant),
 * 6 queries này < 5ms. Khi scale lớn → denormalize sang media_references table.
 */

import db from '../db/connection.js';

// Lazy-initialized prepared statements (startup hardening).
let _queries = null;
function queries() {
  if (_queries) return _queries;
  _queries = {
  articleCovers: db.prepare(`
    SELECT id, title, 'cover' AS role
    FROM articles
    WHERE cover_media_id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  articleOgImages: db.prepare(`
    SELECT id, title, 'og_image' AS role
    FROM articles
    WHERE meta_og_image = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  projectCovers: db.prepare(`
    SELECT id, name, 'cover' AS role
    FROM projects
    WHERE cover_media_id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  milestoneCovers: db.prepare(`
    SELECT m.id, m.title, p.name AS project_name, 'milestone' AS role
    FROM project_milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE m.cover_media_id = ? AND m.tenant_id = ? AND p.deleted_at IS NULL
  `),
  galleryItems: db.prepare(`
    SELECT g.project_id, p.name AS project_name, g.id AS gallery_item_id, 'gallery' AS role
    FROM project_gallery g
    JOIN projects p ON p.id = g.project_id
    WHERE g.media_id = ? AND g.tenant_id = ? AND p.deleted_at IS NULL
  `),
  pageSections: db.prepare(`
    SELECT id, page_key, section_key, 'page_section' AS role
    FROM page_sections
    WHERE tenant_id = ? AND payload_json LIKE ?
  `),
};
  return _queries;
}

/**
 * @param {number} mediaId
 * @param {number} tenantId   tenantId is required; usage is scoped per tenant
 */
export function getMediaUsage(mediaId, tenantId) {
  const id = parseInt(mediaId, 10);
  if (Number.isNaN(id)) return [];
  if (typeof tenantId !== 'number') {
    throw new Error('getMediaUsage: tenantId required');
  }

  const usage = [];
  for (const row of queries().articleCovers.all(id, tenantId))    usage.push({ type: 'article', ...row });
  for (const row of queries().articleOgImages.all(id, tenantId))  usage.push({ type: 'article', ...row });
  for (const row of queries().projectCovers.all(id, tenantId))    usage.push({ type: 'project', ...row });
  for (const row of queries().milestoneCovers.all(id, tenantId))  usage.push({ type: 'milestone', ...row });
  for (const row of queries().galleryItems.all(id, tenantId))     usage.push({ type: 'gallery_item', ...row });

  // Page sections — best-effort JSON match
  const likePattern = '%"media_id"%' + id + '%';
  for (const row of queries().pageSections.all(tenantId, likePattern)) {
    if (sectionUsesMedia(row.id, id, tenantId)) {
      usage.push({ type: 'page_section', ...row });
    }
  }

  return usage;
}

function sectionUsesMedia(sectionId, mediaId, tenantId) {
  const row = db.prepare(
    'SELECT payload_json FROM page_sections WHERE id = ? AND tenant_id = ?'
  ).get(sectionId, tenantId);
  if (!row) return false;
  try {
    return jsonContainsMediaId(JSON.parse(row.payload_json), mediaId);
  } catch { return false; }
}

function jsonContainsMediaId(obj, mediaId) {
  if (obj == null) return false;
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(item => jsonContainsMediaId(item, mediaId));
  for (const [k, v] of Object.entries(obj)) {
    if ((k === 'media_id' || k.endsWith('_media_id')) && parseInt(v, 10) === mediaId) return true;
    if (typeof v === 'object' && jsonContainsMediaId(v, mediaId)) return true;
  }
  return false;
}

export function formatUsage(usage) {
  if (!usage.length) return '';
  return usage.map(u => {
    if (u.type === 'article')      return `Bài viết "${u.title}" (${u.role})`;
    if (u.type === 'project')      return `Dự án "${u.name}" (${u.role})`;
    if (u.type === 'milestone')    return `Mốc "${u.title}" của dự án "${u.project_name}"`;
    if (u.type === 'gallery_item') return `Gallery của dự án "${u.project_name}"`;
    if (u.type === 'page_section') return `Section "${u.section_key}" trang ${u.page_key}`;
    return JSON.stringify(u);
  }).join('; ');
}
