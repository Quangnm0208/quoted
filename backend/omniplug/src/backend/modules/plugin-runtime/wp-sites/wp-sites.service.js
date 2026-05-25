/**
 * wp-sites service — business logic for plugin registration & sync.
 *
 * v0.4.0: registration now requires a valid activation_token (minted by
 * /api/v1/licenses/activate). The legacy qtd_live_* envelope path is
 * removed. Plugin flow:
 *
 *   1. Customer pays via LS hosted checkout → webhook creates entitlement.
 *   2. Plugin POSTs to /api/v1/licenses/activate with license key →
 *      receives activation_token + plan + features.
 *   3. Plugin POSTs to /api/v1/wp-sites/register with activation_token →
 *      tenant + wp_site row created/updated, returns plugin JWT for
 *      subsequent sync/dashboard calls.
 */

import { signPluginJwt } from './quoted-licenses.js';
import { resolveOrCreateTenant } from './tenancy-quoted.js';
import * as repo from './wp-sites.repository.js';
import { quotedPostsRepository } from '../_shared/quoted-posts.repository.js';
import * as crawlsRepo from '../bot-crawls/bot-crawls.repository.js';
import { decodeActivationToken } from '../../commerce/licenses/licenses.service.js';
import { entitlementRepo } from '../../commerce/entitlements/entitlement.repository.js';
import db from '../../../../core/db/connection.js';

const JWT_TTL_HOURS = Number(process.env.QUOTED_JWT_TTL_HOURS || 24);
const FREE_POST_LIMIT = Number(process.env.QUOTED_FREE_POST_LIMIT || 50);

function err(code, message, httpStatus = 400, details = null) {
  const e = new Error(message);
  e.code = code;
  e.httpStatus = httpStatus;
  e.details = details;
  return e;
}

function normalizeDomain(domain) {
  return String(domain).replace(/^www\./i, '').toLowerCase().trim();
}

/**
 * Map our commercial plan_id to the Quoted plan vocabulary used by quotas.
 * pro-* → pro; agency-* → agency; anything else → free.
 */
function planTierFromPlanId(planId) {
  if (!planId) return 'free';
  if (planId.startsWith('agency-')) return 'agency';
  if (planId.startsWith('pro-')) return 'pro';
  return 'free';
}

function lookupLicenseById(id) {
  return db.prepare(`SELECT * FROM customer_licenses WHERE id = ?`).get(id) || null;
}

export async function register(payload) {
  const { activation_token, domain } = payload;
  const normalizedDomain = normalizeDomain(domain);

  // 1. Verify activation_token (minted by /api/v1/licenses/activate).
  const claims = decodeActivationToken(activation_token);
  if (!claims) {
    throw err('TOKEN_INVALID', 'Activation token invalid or expired. Re-activate the license.', 401);
  }

  // 2. Re-check entitlement (a license can be revoked between activate and register).
  const license = lookupLicenseById(claims.license_id);
  if (!license) throw err('LICENSE_NOT_FOUND', 'License no longer exists.', 404);
  if (license.status === 'disabled') throw err('LICENSE_DISABLED', 'License has been disabled.', 410);
  if (license.status === 'expired')  throw err('LICENSE_EXPIRED', 'License has expired.', 410);
  const entitlement = entitlementRepo.findEntitlementByLicense(license.id);
  if (!entitlement || entitlement.status !== 'active') {
    throw err('ENTITLEMENT_INACTIVE', 'Subscription is not active.', 410);
  }

  // 3. Tenant.
  const tenant = resolveOrCreateTenant({
    domain: normalizedDomain,
    name: payload.site_name || normalizedDomain,
  });

  // 4. WP site row — link to customer_id + customer_license_id.
  const plan = planTierFromPlanId(claims.plan_id);
  const wpSite = repo.upsertWpSite({
    tenantId:      tenant.id,
    domain:        normalizedDomain,
    siteName:      payload.site_name || null,
    adminEmail:    payload.admin_email || null,
    wpVersion:     payload.wp_version || null,
    pluginVersion: payload.plugin_version || null,
    plan,
    licenseJti:    null,                // qtd_live_* jti deprecated
    customerId:    claims.customer_id,
    customerLicenseId: claims.license_id,
  });

  // 5. Plugin-side JWT (for /posts/sync, /bot-crawls/batch, /dashboard).
  const jwt = signPluginJwt({
    sub:        `wp_site:${wpSite.id}`,
    tenant_id:  tenant.id,
    wp_site_id: wpSite.id,
    plan,
    domain:     normalizedDomain,
  }, JWT_TTL_HOURS * 3600);

  const expiresAt = new Date(Date.now() + JWT_TTL_HOURS * 3600 * 1000);

  return {
    tenant_id:      tenant.id,
    jwt,
    jwt_expires_at: expiresAt.toISOString(),
    plan,
    quota:          buildQuota(plan),
  };
}

export async function refreshToken(tenantId, wpSiteId) {
  const wpSite = repo.findById(wpSiteId);
  if (!wpSite || wpSite.tenant_id !== tenantId) {
    throw err('WP_SITE_NOT_FOUND', 'WP site not found for this tenant.', 404);
  }
  repo.touch(wpSiteId);

  const jwt = signPluginJwt({
    sub:        `wp_site:${wpSite.id}`,
    tenant_id:  tenantId,
    wp_site_id: wpSite.id,
    plan:       wpSite.plan,
    domain:     wpSite.domain,
  }, JWT_TTL_HOURS * 3600);

  const expiresAt = new Date(Date.now() + JWT_TTL_HOURS * 3600 * 1000);
  return {
    jwt,
    jwt_expires_at: expiresAt.toISOString(),
  };
}

