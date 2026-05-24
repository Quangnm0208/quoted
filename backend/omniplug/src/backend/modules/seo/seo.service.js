/**
 * seo/seo.service.js — XML/text/JSON-LD generators.
 *
 * Outputs:
 *   - sitemap.xml          (Google + Bing + AI crawlers)
 *   - robots.txt           (AI crawlers explicit allow + sitemap pointer)
 *   - llms.txt             (LLM-readable site index, proposed standard)
 *   - feed.xml             (RSS 2.0, for AI agents + RSS readers)
 *   - JSON-LD per resource (Article / RealEstateListing / MedicalBusiness etc.)
 *
 * Performance principles:
 *   1. Cache the rendered string, not the raw DB rows. The expensive part
 *      is XML escaping + iteration, not the DB read.
 *   2. Edge cache (Vercel/Cloudflare) does the heavy lifting; this layer only
 *      serves origin revalidations. Cache-Control headers are set by the
 *      controller, not here.
 *   3. Vertical-aware JSON-LD: real-estate gets RealEstateListing, aesthetics
 *      gets MedicalBusiness, spa gets HealthClub, branding/professional get
 *      Service. The `industry` registry drives this.
 *
 * Security:
 *   - All user-supplied strings are XML-escaped before insertion. No
 *     template interpolation without escaping.
 *   - URLs are validated to be absolute and HTTPS in production. Relative
 *     URLs in sitemap would silently be re-resolved by crawlers against the
 *     wrong base.
 */

import { industry } from '../../../industries/registry.js';
import { seoRepository } from './seo.repository.js';
import { seoCache } from './seo.cache.js';

// =====================================================================
// XML / URL helpers
// =====================================================================

/**
 * XML-escape a string for use as element content or attribute value.
 * The 5 named entities are sufficient — XML 1.0 §2.4.
 */
