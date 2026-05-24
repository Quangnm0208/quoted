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

export const articleInputSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  slug: z.string().max(80).optional(),
  excerpt: z.string().max(500).optional(),
  content_html: contentHtmlField,
  cover_media_id: z.number().int().positive().nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  published_at: z.string().datetime().nullable().optional(),
  meta_title: z.string().max(160).optional(),
  meta_description: z.string().max(300).optional(),
  meta_og_image: z.number().int().positive().nullable().optional(),
});

export const articleListQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  order: z.enum(['newest', 'oldest', 'title']).optional(),
  include_deleted: z.coerce.boolean().optional(),
});

export const articleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const articleSlugParamSchema = z.object({
  slug: z.string().min(1).max(80),
});
