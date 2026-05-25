/**
 * Contracts — single source of truth for request/response shapes.
 *
 * Why a separate folder: every consumer (the WP plugin's PHP client, the
 * future JS SDK, the future Python SDK, the front-end checkout button)
 * speaks the same wire format. Schemas here are the contract — controllers
 * import them, SDK clients generate types from them, tests assert against
 * them.
 *
 * Each export pair is a zod schema (server validation) + a JSON Schema
 * (consumed by SDK generators + the regression-snapshot test). The JSON
 * Schema is produced at module-load via `zod.toJSON()` from the
 * `zod-to-json-schema` lib — but we don't depend on it here because we
 * only need it for SDK builds, not at runtime. Today the JSON Schema is
 * hand-mirrored — when contracts churn add the npm dep + auto-generate.
 *
 * The Quoted commercial API surface (v0.4.0):
 *   POST /api/payments/checkout                CheckoutRequest → CheckoutResponse
 *   GET  /api/products/plans                   ()              → PlansResponse
 *   POST /api/payments/webhook/:vendor         provider-defined
 *   POST /api/v1/licenses/activate             ActivateRequest → ActivateResponse
 *   POST /api/v1/licenses/validate             ValidateRequest → ValidateResponse
 *   POST /api/v1/licenses/deactivate           DeactivateRequest → { ok: true }
 *   POST /api/v1/wp-sites/register             RegisterRequest → RegisterResponse
 *   POST /api/v1/wp-sites/posts/sync           PostsSyncRequest → PostsSyncResponse
 *   POST /api/v1/wp-sites/refresh-token        ()              → RefreshTokenResponse
 *   POST /api/v1/bot-crawls/batch              BotCrawlsRequest → BotCrawlsResponse
 *   GET  /api/v1/dashboard/summary             ()              → DashboardSummary
 *
 * Every error response uses the same envelope:
 *   { error: { code: string, message: string, details?: any } }
 */

import { z } from 'zod';

// ─── Common ────────────────────────────────────────────────────────────
export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

// ─── Payments ──────────────────────────────────────────────────────────
export const CheckoutRequest = z.object({
  plan:  z.string().min(1).max(64),
  email: z.string().email().max(254).optional(),
});

export const CheckoutResponse = z.object({
  checkout_url: z.string().url(),
});

export const Plan = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(['free', 'pro', 'agency']),
  billing_cycle: z.enum(['monthly', 'yearly', 'perpetual']),
  price_usd: z.number(),
  features: z.array(z.string()),
});
export const PlansResponse = z.object({ plans: z.array(Plan) });

// ─── Licenses ──────────────────────────────────────────────────────────
export const ActivateRequest = z.object({
  license_key:    z.string().min(8).max(64),
  site_url:       z.string().url().max(2048),
  plugin_version: z.string().max(20).optional(),
  wp_version:     z.string().max(20).optional(),
});

export const ActivateResponse = z.object({
  activation_token: z.string(),
  plan: z.string(),
  plan_tier: z.string(),
  features: z.record(z.boolean()),
  expires_at: z.string().nullable(),
  activation_limit: z.number().int(),
  instances_count: z.number().int(),
});

export const ValidateRequest = z.object({
  site_url: z.string().url().max(2048),
});

export const ValidateResponse = z.object({
  status: z.enum(['active', 'expired', 'disabled']),
  plan: z.string(),
  features: z.record(z.boolean()),
  last_sync_at: z.string(),
  site_url: z.string(),
});

export const DeactivateRequest = z.object({
  site_url: z.string().url().max(2048),
  license_key: z.string().min(8).max(64).optional(),
});

// ─── wp-sites ──────────────────────────────────────────────────────────
export const RegisterRequest = z.object({
  activation_token: z.string().min(20).max(2000),
  domain:           z.string().min(3).max(253),
  wp_version:       z.string().max(20).optional(),
  plugin_version:   z.string().max(20).optional(),
  site_name:        z.string().max(200).optional(),
  admin_email:      z.string().email().max(254).optional(),
});

export const RegisterResponse = z.object({
  tenant_id: z.number().int(),
  jwt: z.string(),
  jwt_expires_at: z.string(),
  plan: z.string(),
  quota: z.object({
    posts_limit: z.number().int().nullable(),
    history_days: z.number().int(),
    live_tests_per_month: z.number().int().nullable(),
  }),
});

export const PostsSyncPost = z.object({
  wp_post_id:    z.number().int().positive(),
  slug:          z.string().min(1).max(200),
  title:         z.string().max(500),
  excerpt:       z.string().max(2000).optional(),
  content_html:  z.string().max(500000),
  author:        z.string().max(200).optional(),
  categories:    z.array(z.string()).max(50).optional(),
  tags:          z.array(z.string()).max(100).optional(),
  published_at:  z.string(),
  modified_at:   z.string(),
  url:           z.string().url(),
});
export const PostsSyncRequest = z.object({
  posts: z.array(PostsSyncPost).min(1).max(100),
});
export const PostsSyncResponse = z.object({
  synced: z.number().int(),
  skipped_over_quota: z.number().int(),
  errors: z.array(z.object({
    wp_post_id: z.number().int(),
    error: z.string(),
  })),
});

// ─── bot-crawls ────────────────────────────────────────────────────────
export const BotCrawlEvent = z.object({
  bot_name:   z.string(),
  url_path:   z.string().min(1).max(2048).startsWith('/'),
  user_agent: z.string().max(512).optional(),
  ip_hash:    z.string().regex(/^sha256:[a-f0-9]{64}$/),
  crawled_at: z.string().datetime(),
});
export const BotCrawlsRequest = z.object({
  batch_id: z.string().min(1).max(64).optional(),
  events:   z.array(BotCrawlEvent).min(1).max(500),
});
export const BotCrawlsResponse = z.object({
  accepted: z.number().int(),
  deduped:  z.number().int(),
  rejected: z.number().int(),
  rejected_reasons: z.array(z.object({ error: z.string() })),
});
