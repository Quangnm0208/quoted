/**
 * articles/articles.schema.js — Zod schemas.
 *
 * v1.4.3 hotfix: added CONTENT_HTML_MAX_BYTES cap to prevent BUG #17/#18
 * (jsdom OOM via 1MB+ HTML and publish-endpoint DoS via huge content).
 * 200KB is generous for any reasonable article (≈30k words plain text equivalent
 * — Tolstoy short stories fit, full novels don't). Backends with stricter
 * memory budgets can lower this; admin UI shows the limit live in editor.
 */

import { z } from 'zod';

// v1.4.3: hard cap on content_html size — prevents jsdom OOM (BUG #17/#18).
// 200,000 bytes ≈ 200KB UTF-8 which fits ~30,000 plain-text words.
// jsdom on 200KB HTML uses ~50MB RAM, 60ms parse — safe within Fly 256MB.
// jsdom on 1MB HTML uses ~1GB RAM, 2.6s parse — would OOM.
export const CONTENT_HTML_MAX_BYTES = 200_000;

const contentHtmlField = z.string()
  .optional()
  .refine(
    (v) => v === undefined || Buffer.byteLength(v, 'utf8') <= CONTENT_HTML_MAX_BYTES,
    {
      message: `content_html exceeds ${CONTENT_HTML_MAX_BYTES} bytes (${CONTENT_HTML_MAX_BYTES / 1000}KB). Split into multiple articles or remove embedded media.`,
    },
  );

// v0.7.0: extended status enum + new SEO/workflow fields per master prompt §1+2
const STATUS_VALUES = ['draft', 'scheduled', 'published', 'archived'];
const CONTENT_TYPE_VALUES = ['article', 'doc', 'changelog', 'faq', 'landing'];
const SCHEMA_TYPE_VALUES = ['Article', 'BlogPosting', 'Product', 'FAQPage'];

export const articleInputSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  slug: z.string().max(80).optional(),
  excerpt: z.string().max(500).optional(),
  content_html: contentHtmlField,
  cover_media_id: z.number().int().positive().nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  published_at: z.string().datetime().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  meta_title: z.string().max(160).optional(),
  meta_description: z.string().max(300).optional(),
  meta_og_image: z.number().int().positive().nullable().optional(),
  // v0.7.0 additions
  seo_title: z.string().max(160).optional(),
  seo_description: z.string().max(300).optional(),
  canonical_url: z.string().url().or(z.literal('')).optional(),
  og_title: z.string().max(160).optional(),
  og_description: z.string().max(300).optional(),
  og_image_id: z.number().int().positive().nullable().optional(),
  robots_index: z.coerce.boolean().optional(),
  robots_follow: z.coerce.boolean().optional(),
  schema_type: z.enum(SCHEMA_TYPE_VALUES).optional(),
  content_type: z.enum(CONTENT_TYPE_VALUES).optional(),
});

export const articleListQuerySchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  content_type: z.enum(CONTENT_TYPE_VALUES).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  order: z.enum(['newest', 'oldest', 'title']).optional(),
  include_deleted: z.coerce.boolean().optional(),
});

export const articleScheduleSchema = z.object({
  scheduled_at: z.string().datetime(),
});

export const articleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const articleSlugParamSchema = z.object({
  slug: z.string().min(1).max(80),
});
