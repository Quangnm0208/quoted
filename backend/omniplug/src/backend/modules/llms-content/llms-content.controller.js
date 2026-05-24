/**
 * llms-content controller — serves llms.txt and per-post markdown for AI bots.
 * PUBLIC endpoints (no JWT). Tenant resolved by Host header *or* the
 * X-Quoted-Domain header (so a Cloudflare/Fly-style vhost setup can still
 * target a tenant whose .domain is the WP site, not the API host).
 *
 * Mounted at /api/public/llm.
 */

import { Router } from 'express';
import { tenancy } from '../../../core/lib/tenancy.js';
import { quotedPostsRepository } from '../wp-sites/quoted-posts.repository.js';
import { serializeArticleAsMarkdown, buildSitemapMarkdown } from './markdown.serializer.js';

const router = Router();
const CACHE_TTL_SECONDS = 86400;

/**
 * Resolve tenant from X-Quoted-Domain header (preferred) or Host fallback.
 * The Quoted plugin sets X-Quoted-Domain to the WordPress site's domain on
 * every request because the API may live on a different host (api.quoted.io).
 */
function resolveQuotedTenant(req) {
  const xqd = req.headers['x-quoted-domain'];
  if (xqd && typeof xqd === 'string') {
    // Explicit header — strict resolution. Unknown domain → null (404),
    // do NOT silently fall back to the Host tenant (which would mask plugin
    // mis-configuration during onboarding).
    return tenancy.byDomain(xqd);
  }
  return req.tenant || null;
}

router.get('/sitemap.txt', (req, res) => {
  const tenant = resolveQuotedTenant(req);
  if (!tenant) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.status(404).send('# Site not registered with Quoted\n');
  }

  const posts = quotedPostsRepository.findPublishedByTenant(tenant.id, { limit: 200 });
  const md = buildSitemapMarkdown({
    siteName:    tenant.name || tenant.domain,
    siteDomain:  tenant.domain,
    description: '',
    articles:    posts,
  });

  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('Cache-Control', `public, max-age=300, s-maxage=${CACHE_TTL_SECONDS}`);
  res.set('X-Quoted-Version', '1');
  return res.send(md);
});

router.get('/posts/:slug.md', (req, res) => {
  const tenant = resolveQuotedTenant(req);
  if (!tenant) {
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    return res.status(404).send('# Site not registered with Quoted\n');
  }

  const slug = String(req.params.slug || '').trim();
  if (!slug) {
    return res.status(400).send('# Invalid slug\n');
  }

  const post = quotedPostsRepository.findBySlug(tenant.id, slug);
  if (!post) {
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    return res.status(404).send(`# Not found\n\nNo content at slug: ${slug}\n`);
  }

  const md = serializeArticleAsMarkdown(post, { canonicalDomain: tenant.domain });

  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('Cache-Control', `public, max-age=300, s-maxage=${CACHE_TTL_SECONDS}`);
  res.set('X-Quoted-Version', '1');
  return res.send(md);
});

export default router;
