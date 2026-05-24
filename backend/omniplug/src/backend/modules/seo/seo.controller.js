/**
 * seo/seo.controller.js — HTTP layer for SEO surfaces.
 *
 * Two routers exported:
 *
 *   rootRouter   — mounted at the SERVER ROOT (not under /api/):
 *                  /sitemap.xml, /robots.txt, /llms.txt, /feed.xml
 *                  These must be at root for crawler convention. They are
 *                  tenant-resolved by Host header (resolveTenantFromHost).
 *
 *   jsonLdRouter — mounted at /api/public/jsonld:
 *                  GET /article/:slug
 *                  GET /project/:slug
 *                  GET /site  (organization + website + breadcrumb home)
 *                  Returns JSON-LD blocks the frontend embeds in <script
 *                  type="application/ld+json"> tags. Done as a separate
 *                  endpoint so the frontend can fetch in parallel with the
 *                  main content fetch — they share an edge cache.
 *
 * Caching strategy:
 *   - Surface endpoints (sitemap/robots/llms/feed) → CDN s-maxage 3600s
 *     (1h). Stale-while-revalidate up to 1 day. Crawlers hit once per hour
 *     fresh; the rest is edge-served.
 *   - JSON-LD endpoints → s-maxage 300s (5min). Lower because content can
 *     change inline edits.
 *   - All endpoints set Vary: Host so multi-tenant edge caches do not mix.
 *   - ETag header from a content hash → 304 if browser/crawler revalidates.
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { NotFoundError } from '../../../core/lib/errors.js';
import { seoService } from './seo.service.js';

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/**
 * Set cache headers and emit content with an ETag. If the client's
 * If-None-Match matches, return 304 with no body.
 *
 * Why ETag here rather than just s-maxage: an AI crawler (especially
 * GPTBot) revalidates aggressively. ETag lets us return 304 in ~5ms instead
 * of streaming the full sitemap, which can be 100KB+.
 */
function sendCached(res, body, contentType, sMaxAge) {
  const etag = '"' + crypto
    .createHash('sha1')
    .update(body)
    .digest('base64')
    .replace(/=+$/, '') + '"';

  res.set('Content-Type', contentType);
  res.set('ETag', etag);
  res.set('Vary', 'Host');
  res.set('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400, max-age=300`);

  if (res.req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }
  res.send(body);
}

function sendJson(res, obj, sMaxAge) {
  const body = JSON.stringify(obj);
  sendCached(res, body, 'application/json; charset=utf-8', sMaxAge);
}

// ---------------------------------------------------------------------
// Root-level router (sitemap, robots, llms, feed)
// ---------------------------------------------------------------------

export const rootRouter = Router();

rootRouter.get('/sitemap.xml', asyncHandler((req, res) => {
  const body = seoService.generateSitemap(req.tenantId);
  sendCached(res, body, 'application/xml; charset=utf-8', 3600);
}));

rootRouter.get('/robots.txt', asyncHandler((req, res) => {
  const body = seoService.generateRobotsTxt(req.tenantId);
  sendCached(res, body, 'text/plain; charset=utf-8', 3600);
}));

rootRouter.get('/llms.txt', asyncHandler((req, res) => {
  const body = seoService.generateLlmsTxt(req.tenantId);
  // llms.txt should be served as text/markdown per the proposed spec; text/plain
  // is the safe fallback for clients that don't know the type yet.
  sendCached(res, body, 'text/markdown; charset=utf-8', 3600);
}));

rootRouter.get('/feed.xml', asyncHandler((req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const body = seoService.generateRssFeed(req.tenantId, limit);
  sendCached(res, body, 'application/rss+xml; charset=utf-8', 3600);
}));

// ---------------------------------------------------------------------
// JSON-LD router (mounted at /api/public/jsonld)
// ---------------------------------------------------------------------

export const jsonLdRouter = Router();

/**
 * GET /api/public/jsonld/site
 * Returns an array of sitewide JSON-LD blocks: Organization + WebSite.
 * Frontend includes once in the layout, in a single <script> tag with the
 * @graph wrapper, or as separate tags — both are valid.
 */
jsonLdRouter.get('/site', asyncHandler((req, res) => {
  const org = seoService.buildOrganizationJsonLd(req.tenantId);
  const site = seoService.buildWebsiteJsonLd(req.tenantId);
  const graph = [org, site].filter(Boolean);
  sendJson(res, {
    '@context': 'https://schema.org',
    '@graph': graph,
  }, 300);
}));

/**
 * GET /api/public/jsonld/article/:slug
 * Returns BlogPosting JSON-LD + breadcrumb for an article.
 */
jsonLdRouter.get('/article/:slug', asyncHandler((req, res) => {
  const article = seoService.buildArticleJsonLd(req.tenantId, req.params.slug);
  if (!article) throw new NotFoundError('Article not found', 'ARTICLE_NOT_FOUND');
  const breadcrumb = seoService.buildBreadcrumbJsonLd(req.tenantId, [
    { name: 'Home', url: '/' },
    { name: 'Articles', url: '/articles' },
    { name: article.headline, url: '/articles/' + req.params.slug },
  ]);
  sendJson(res, {
    '@context': 'https://schema.org',
    '@graph': [article, breadcrumb].filter(Boolean),
  }, 300);
}));

/**
 * GET /api/public/jsonld/project/:slug
 * Returns vertical-specific project schema + breadcrumb.
 */
jsonLdRouter.get('/project/:slug', asyncHandler((req, res) => {
  const project = seoService.buildProjectJsonLd(req.tenantId, req.params.slug);
  if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
  const breadcrumb = seoService.buildBreadcrumbJsonLd(req.tenantId, [
    { name: 'Home', url: '/' },
    { name: 'Projects', url: '/projects' },
    { name: project.name, url: '/projects/' + req.params.slug },
  ]);
  sendJson(res, {
    '@context': 'https://schema.org',
    '@graph': [project, breadcrumb].filter(Boolean),
  }, 300);
}));

/**
 * POST /api/public/jsonld/faq
 * Helper to convert an FAQ payload into JSON-LD. Frontend can call this
 * with whatever Q&A structure it has — keeps the schema knowledge on the
 * backend. Cached lightly because FAQ payload varies per call.
 */
jsonLdRouter.post('/faq', asyncHandler((req, res) => {
  const faqs = Array.isArray(req.body?.faqs) ? req.body.faqs : [];
  const out = seoService.buildFaqJsonLd(faqs);
  if (!out) {
    res.set('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'faqs must be a non-empty array of {question, answer}' });
  }
  // Not cached — POST with body. Frontend will inline the result.
  res.set('Cache-Control', 'no-store');
  res.json(out);
}));
