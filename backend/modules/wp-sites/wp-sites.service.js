/**
 * wp-sites service — business logic for plugin registration & sync.
 *
 * Reuses OmniPlug's licenseKey lib, tenancy resolver, JWT signer.
 *
 * @module wp-sites/service
 */

import { verifyLicenseKey, isRevoked } from '../../../core/lib/licenseKey.js';
import { resolveOrCreateTenant } from '../../../core/lib/tenancy.js';
import { signJwt } from '../../../core/lib/jwt.js';
import { articlesRepo } from '../articles/articles.repository.js';
import * as repo from './wp-sites.repository.js';
import * as crawlsRepo from '../bot-crawls/bot-crawls.repository.js';

const JWT_TTL_HOURS = Number(process.env.QUOTED_JWT_TTL_HOURS || 24);
const FREE_POST_LIMIT = Number(process.env.QUOTED_FREE_POST_LIMIT || 50);

/**
 * Custom error helper.
 */
function err(code, message, httpStatus = 400, details = null) {
  const e = new Error(message);
  e.code = code;
  e.httpStatus = httpStatus;
  e.details = details;
  return e;
}

/**
 * Strip www. prefix and lowercase.
 */
function normalizeDomain(domain) {
  return String(domain).replace(/^www\./i, '').toLowerCase().trim();
}

/**
 * Register a new WP site (or re-register existing).
 */
export async function register(payload) {
  const { license_key, domain } = payload;
  const normalizedDomain = normalizeDomain(domain);

  // 1. Validate license format
  if (!/^qtd_(live|test)_[a-zA-Z0-9_-]{20,}$/.test(license_key)) {
    throw err('INVALID_LICENSE_FORMAT', 'License key format is invalid.', 400);
  }

  // 2. Verify signature + decode claims
  let claims;
  try {
    claims = await verifyLicenseKey(license_key);
  } catch (e) {
    throw err('INVALID_LICENSE_SIGNATURE', 'License signature verification failed.', 400);
  }

  // 3. Revocation check (CRL)
  if (await isRevoked(claims.jti)) {
    throw err('LICENSE_REVOKED', 'This license has been revoked.', 410);
  }

  // 4. Expiry check
  if (claims.exp && claims.exp * 1000 < Date.now()) {
    throw err('LICENSE_EXPIRED', 'This license has expired.', 410);
  }

  // 5. Domain match
  const claimDomain = normalizeDomain(claims.domain || '');
  if (claimDomain && claimDomain !== normalizedDomain) {
    throw err(
      'DOMAIN_MISMATCH',
      'License domain does not match this WordPress site.',
      403,
      { expected: claimDomain, got: normalizedDomain }
    );
  }

  // 6. Resolve or create tenant
  const tenant = await resolveOrCreateTenant({
    domain:       normalizedDomain,
    email:        payload.admin_email || claims.email,
    plan:         claims.plan || 'free',
    licenseJti:   claims.jti,
  });

  // 7. Register or update the WP site row
  const wpSite = await repo.upsertWpSite({
    tenantId:      tenant.id,
    domain:        normalizedDomain,
    siteName:      payload.site_name || null,
    adminEmail:    payload.admin_email || null,
    wpVersion:     payload.wp_version || null,
    pluginVersion: payload.plugin_version || null,
  });

  // 8. Mint JWT
  const jwt = await signJwt({
    sub:        `wp_site:${wpSite.id}`,
    tenant_id:  tenant.id,
    wp_site_id: wpSite.id,
    plan:       tenant.plan,
    domain:     normalizedDomain,
  }, JWT_TTL_HOURS * 3600);

  const expiresAt = new Date(Date.now() + JWT_TTL_HOURS * 3600 * 1000);

  return {
    tenant_id:       tenant.id,
    jwt,
    jwt_expires_at:  expiresAt.toISOString(),
    plan:            tenant.plan,
    quota:           buildQuota(tenant.plan),
  };
}

