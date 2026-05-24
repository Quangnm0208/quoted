/**
 * seo-validator/seo-validator.service.js — Orchestrator.
 *
 * Two integration points:
 *   1. POST /api/admin/articles/:id/seo-score (preview, no persist)
 *   2. Publish-time hook (throws on blocker, persists score on success)
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';
import { articlesRepository } from '../articles/articles.repository.js';
import { projectsRepository } from '../projects/projects.repository.js';
import { MediaRepository } from '../media/media.repository.js';
import { siteRepository } from '../site/site.repository.js';
import { tenancy } from '../../../core/lib/tenancy.js';
import { ValidationError } from '../../../core/lib/errors.js';
import { runRules, htmlToText, parseDom } from './seo-validator.rules.js';
import { CONTENT_HTML_MAX_BYTES } from '../articles/articles.schema.js';

// v1.4.3 fix for BUG #4: cache the score-persist UPDATE statements (was
// db.prepare() called per publish — wasteful re-parse on hot path).
const stmt = lazyPrepare(() => ({
  updateArticleScore: db.prepare(`
    UPDATE articles SET seo_score = ?, seo_score_at = datetime('now'),
        seo_score_breakdown = ? WHERE id = ? AND tenant_id = ?
  `),
  updateProjectScore: db.prepare(`
    UPDATE projects SET seo_score = ?, seo_score_at = datetime('now'),
        seo_score_breakdown = ? WHERE id = ? AND tenant_id = ?
  `),
}));

// v1.4.3 fix for BUG #17/#18: guard against oversize content_html BEFORE
// reaching jsdom parseDom(). The schema also caps writes, but rows from
// before this fix shipped or via other write paths could still have huge
// content. Defense-in-depth: check at validator entry too.
function guardContentSize(content) {
  if (!content) return;
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > CONTENT_HTML_MAX_BYTES) {
    throw new ValidationError(
      `Nội dung quá lớn để chấm điểm SEO (${(bytes / 1000).toFixed(0)}KB > ${CONTENT_HTML_MAX_BYTES / 1000}KB). ` +
      `Vui lòng cắt nhỏ bài viết hoặc giảm ảnh nhúng inline.`,
      'CONTENT_HTML_TOO_LARGE',
    );
  }
}

function loadReferencedImages(tenantId, contentDom, coverMediaId, ogImageId) {
  const ids = new Set();
  if (coverMediaId) ids.add(coverMediaId);
  if (ogImageId) ids.add(ogImageId);
  if (contentDom) {
    const imgs = contentDom.querySelectorAll('img[data-media-id]');
    imgs.forEach((img) => {
      const id = parseInt(img.getAttribute('data-media-id'), 10);
      if (id) ids.add(id);
    });
  }
  const out = [];
  const mediaRepo = MediaRepository.scopeTo(tenantId);
  for (const id of ids) {
    try {
      const m = mediaRepo.findById(id);
      if (m) {
        out.push({
          id: m.id,
          url: m.url,
          alt: m.alt || '',
          width: m.width,
          height: m.height,
          byte_size: m.byte_size || m.file_size || 0,
        });
      }
    } catch { /* skip */ }
  }
  return out;
}

function countInternalLinks(contentDom, tenantDomain) {
  if (!contentDom) return 0;
  const anchors = contentDom.querySelectorAll('a[href]');
  let count = 0;
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    if (!href) continue;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
      count++;
      continue;
    }
    try {
      const u = new URL(href);
      if (u.host === tenantDomain || u.host === 'www.' + tenantDomain) count++;
    } catch { /* skip */ }
  }
  return count;
}

function checkOgImage(tenantId, ogImageId, coverMediaId) {
  const candidates = [ogImageId, coverMediaId].filter(Boolean);
  const mediaRepo = MediaRepository.scopeTo(tenantId);
  for (const id of candidates) {
    try {
      const m = mediaRepo.findById(id);
      if (m && m.url) return { ok: true, url: m.url, source: 'entity' };
    } catch { /* skip */ }
  }
  try {
    const defaultUrl = siteRepository.getConfigValue(tenantId, 'seo.default_og_image_url');
    if (defaultUrl && typeof defaultUrl === 'string' && defaultUrl.length > 0) {
      return { ok: true, url: defaultUrl, source: 'tenant_default' };
    }
  } catch { /* skip */ }
  return { ok: false, error: 'No OG image configured.' };
}

function buildOpts(tenantId, entity, tenant) {
  const content = entity.content_html || entity.description || '';
  // v1.4.3 fix for BUG #17/#18: reject oversize BEFORE jsdom parseDom().
  guardContentSize(content);
  const contentText = htmlToText(content);
  const contentDom = parseDom(content);
  const images = loadReferencedImages(tenantId, contentDom, entity.cover_media_id, entity.og_image_id);
  const internalLinkCount = countInternalLinks(contentDom, tenant && tenant.domain);
  const ogImageResolved = checkOgImage(tenantId, entity.og_image_id, entity.cover_media_id);
  return {
    images,
    tenant: tenant ? { display_name: tenant.display_name, domain: tenant.domain } : null,
    internalLinkCount,
    contentText,
    contentDom,
    ogImageResolved,
  };
}

function requireTenant(tenantId) {
  const tenant = tenancy.byId(tenantId);
  if (!tenant) throw new ValidationError('Tenant not found');
  return tenant;
}

export function scoreArticle(tenantId, articleId) {
  const article = articlesRepository.findById(articleId, tenantId);
  if (!article) throw new ValidationError('Article not found');
  const tenant = requireTenant(tenantId);
  const opts = buildOpts(tenantId, article, tenant);
  return runRules(article, opts);
}

export function scoreProject(tenantId, projectId) {
  const project = projectsRepository.findById(projectId, tenantId);
  if (!project) throw new ValidationError('Project not found');
  const tenant = requireTenant(tenantId);
  const opts = buildOpts(tenantId, project, tenant);
  return runRules(project, opts);
}

export function enforcePublish(tenantId, entityType, entityId) {
  const result = entityType === 'article'
    ? scoreArticle(tenantId, entityId)
    : scoreProject(tenantId, entityId);

  if (!result.can_publish) {
    const msgs = result.blockers.map((b) => '• ' + b.message).join('\n');
    throw new ValidationError(
      'Bài viết chưa đạt chuẩn SEO. Sửa các lỗi sau:\n' + msgs,
      'SEO_BLOCKERS_PRESENT',
    );
  }

  try {
    // v1.4.3 fix for BUG #4: use cached prepared statements instead of
    // db.prepare(updateSql) per call. Same logical behaviour.
    const breakdown = JSON.stringify({
      blockers: result.blockers.map((r) => r.id),
      warnings: result.warnings.map((r) => r.id),
      passed: result.passed.map((r) => r.id),
      computed_at: new Date().toISOString(),
    });
    if (entityType === 'article') {
      stmt().updateArticleScore.run(result.score, breakdown, entityId, tenantId);
    } else {
      stmt().updateProjectScore.run(result.score, breakdown, entityId, tenantId);
    }
  } catch (err) {
    console.warn('[seo-validator] score persist failed:', err.message);
  }

  return result;
}

export const seoValidatorService = {
  scoreArticle,
  scoreProject,
  enforcePublish,
};