function xmlEscape(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build the canonical absolute base URL for a tenant.
 * Falls back to a relative scheme if no domain is configured (dev only).
 */
function tenantBaseUrl(tenant) {
  if (!tenant || !tenant.domain) {
    // Dev fallback. In production tenancy middleware blocks this path.
    return 'http://localhost';
  }
  return 'https://' + tenant.domain;
}

/**
 * Convert SQLite "YYYY-MM-DD HH:MM:SS" or ISO string to ISO-8601 with Z.
 * Sitemap and Atom both require W3C datetime format.
 */
function toIso(s) {
  if (!s) return null;
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" (no T, no Z).
  // Date(s) parses both that and ISO strings; toISOString normalizes.
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// =====================================================================
// sitemap.xml
// =====================================================================

/**
 * Generate sitemap.xml for a tenant. Includes:
 *   - Homepage (priority 1.0, weekly)
 *   - Each visible page_key (priority 0.8, weekly)
 *   - Each published article (priority 0.6, monthly)
 *   - Each non-deleted project (priority 0.7, weekly)
 *
 * Sizes: capped at 50k URLs per file per sitemaps.org spec. We do not yet
 * split into a sitemap index — a single tenant with >50k URLs would need it.
 * That is a v1.5 concern; for now we just clip at 50k (the DB query also
 * limits).
 */
export function generateSitemap(tenantId) {
  const cached = seoCache.get(tenantId, 'sitemap');
  if (cached) return cached;

  const tenant = seoRepository.tenantById(tenantId);
  if (!tenant) {
    // Shouldn't happen after tenant middleware; defensive.
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
  }
  const base = tenantBaseUrl(tenant);

  const articles = seoRepository.listArticlesForSitemap(tenantId);
  const projects = seoRepository.listProjectsForSitemap(tenantId);
  const pages = seoRepository.listPageKeysForSitemap(tenantId);

  // Find the freshest lastmod across all content for the homepage entry.
  let homepageLastmod = tenant.updated_at || null;
  for (const row of articles) {
    if (!homepageLastmod || row.lastmod > homepageLastmod) homepageLastmod = row.lastmod;
  }
  for (const row of projects) {
    if (!homepageLastmod || row.lastmod > homepageLastmod) homepageLastmod = row.lastmod;
  }

  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  // Homepage
  parts.push('  <url>');
  parts.push('    <loc>' + xmlEscape(base + '/') + '</loc>');
  if (homepageLastmod) parts.push('    <lastmod>' + xmlEscape(toIso(homepageLastmod) || '') + '</lastmod>');
  parts.push('    <changefreq>weekly</changefreq>');
  parts.push('    <priority>1.0</priority>');
  parts.push('  </url>');

  // Pages (page_key drives the URL path: e.g. page_key="about" → /about)
  for (const p of pages) {
    if (p.page_key === 'home') continue; // already emitted as homepage
    parts.push('  <url>');
    parts.push('    <loc>' + xmlEscape(base + '/' + p.page_key) + '</loc>');
    if (p.lastmod) parts.push('    <lastmod>' + xmlEscape(toIso(p.lastmod) || '') + '</lastmod>');
    parts.push('    <changefreq>monthly</changefreq>');
    parts.push('    <priority>0.8</priority>');
    parts.push('  </url>');
  }

  // Projects (URL convention: /du-an/<slug> for real-estate, /<plural>/<slug>
  // for other verticals — driven by industry.labels.plural slugified — but we
  // standardize on /projects/<slug> at the API boundary. Frontend rewrites if
  // it wants pretty URLs).
  for (const p of projects) {
    parts.push('  <url>');
    parts.push('    <loc>' + xmlEscape(base + '/projects/' + p.slug) + '</loc>');
    if (p.lastmod) parts.push('    <lastmod>' + xmlEscape(toIso(p.lastmod) || '') + '</lastmod>');
    parts.push('    <changefreq>weekly</changefreq>');
    parts.push('    <priority>0.7</priority>');
    parts.push('  </url>');
  }

  // Articles
  for (const a of articles) {
    parts.push('  <url>');
    parts.push('    <loc>' + xmlEscape(base + '/articles/' + a.slug) + '</loc>');
    if (a.lastmod) parts.push('    <lastmod>' + xmlEscape(toIso(a.lastmod) || '') + '</lastmod>');
    parts.push('    <changefreq>monthly</changefreq>');
    parts.push('    <priority>0.6</priority>');
    parts.push('  </url>');
  }

  parts.push('</urlset>');
  const out = parts.join('\n');
  seoCache.set(tenantId, 'sitemap', out);
  return out;
}

// =====================================================================
// robots.txt
// =====================================================================

/**
 * Generate robots.txt. We explicitly ALLOW the major AI crawlers because
 * that is the OmniPlug positioning (be discoverable to AI agents). Site
 * owners who want to opt out can override via site_config.robots_extra.
 *
 * Why explicit allows: some AI crawlers (Anthropic's ClaudeBot in particular)
 * do honor robots.txt aggressively. The default for the wider robotstxt-spec
 * is "allow if not disallowed", so explicit allows are technically redundant
 * but read as intent. They also document for site owners which AI bots are
 * expected. Disallow /admin/ remains.
 */
export function generateRobotsTxt(tenantId) {
  const cached = seoCache.get(tenantId, 'robots');
  if (cached) return cached;

  const tenant = seoRepository.tenantById(tenantId);
  const base = tenantBaseUrl(tenant);

  const lines = [];
  lines.push('# OmniPlug CMS — robots.txt');
  lines.push('# AI crawlers are explicitly welcomed. Override per-tenant via site config.');
  lines.push('');
  lines.push('User-agent: *');
  lines.push('Disallow: /admin/');
  lines.push('Disallow: /api/admin/');
  lines.push('Allow: /');
  lines.push('');
  // Named AI crawlers — listed so site owners can reason about them.
  for (const ua of [
    'GPTBot',          // OpenAI ChatGPT browse + training
    'OAI-SearchBot',   // OpenAI SearchGPT
    'ChatGPT-User',    // ChatGPT on-demand fetch
    'ClaudeBot',       // Anthropic
    'Claude-Web',      // Anthropic legacy
    'PerplexityBot',   // Perplexity
    'Perplexity-User', // Perplexity on-demand fetch
    'Google-Extended', // Gemini training opt-in
    'Applebot-Extended', // Apple Intelligence
    'CCBot',           // Common Crawl (feeds many models)
    'Amazonbot',       // Alexa / Amazon
    'Bytespider',      // ByteDance / Doubao
    'Meta-ExternalAgent', // Meta AI
  ]) {
    lines.push('User-agent: ' + ua);
    lines.push('Disallow: /admin/');
    lines.push('Allow: /');
    lines.push('');
  }

  lines.push('Sitemap: ' + base + '/sitemap.xml');
  lines.push('# LLM-friendly index:');
  lines.push('# ' + base + '/llms.txt');

  const out = lines.join('\n');
  seoCache.set(tenantId, 'robots', out);
  return out;
}

// =====================================================================
// llms.txt — LLM-readable site index
// Spec: https://llmstxt.org (proposed by Answer.AI, 2024)
// =====================================================================

/**
 * Generate llms.txt. The proposed standard is a markdown document with:
 *   # Site Name
 *   > One-sentence description.
 *   Optional details paragraphs.
 *   ## Section
 *   - [Title](url): optional description
 *
 * We keep it short on purpose. Long content goes in articles, which are
 * linked. AI agents that want full text follow the links.
 */
export function generateLlmsTxt(tenantId) {
  const cached = seoCache.get(tenantId, 'llms');
  if (cached) return cached;

  const tenant = seoRepository.tenantById(tenantId);
  if (!tenant) return '';
  const base = tenantBaseUrl(tenant);
  const cfg = seoRepository.siteConfigMap(tenantId);

  const siteName = cfg['site.name'] || tenant.name || tenant.slug;
  const tagline = cfg['site.tagline'] || cfg['hero.subtitle'] || '';
  const description = cfg['site.description'] || cfg['seo.description'] ||
    'Vietnamese ' + industry.name + ' website powered by OmniPlug CMS.';

  const articles = seoRepository.listArticlesForSitemap(tenantId).slice(0, 50);
  const projects = seoRepository.listProjectsForSitemap(tenantId).slice(0, 50);

  const out = [];
  out.push('# ' + siteName);
  out.push('');
  if (tagline) {
    out.push('> ' + tagline);
    out.push('');
  }
  out.push(description);
  out.push('');
  out.push('Industry: ' + industry.name);
  out.push('Canonical URL: ' + base);
  out.push('');

  if (projects.length) {
    out.push('## ' + industry.labels.plural);
    out.push('');
    for (const p of projects) {
      out.push('- [' + (p.name || p.slug) + '](' + base + '/projects/' + p.slug + ')');
    }
    out.push('');
  }

  if (articles.length) {
    out.push('## Articles');
    out.push('');
    for (const a of articles) {
      out.push('- [' + (a.title || a.slug) + '](' + base + '/articles/' + a.slug + ')');
    }
    out.push('');
  }

  out.push('## Machine-readable surfaces');
  out.push('');
  out.push('- Sitemap: ' + base + '/sitemap.xml');
  out.push('- RSS feed: ' + base + '/feed.xml');
  out.push('- Public API: ' + base + '/api/public/');
  out.push('');

  const result = out.join('\n');
  seoCache.set(tenantId, 'llms', result);
  return result;
}

// =====================================================================
// feed.xml — RSS 2.0
// =====================================================================

/**
 * Generate RSS 2.0 feed of the most recent published articles.
 * RSS 2.0 chosen over Atom for wider reader compatibility; AI agents handle
 * both fine. Limit 20 items by default — large feeds hurt cache density.
 */
export function generateRssFeed(tenantId, limit = 20) {
  const cached = seoCache.get(tenantId, 'feed:' + limit);
  if (cached) return cached;

  const tenant = seoRepository.tenantById(tenantId);
  if (!tenant) return '';
  const base = tenantBaseUrl(tenant);
  const cfg = seoRepository.siteConfigMap(tenantId);
  const siteName = cfg['site.name'] || tenant.name || tenant.slug;
  const siteDesc = cfg['site.description'] || cfg['seo.description'] || siteName;

  const items = seoRepository.listArticlesForFeed(tenantId, limit);
  const uploadBase = base + '/uploads'; // matches UPLOAD_PUBLIC_URL default
  const now = new Date().toUTCString();

  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">');
  parts.push('  <channel>');
  parts.push('    <title>' + xmlEscape(siteName) + '</title>');
  parts.push('    <link>' + xmlEscape(base) + '</link>');
  parts.push('    <description>' + xmlEscape(siteDesc) + '</description>');
  parts.push('    <language>vi-VN</language>');
  parts.push('    <lastBuildDate>' + now + '</lastBuildDate>');
  parts.push('    <atom:link href="' + xmlEscape(base + '/feed.xml') + '" rel="self" type="application/rss+xml"/>');

  for (const item of items) {
    const url = base + '/articles/' + item.slug;
    const desc = item.excerpt || item.meta_description || '';
    const pubDate = item.published_at
      ? new Date(item.published_at.includes('T') ? item.published_at : item.published_at.replace(' ', 'T') + 'Z').toUTCString()
      : now;
    parts.push('    <item>');
    parts.push('      <title>' + xmlEscape(item.title) + '</title>');
    parts.push('      <link>' + xmlEscape(url) + '</link>');
    parts.push('      <guid isPermaLink="true">' + xmlEscape(url) + '</guid>');
    parts.push('      <pubDate>' + pubDate + '</pubDate>');
    parts.push('      <description>' + xmlEscape(desc) + '</description>');
    if (item.cover_filename) {
      parts.push('      <enclosure url="' + xmlEscape(uploadBase + '/' + item.cover_filename) + '" type="image/jpeg"/>');
    }
    parts.push('    </item>');
  }
  parts.push('  </channel>');
  parts.push('</rss>');

  const out = parts.join('\n');
  seoCache.set(tenantId, 'feed:' + limit, out);
  return out;
}

// =====================================================================
// JSON-LD generators
// =====================================================================

/**
 * Build a Schema.org Organization JSON-LD block.
 * Used sitewide (homepage + every page header). Identifies the publisher to
 * Google's Knowledge Graph and to AI agents extracting entity data.
 */
export function buildOrganizationJsonLd(tenantId) {
  const tenant = seoRepository.tenantById(tenantId);
  if (!tenant) return null;
  const base = tenantBaseUrl(tenant);
  const cfg = seoRepository.siteConfigMap(tenantId);

  const sameAs = [];
  for (const key of ['social.facebook', 'social.zalo', 'social.youtube', 'social.linkedin', 'social.instagram']) {
    const v = cfg[key];
    if (typeof v === 'string' && v.startsWith('http')) sameAs.push(v);
  }

  const result = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: cfg['site.name'] || tenant.name,
    url: base,
  };
  if (cfg['site.logo']) result.logo = cfg['site.logo'];
  if (cfg['contact.phone']) {
    result.contactPoint = {
      '@type': 'ContactPoint',
      telephone: cfg['contact.phone'],
      contactType: 'sales',
      areaServed: 'VN',
      availableLanguage: ['Vietnamese'],
    };
  }
  if (sameAs.length) result.sameAs = sameAs;
  if (cfg['contact.address']) {
    result.address = {
      '@type': 'PostalAddress',
      streetAddress: cfg['contact.address'],
      addressCountry: 'VN',
    };
  }
  return result;
}

/**
 * Build a Schema.org WebSite JSON-LD with SearchAction. Tells Google to show
 * a sitelinks search box in SERP, and tells AI agents how to query the site.
 */
export function buildWebsiteJsonLd(tenantId) {
  const tenant = seoRepository.tenantById(tenantId);
  if (!tenant) return null;
  const base = tenantBaseUrl(tenant);
  const cfg = seoRepository.siteConfigMap(tenantId);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: cfg['site.name'] || tenant.name,
    url: base,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: base + '/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Build BreadcrumbList JSON-LD from a path. AI agents and Google use this to
 * understand site hierarchy. Path is an array of { name, url } pairs.
 */
export function buildBreadcrumbJsonLd(tenantId, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const tenant = seoRepository.tenantById(tenantId);
  if (!tenant) return null;
  const base = tenantBaseUrl(tenant);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url.startsWith('http') ? it.url : (base + it.url),
    })),
  };
}

