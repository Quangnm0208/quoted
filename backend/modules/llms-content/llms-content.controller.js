/**
 * llms-content controller — serves llms.txt and markdown content for AI bots.
 *
 * PUBLIC endpoints (no JWT). Tenant resolved via Host header.
 *
 * Routes mounted at /api/public/llm
 *
 * @module llms-content/controller
 */

import { Router } from 'express';
import { tenantByHost } from '../../middleware/tenancy.js';
import { articlesRepo } from '../articles/articles.repository.js';
import { serializeArticleAsMarkdown, buildSitemapMarkdown } from './markdown.serializer.js';

const router = Router();

const CACHE_TTL_SECONDS = 86400; // 24h edge cache

/**
 * GET /api/public/llm/sitemap.txt
 * Serves the llms.txt content.
 */
router.get('/sitemap.txt', tenantByHost, async (req, res) => {
  if (!req.tenant) {
    res.set('Content-Type', 'text/plain');
    return res.status(404).send('# Site not registered with Quoted\n');
  }

  const tenant = req.tenant;
  const articles = await articlesRepo.findPublishedByTenant(tenant.id, { limit: 200 });

  const md = buildSitemapMarkdown({
    siteName:    tenant.name || tenant.domain,
    siteDomain:  tenant.domain,
    description: tenant.description || '',
    articles,
  });

  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('Cache-Control', `public, max-age=300, s-maxage=${CACHE_TTL_SECONDS}`);
  res.set('X-Quoted-Version', '1');
  return res.send(md);
});

/**
 * GET /api/public/llm/posts/:slug.md
 * Returns clean markdown for a single article.
 */
router.get('/posts/:slug.md', tenantByHost, async (req, res) => {
  if (!req.tenant) {
    return res.status(404).send('# Site not registered with Quoted\n');
  }

  const slug = String(req.params.slug || '').trim();
  if (!slug) {
    return res.status(400).send('# Invalid slug\n');
  }

  const article = await articlesRepo.findBySlug(req.tenant.id, slug);
  if (!article) {
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    return res.status(404).send(`# Not found\n\nNo content at slug: ${slug}\n`);
  }

  const md = serializeArticleAsMarkdown(article, {
    canonicalDomain: req.tenant.domain,
  });

  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('Cache-Control', `public, max-age=300, s-maxage=${CACHE_TTL_SECONDS}`);
  res.set('X-Quoted-Version', '1');
  return res.send(md);
});

export default router;
