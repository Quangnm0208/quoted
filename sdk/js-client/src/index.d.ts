/**
 * @quoted/sdk — TypeScript declarations.
 *
 * Mirrors the request/response shapes from
 * backend/omniplug/src/backend/modules/_contracts/index.js. Keep in sync —
 * a contracts mismatch breaks every consumer.
 */

export type PlanTier = 'free' | 'pro' | 'agency';
export type BillingCycle = 'monthly' | 'yearly' | 'perpetual';
export type LicenseStatus = 'active' | 'expired' | 'disabled';

export interface QuotedClientOptions {
  baseUrl?: string;
  /** Override the fetch implementation (e.g. for testing or non-Node runtimes). */
  fetch?: typeof globalThis.fetch;
  /** Optionally seed an existing activation_token (skip activate()). */
  activationToken?: string;
  /** Optionally seed an existing plugin JWT (skip register()). */
  pluginJwt?: string;
}

export class QuotedError extends Error {
  code: string;
  message: string;
  details: unknown;
  httpStatus: number | null;
}

// ─── /api/payments ─────────────────────────────────────────────────────
export interface CheckoutRequest { plan: string; email?: string; }
export interface CheckoutResponse { checkout_url: string; }

// ─── /api/products ─────────────────────────────────────────────────────
export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  billing_cycle: BillingCycle;
  price_usd: number;
  features: string[];
}
export interface PlansResponse { plans: Plan[]; }

// ─── /api/v1/licenses ──────────────────────────────────────────────────
export interface ActivateRequest {
  license_key: string;
  site_url: string;
  plugin_version?: string;
  wp_version?: string;
}
export interface ActivateResponse {
  activation_token: string;
  plan: string;
  plan_tier: PlanTier;
  features: Record<string, boolean>;
  expires_at: string | null;
  activation_limit: number;
  instances_count: number;
}
export interface ValidateRequest { site_url: string; }
export interface ValidateResponse {
  status: LicenseStatus;
  plan: string;
  features: Record<string, boolean>;
  last_sync_at: string;
  site_url: string;
}
export interface DeactivateRequest {
  site_url: string;
  license_key?: string;
}

// ─── /api/v1/wp-sites ──────────────────────────────────────────────────
export interface RegisterRequest {
  /** Omitted — auto-filled from the client's cached activationToken. */
  domain: string;
  wp_version?: string;
  plugin_version?: string;
  site_name?: string;
  admin_email?: string;
}
export interface RegisterResponse {
  tenant_id: number;
  jwt: string;
  jwt_expires_at: string;
  plan: string;
  quota: {
    posts_limit: number | null;
    history_days: number;
    live_tests_per_month: number | null;
  };
}
export interface PostsSyncPost {
  wp_post_id: number;
  slug: string;
  title: string;
  excerpt?: string;
  content_html: string;
  author?: string;
  categories?: string[];
  tags?: string[];
  published_at: string;
  modified_at: string;
  url: string;
}
export interface PostsSyncRequest { posts: PostsSyncPost[]; }
export interface PostsSyncResponse {
  synced: number;
  skipped_over_quota: number;
  errors: Array<{ wp_post_id: number; error: string }>;
}

// ─── /api/v1/bot-crawls ────────────────────────────────────────────────
export interface BotCrawlEvent {
  bot_name: string;
  url_path: string;
  user_agent?: string;
  ip_hash: string;
  crawled_at: string;
}
export interface BotCrawlsRequest { batch_id?: string; events: BotCrawlEvent[]; }
export interface BotCrawlsResponse {
  accepted: number;
  deduped: number;
  rejected: number;
  rejected_reasons: Array<{ error: string }>;
}

// ─── /api/v1/dashboard ─────────────────────────────────────────────────
export interface DashboardSummary {
  ai_distribution_score: number;
  score_delta_7d: number;
  next_action: { id: string; title: string; description: string; action_url: string | null };
  bot_activity: {
    total_crawls_7d: number;
    unique_bots_7d: number;
    top_bots: Array<{ bot_name: string; count: number }>;
    recent_crawls: Array<{ bot_name: string; url_path: string; crawled_at: string; human_time: string }>;
  };
  posts: { synced: number; quota: number | null; quota_used_pct: number };
  citations: { verified_count_7d: number; likely_count_7d: number; tier_required: string };
}

// ─── Client ────────────────────────────────────────────────────────────
export class QuotedClient {
  constructor(options?: QuotedClientOptions);
  baseUrl: string;
  activationToken: string | null;
  pluginJwt: string | null;

  payments: {
    checkout(input: CheckoutRequest): Promise<CheckoutResponse>;
  };
  products: {
    plans(): Promise<PlansResponse>;
  };
  licenses: {
    activate(input: ActivateRequest): Promise<ActivateResponse>;
    validate(input: ValidateRequest): Promise<ValidateResponse>;
    deactivate(input: DeactivateRequest): Promise<{ ok: true }>;
  };
  wpSites: {
    register(input: RegisterRequest): Promise<RegisterResponse>;
    refreshToken(): Promise<{ jwt: string; jwt_expires_at: string }>;
    postsSync(input: PostsSyncRequest): Promise<PostsSyncResponse>;
  };
  botCrawls: {
    batch(input: BotCrawlsRequest): Promise<BotCrawlsResponse>;
  };
  dashboard: {
    summary(days?: number): Promise<DashboardSummary>;
  };
}

export default QuotedClient;