export async function syncPosts(tenantId, wpSiteId, posts) {
  let synced = 0;
  let skipped = 0;
  const errors = [];

  const currentCount = quotedPostsRepository.countByTenant(tenantId);
  const wpSite = repo.findById(wpSiteId);
  const limit = wpSite && wpSite.plan === 'free' ? FREE_POST_LIMIT : Infinity;

  for (const post of posts) {
    try {
      const existing = quotedPostsRepository.findByWpRef(tenantId, wpSiteId, post.wp_post_id);

      if (!existing && (currentCount + synced) >= limit) {
        skipped++;
        continue;
      }

      const data = {
        tenantId,
        wpSiteId,
        wpPostId:        post.wp_post_id,
        slug:            post.slug,
        title:           post.title,
        excerpt:         post.excerpt || '',
        contentHtml:     post.content_html,
        author:          post.author || '',
        categoriesJson:  JSON.stringify(post.categories || []),
        tagsJson:        JSON.stringify(post.tags || []),
        publishedAt:     post.published_at,
        modifiedAt:      post.modified_at,
        canonicalUrl:    post.url,
      };

      if (existing) {
        quotedPostsRepository.update(existing.id, data);
      } else {
        quotedPostsRepository.insert(data);
      }
      synced++;
    } catch (e) {
      errors.push({ wp_post_id: post.wp_post_id, error: e.message });
    }
  }

  repo.markSynced(wpSiteId);

  return { synced, skipped_over_quota: skipped, errors };
}

export async function getDashboardSummary(tenantId, days) {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const previousSince = new Date(Date.now() - days * 2 * 86400 * 1000).toISOString();

  const totalCrawls     = crawlsRepo.countSince(tenantId, since);
  const totalCrawlsPrev = crawlsRepo.countBetween(tenantId, previousSince, since);
  const uniqueBots      = crawlsRepo.countUniqueBotsSince(tenantId, since);
  const topBots         = crawlsRepo.topBotsSince(tenantId, since, 5);
  const recentCrawls    = crawlsRepo.recentCrawls(tenantId, 8);

  const postsSynced = quotedPostsRepository.countByTenant(tenantId);
  const wpSites = repo.findByTenant(tenantId);
  const planFree = wpSites[0]?.plan !== 'pro' && wpSites[0]?.plan !== 'agency';
  const postsLimit = planFree ? FREE_POST_LIMIT : null;

  const score = computeScore({
    totalCrawls, uniqueBots, postsSynced,
    coverage: postsLimit ? postsSynced / postsLimit : 1,
  });
  const scorePrev = computeScore({
    totalCrawls: totalCrawlsPrev, uniqueBots, postsSynced,
    coverage: postsLimit ? postsSynced / postsLimit : 1,
  });

  return {
    ai_distribution_score: score,
    score_delta_7d: score - scorePrev,
    next_action: pickNextAction({ postsSynced, postsLimit, totalCrawls, uniqueBots }),
    bot_activity: {
      total_crawls_7d: totalCrawls,
      unique_bots_7d:  uniqueBots,
      top_bots:        topBots.map(b => ({ bot_name: b.bot_name, count: b.count })),
      recent_crawls:   recentCrawls.map(c => ({
        bot_name:   c.bot_name,
        url_path:   c.url_path,
        crawled_at: c.crawled_at,
        human_time: humanTime(c.crawled_at),
      })),
    },
    posts: {
      synced:         postsSynced,
      quota:          postsLimit,
      quota_used_pct: postsLimit ? Math.round((postsSynced / postsLimit) * 100) : 0,
    },
    citations: {
      verified_count_7d: 0,
      likely_count_7d:   0,
      tier_required:     'pro',
    },
  };
}

function buildQuota(plan) {
  if (plan === 'free') {
    return { posts_limit: FREE_POST_LIMIT, history_days: 7, live_tests_per_month: 3 };
  }
  return { posts_limit: null, history_days: 365, live_tests_per_month: null };
}

function computeScore({ totalCrawls, uniqueBots, postsSynced, coverage }) {
  const diversityScore = Math.min(uniqueBots / 8, 1) * 40;
  const volumeScore = Math.min(Math.log10(Math.max(totalCrawls, 1) + 1) / 2, 1) * 30;
  const coverageScore = Math.min(coverage, 1) * 30;
  return Math.round(diversityScore + volumeScore + coverageScore);
}

function pickNextAction({ postsSynced, postsLimit, totalCrawls, uniqueBots }) {
  if (postsSynced === 0) {
    return {
      id: 'sync_posts',
      title: 'Sync your posts',
      description: "You haven't synced any posts yet. AI bots can't read what they can't find.",
      action_url: '/wp-admin/admin.php?page=quoted',
    };
  }
  if (totalCrawls === 0) {
    return {
      id: 'wait_for_crawls',
      title: "AI bots haven't found you yet",
      description: 'This is normal in the first 24 hours. ClaudeBot and GPTBot usually find new llms.txt files within a day.',
      action_url: null,
    };
  }
  if (uniqueBots < 3) {
    return {
      id: 'submit_to_bots',
      title: 'Help more AI bots find you',
      description: `Only ${uniqueBots} AI bot${uniqueBots === 1 ? '' : 's'} crawled you this week. Share your site URL with Perplexity and ChatGPT search to invite them.`,
      action_url: null,
    };
  }
  if (postsLimit && postsSynced >= postsLimit * 0.9) {
    return {
      id: 'upgrade_for_more_posts',
      title: 'Approaching post limit',
      description: `You've used ${postsSynced} of ${postsLimit} posts. Upgrade to Pro for unlimited.`,
      action_url: 'https://quoted.io/pricing',
    };
  }
  return {
    id: 'all_clear',
    title: 'Everything looks healthy',
    description: 'Keep publishing fresh content. AI bots favor recently-updated pages.',
    action_url: null,
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