/**
 * Build BlogPosting JSON-LD for a single article. Used inline on article
 * detail pages.
 */
export function buildArticleJsonLd(tenantId, slug) {
  const a = seoRepository.articleForJsonLd(tenantId, slug);
  if (!a) return null;
  const tenant = seoRepository.tenantById(tenantId);
  const base = tenantBaseUrl(tenant);
  const cfg = seoRepository.siteConfigMap(tenantId);
  const uploadBase = base + '/uploads';

  const result = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.meta_title || a.title,
    description: a.meta_description || a.excerpt || '',
    datePublished: toIso(a.published_at) || undefined,
    dateModified: toIso(a.updated_at) || toIso(a.published_at) || undefined,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': base + '/articles/' + a.slug,
    },
    publisher: {
      '@type': 'Organization',
      name: cfg['site.name'] || tenant.name,
      logo: cfg['site.logo'] ? { '@type': 'ImageObject', url: cfg['site.logo'] } : undefined,
    },
  };
  if (a.author_name) {
    result.author = { '@type': 'Person', name: a.author_name };
  }
  const imgFile = a.og_filename || a.cover_filename;
  if (imgFile) {
    result.image = uploadBase + '/' + imgFile;
  }
  return result;
}

/**
 * Build a project JSON-LD block. SHAPE DEPENDS ON THE INDUSTRY:
 *   - real-estate  → RealEstateListing
 *   - aesthetics   → MedicalBusiness (clinic service)
 *   - spa          → HealthAndBeautyBusiness (treatment offering)
 *   - branding     → CreativeWork (case study)
 *   - professional → Service
 *   - base         → Service (generic fallback)
 *
 * This is the vertical-aware part. Without it, a real-estate project would
 * get a generic Thing schema and Google would not show it in any rich
 * result.
 */
