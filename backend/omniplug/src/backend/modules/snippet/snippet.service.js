/**
 * snippet/snippet.service.js — Head-tag payload generator.
 *
 * The frontend (Next.js / Astro / static) calls these endpoints and
 * renders the resulting JSON straight into the page <head>. Backend is
 * the single source of truth for what should appear in:
 *   <title>, <meta name="description">, <meta name="keywords">
 *   <link rel="canonical">
 *   <meta name="robots">
 *   <meta property="og:*">
 *   <meta name="twitter:*">
 *
 * Fallback chain for each field:
 *   1. Entity-specific override (article.seo_title, etc.)
 *   2. Entity's natural content (article.title, article.excerpt)
 *   3. Tenant-level default (site_config seo.* keys)
 *   4. Hardcoded sensible default
 *
 * This module is pure / read-only. No writes.
 */

import { tenancy } from '../../../core/lib/tenancy.js';
import { siteRepository } from '../site/site.repository.js';
import { articlesRepository } from '../articles/articles.repository.js';
import { projectsRepository } from '../projects/projects.repository.js';
import { pagesRepository } from '../pages/pages.repository.js';
import { MediaRepository } from '../media/media.repository.js';

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

function getTenantConfig(tenantId, key) {
  try {
    const v = siteRepository.getConfigValue(tenantId, key);
    return v;
  } catch {
    return null;
  }
}

function asAbsoluteUrl(host, value) {
  if (!value) return '';
  if (ABSOLUTE_URL_REGEX.test(value)) return value;
  if (value.startsWith('/')) return 'https://' + host + value;
  return 'https://' + host + '/' + value;
}