/**
 * Refresh JWT — re-issues without re-validating license (cheap).
 * Caller must have a valid (not-yet-expired) JWT.
 */
export async function refreshToken(tenantId, wpSiteId) {
  const wpSite = await repo.findById(wpSiteId);
  if (!wpSite || wpSite.tenant_id !== tenantId) {
    throw err('WP_SITE_NOT_FOUND', 'WP site not found for this tenant.', 404);
  }

  // Update last_seen_at
  await repo.touch(wpSiteId);

  const jwt = await signJwt({
    sub:        `wp_site:${wpSite.id}`,
    tenant_id:  tenantId,
    wp_site_id: wpSite.id,
    domain:     wpSite.domain,
  }, JWT_TTL_HOURS * 3600);

  const expiresAt = new Date(Date.now() + JWT_TTL_HOURS * 3600 * 1000);

  return {
    jwt,
    jwt_expires_at: expiresAt.toISOString(),
  };
}

/**
 * Sync posts from WP plugin. Stores in OmniPlug's existing articles table
 * with wp_post_id as external ref.
 */
export async function syncPosts(tenantId, wpSiteId, posts) {
  let synced = 0;
  let skipped = 0;
  const errors = [];

  // Get current count for quota check.
  const currentCount = await articlesRepo.countByTenant(tenantId);

  // Get tenant plan for limit.
  const wpSite = await repo.findById(wpSiteId);
  const limit = wpSite && wpSite.plan === 'free' ? FREE_POST_LIMIT : Infinity;

  for (const post of posts) {
    try {
      // Check if already exists (by external ref)
      const existing = await articlesRepo.findByExternalRef(
        tenantId,
        `wp:${wpSiteId}:${post.wp_post_id}`
      );

      // Skip new posts if over quota; allow updates to existing.
      if (!existing && (currentCount + synced) >= limit) {
        skipped++;
        continue;
      }

      const articleData = {
        tenantId,
        externalRef:  `wp:${wpSiteId}:${post.wp_post_id}`,
        slug:         post.slug,
        title:        post.title,
        excerpt:      post.excerpt || '',
        contentHtml:  post.content_html,
        author:       post.author || '',
        categories:   JSON.stringify(post.categories || []),
        tags:         JSON.stringify(post.tags || []),
        publishedAt:  post.published_at,
        modifiedAt:   post.modified_at,
        canonicalUrl: post.url,
      };

      if (existing) {
        await articlesRepo.update(existing.id, articleData);
      } else {
        await articlesRepo.insert(articleData);
      }
      synced++;
    } catch (e) {
      errors.push({ wp_post_id: post.wp_post_id, error: e.message });
    }
  }

  await repo.markSynced(wpSiteId);

  return {
    synced,
    skipped_over_quota: skipped,
    errors,
  };
}

/**
 * Build dashboard summary.
 */