export function buildProjectJsonLd(tenantId, slug) {
  const p = seoRepository.projectForJsonLd(tenantId, slug);
  if (!p) return null;
  const tenant = seoRepository.tenantById(tenantId);
  const base = tenantBaseUrl(tenant);
  const uploadBase = base + '/uploads';
  const imageUrl = p.cover_filename ? uploadBase + '/' + p.cover_filename : undefined;

  const common = {
    '@context': 'https://schema.org',
    name: p.name,
    description: p.description || '',
    url: base + '/projects/' + p.slug,
    image: imageUrl,
    dateModified: toIso(p.updated_at) || undefined,
  };

  switch (industry.name) {
    case 'real-estate':
      return {
        ...common,
        '@type': 'RealEstateListing',
        // datePosted required by some validators; use created_at.
        datePosted: toIso(p.created_at) || undefined,
        // Status mapping: planning/foundation/construction/finishing →
        // ItemAvailability "PreOrder"; handover/completed → "InStock".
        availability: ['handover', 'completed'].includes(p.status)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/PreOrder',
      };

    case 'aesthetics':
      return {
        ...common,
        '@type': 'MedicalBusiness',
        medicalSpecialty: 'PlasticSurgery',
      };

    case 'spa':
      return {
        ...common,
        '@type': 'HealthAndBeautyBusiness',
      };

    case 'branding':
      return {
        ...common,
        '@type': 'CreativeWork',
        creator: {
          '@type': 'Organization',
          name: tenant.name,
          url: base,
        },
      };

    case 'professional':
      return {
        ...common,
        '@type': 'Service',
        provider: {
          '@type': 'Organization',
          name: tenant.name,
          url: base,
        },
      };

    default:
      return {
        ...common,
        '@type': 'Service',
      };
  }
}

/**
 * Build FAQPage JSON-LD from an array of { question, answer } pairs. This is
 * the highest-ROI schema for AI agents — Q&A pairs are exactly what they
 * extract for answer generation. Pages module can attach an FAQ section per
 * landing page; this generator turns it into JSON-LD.
 */
export function buildFaqJsonLd(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs
      .filter(f => f && f.question && f.answer)
      .map(f => ({
        '@type': 'Question',
        name: String(f.question),
        acceptedAnswer: {
          '@type': 'Answer',
          text: String(f.answer),
        },
      })),
  };
}

// =====================================================================
// Public service interface (used by controller)
// =====================================================================

export const seoService = {
  generateSitemap,
  generateRobotsTxt,
  generateLlmsTxt,
  generateRssFeed,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  buildBreadcrumbJsonLd,
  buildArticleJsonLd,
  buildProjectJsonLd,
  buildFaqJsonLd,
};