function parseJsonField(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed != null ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function resolveOgImage(tenantId, entityOgImageId, fallbackCoverId, tenant, host) {
  // Priority: entity.og_image_id → entity.cover_media_id → tenant default
  const candidates = [entityOgImageId, fallbackCoverId].filter(Boolean);
  const mediaRepo = MediaRepository.scopeTo(tenantId);
  for (const id of candidates) {
    try {
      const media = mediaRepo.findById(id);
      if (media && media.url) {
        return {
          url: asAbsoluteUrl(host, media.url),
          width: media.width || 1200,
          height: media.height || 630,
          alt: media.alt || '',
        };
      }
    } catch {
      // continue to next candidate
    }
  }
  // Fallback: tenant default
  const defaultUrl = getTenantConfig(tenantId, 'seo.default_og_image_url');
  if (defaultUrl) {
    return {
      url: asAbsoluteUrl(host, defaultUrl),
      width: 1200,
      height: 630,
      alt: tenant ? tenant.display_name : '',
    };
  }
  return null;
}

function truncate(s, max) {
  if (!s) return '';
  s = String(s).trim();
  if (s.length <= max) return s;
  // Trim at word boundary
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

/**
 * Build snippet payload for an article.
 */
export function buildArticleSnippet(tenantId, slug) {
  const tenant = tenancy.byId(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const article = articlesRepository.findBySlugForPublic(tenantId, slug);
  if (!article) return null;

  const host = tenant.domain;
  const canonical = article.canonical_url ||
    asAbsoluteUrl(host, '/articles/' + article.slug);

  const title = truncate(article.seo_title || article.title || tenant.display_name, 70);
  const description = truncate(article.seo_description || article.excerpt || '', 170);

  const og = {
    title: truncate(article.seo_title || article.title, 95),
    description,
    type: 'article',
    url: canonical,
    site_name: tenant.display_name,
    locale: 'vi_VN',
  };
  const ogImage = resolveOgImage(
    tenantId, article.og_image_id, article.cover_media_id, tenant, host
  );
  if (ogImage) {
    og.image = ogImage.url;
    og.image_width = ogImage.width;
    og.image_height = ogImage.height;
    og.image_alt = ogImage.alt;
  }

  const twitterHandle = getTenantConfig(tenantId, 'seo.twitter_handle') || '';
  const twitter = {
    card: ogImage ? 'summary_large_image' : 'summary',
    title: og.title,
    description: og.description,
  };
  if (ogImage) twitter.image = ogImage.url;
  if (twitterHandle) twitter.site = twitterHandle;

  return {
    title,
    description,
    keywords: article.meta_keywords || '',
    canonical,
    robots: article.robots_directive || 'index,follow',
    og,
    twitter,
    article: {
      published_time: article.published_at || article.created_at,
      modified_time: article.updated_at,
      author: article.author_name || tenant.display_name,
      section: article.category || null,
      tags: parseJsonField(article.tags, []),
    },
    jsonld_url: '/api/public/jsonld/article/' + article.slug,
  };
}

/**
 * Build snippet payload for a project.
 */
export function buildProjectSnippet(tenantId, slug) {
  const tenant = tenancy.byId(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const project = projectsRepository.findBySlugForPublic(tenantId, slug);
  if (!project) return null;

  const host = tenant.domain;
  const canonical = project.canonical_url ||
    asAbsoluteUrl(host, '/projects/' + project.slug);

  const title = truncate(project.seo_title || project.name || tenant.display_name, 70);
  const description = truncate(project.seo_description || project.description || '', 170);

  const og = {
    title: truncate(project.seo_title || project.name, 95),
    description,
    type: 'website',
    url: canonical,
    site_name: tenant.display_name,
    locale: 'vi_VN',
  };
  const ogImage = resolveOgImage(
    tenantId, project.og_image_id, project.cover_media_id, tenant, host
  );
  if (ogImage) {
    og.image = ogImage.url;
    og.image_width = ogImage.width;
    og.image_height = ogImage.height;
    og.image_alt = ogImage.alt;
  }

  const twitter = {
    card: ogImage ? 'summary_large_image' : 'summary',
    title: og.title,
    description: og.description,
  };
  if (ogImage) twitter.image = ogImage.url;
  const twitterHandle = getTenantConfig(tenantId, 'seo.twitter_handle') || '';
  if (twitterHandle) twitter.site = twitterHandle;

  return {
    title,
    description,
    keywords: project.meta_keywords || '',
    canonical,
    robots: project.robots_directive || 'index,follow',
    og,
    twitter,
    jsonld_url: '/api/public/jsonld/project/' + project.slug,
  };
}

/**
 * Build snippet payload for a page (homepage, landing, etc).
 */
export function buildPageSnippet(tenantId, pageKey) {
  const tenant = tenancy.byId(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const page = pagesRepository.findByKey
    ? pagesRepository.findByKey(tenantId, pageKey)
    : null;
  // Pages may not have a strict findByKey method on all installs;
  // fall back to tenant-level defaults if no page row.
  const host = tenant.domain;
  const canonical = (page && page.canonical_url) ||
    asAbsoluteUrl(host, '/' + (pageKey === 'home' ? '' : pageKey));

  const title = truncate(
    (page && page.seo_title) || tenant.display_name,
    70
  );
  const description = truncate(
    (page && page.seo_description) || getTenantConfig(tenantId, 'site.description') || '',
    170
  );

  const og = {
    title,
    description,
    type: 'website',
    url: canonical,
    site_name: tenant.display_name,
    locale: 'vi_VN',
  };
  const ogImage = resolveOgImage(
    tenantId,
    page ? page.og_image_id : null,
    null,
    tenant,
    host
  );
  if (ogImage) {
    og.image = ogImage.url;
    og.image_width = ogImage.width;
    og.image_height = ogImage.height;
    og.image_alt = ogImage.alt;
  }

  const twitter = {
    card: ogImage ? 'summary_large_image' : 'summary',
    title,
    description,
  };
  if (ogImage) twitter.image = ogImage.url;
  const twitterHandle = getTenantConfig(tenantId, 'seo.twitter_handle') || '';
  if (twitterHandle) twitter.site = twitterHandle;

  return {
    title,
    description,
    keywords: (page && page.meta_keywords) || '',
    canonical,
    robots: (page && page.robots_directive) || 'index,follow',
    og,
    twitter,
    jsonld_url: '/api/public/jsonld/site',
  };
}

// Pure helpers exported for testing
export const _internals = {
  truncate,
  asAbsoluteUrl,
  parseJsonField,
};

export const snippetService = {
  buildArticleSnippet,
  buildProjectSnippet,
  buildPageSnippet,
};