export async function getDashboardSummary(tenantId, days) {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const previousSince = new Date(Date.now() - days * 2 * 86400 * 1000).toISOString();

  // Bot activity
  const totalCrawls = await crawlsRepo.countSince(tenantId, since);
  const totalCrawlsPrev = await crawlsRepo.countBetween(tenantId, previousSince, since);
  const uniqueBots = await crawlsRepo.countUniqueBotsSince(tenantId, since);
  const topBots = await crawlsRepo.topBotsSince(tenantId, since, 5);
  const recentCrawls = await crawlsRepo.recentCrawls(tenantId, 8);

  // Posts
  const postsSynced = await articlesRepo.countByTenant(tenantId);
  const wpSites = await repo.findByTenant(tenantId);
  const isPlanFree = wpSites[0]?.plan !== 'pro' && wpSites[0]?.plan !== 'agency';
  const postsLimit = isPlanFree ? FREE_POST_LIMIT : null;

  // Score: weighted formula. Tune later.
  const score = computeScore({
    totalCrawls,
    uniqueBots,
    postsSynced,
    coverage: postsLimit ? postsSynced / postsLimit : 1,
  });
  const scorePrev = computeScore({
    totalCrawls: totalCrawlsPrev,
    uniqueBots,
    postsSynced,
    coverage: postsLimit ? postsSynced / postsLimit : 1,
  });

  // Next action
  const nextAction = pickNextAction({
    postsSynced,
    postsLimit,
    totalCrawls,
    uniqueBots,
  });

  return {
    ai_distribution_score: score,
    score_delta_7d: score - scorePrev,
    next_action: nextAction,
    bot_activity: {
      total_crawls_7d: totalCrawls,
      unique_bots_7d:  uniqueBots,
      top_bots:        topBots.map(b => ({ bot_name: b.bot_name, count: b.count })),
      recent_crawls:   recentCrawls.map(c => ({
        bot_name:    c.bot_name,
        url_path:    c.url_path,
        crawled_at:  c.crawled_at,
        human_time:  humanTime(c.crawled_at),
      })),
    },
    posts: {
      synced:        postsSynced,
      quota:         postsLimit,
      quota_used_pct: postsLimit ? Math.round((postsSynced / postsLimit) * 100) : 0,
    },
    citations: {
      verified_count_7d: 0,        // Phase 2
      likely_count_7d:   0,        // Phase 2
      tier_required:     'pro',
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function buildQuota(plan) {
  if (plan === 'free') {
    return {
      posts_limit: FREE_POST_LIMIT,
      history_days: 7,
      live_tests_per_month: 3,
    };
  }
  return {
    posts_limit: null,
    history_days: 365,
    live_tests_per_month: null,
  };
}

/**
 * Score formula (0-100).
 * Composition:
 *  - 40 pts: bot diversity (more unique bots = better)
 *  - 30 pts: crawl volume (log-scaled)
 *  - 30 pts: content coverage (synced / quota)
 */
function computeScore({ totalCrawls, uniqueBots, postsSynced, coverage }) {
  const diversityScore = Math.min(uniqueBots / 8, 1) * 40;
  const volumeScore = Math.min(Math.log10(Math.max(totalCrawls, 1) + 1) / 2, 1) * 30;
  const coverageScore = Math.min(coverage, 1) * 30;
  return Math.round(diversityScore + volumeScore + coverageScore);
}

function pickNextAction({ postsSynced, postsLimit, totalCrawls, uniqueBots }) {
  if (postsSynced === 0) {
    return {
      id:          'sync_posts',
      title:       'Sync your posts',
      description: "You haven't synced any posts yet. AI bots can't read what they can't find.",
      action_url:  '/wp-admin/admin.php?page=quoted',
    };
  }

  if (totalCrawls === 0) {
    return {
      id:          'wait_for_crawls',
      title:       "AI bots haven't found you yet",
      description: 'This is normal in the first 24 hours. ClaudeBot and GPTBot usually find new llms.txt files within a day.',
      action_url:  null,
    };
  }

  if (uniqueBots < 3) {
    return {
      id:          'submit_to_bots',
      title:       'Help more AI bots find you',
      description: `Only ${uniqueBots} AI bot${uniqueBots === 1 ? '' : 's'} crawled you this week. Share your site URL with Perplexity and ChatGPT search to invite them.`,
      action_url:  null,
    };
  }

  if (postsLimit && postsSynced >= postsLimit * 0.9) {
    return {
      id:          'upgrade_for_more_posts',
      title:       'Approaching post limit',
      description: `You've used ${postsSynced} of ${postsLimit} posts. Upgrade to Pro for unlimited.`,
      action_url:  'https://quoted.io/pricing',
    };
  }

  return {
    id:          'all_clear',
    title:       'Everything looks healthy',
    description: 'Keep publishing fresh content. AI bots favor recently-updated pages.',
    action_url:  null,
  };
}

function humanTime(iso) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}
