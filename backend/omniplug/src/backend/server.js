/**
 * server.js — Express bootstrap (OmniPlug CMS Core v1.4.4).
 *
 * Historical critical fixes still in force (introduced in v1.2):
 *   - BLOCKER 1: Tenant middleware mount AFTER requireAuth for admin
 *   - BLOCKER 2: Production no fallback — 404 nếu unknown tenant
 *   - All write operations through tenant-scoped controllers
 *
 * v1.4.4 additions:
 *   - License JWT verification gates /api/v1/* (warn or strict mode)
 *   - API-key auth (op_live_*) on /api/v1/*
 *   - Attribution headers (X-Powered-By, X-Attribution-Level) globally
 *   - Soft-lock PII masking on /api/admin/leads for community plan
 *   - Legacy /api/public/* counter + Sunset/Deprecation headers (SEC-12)
 *
 * Mount order (CRITICAL):
 *
 *   /api/health                                — no middleware
 *   /api/auth          → resolveTenantFromHost (login UI từ Host)
 *   /api/public/*      → resolveTenantFromHost → controllers (Sunset header)
 *   /api/admin/*       → requireAuth → resolveTenantFromAuth → controllers
 *   /api/admin/license → requireAuth → license controller
 *   /api/v1/*          → resolveTenantFromHost → requireApiKey → licenseGate → controllers
 *   /api/* (legacy)    → resolveTenantLegacy → controllers
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
import { env } from '../core/config/env.js';
import db from '../core/db/connection.js';
import { pruneOldAuditLog } from '../core/lib/audit.js';
import { pruneOldAttempts } from '../core/lib/rateLimit.js';
import { startTelemetry, stopTelemetry } from '../core/lib/telemetry.js';
import { tenancy } from '../core/lib/tenancy.js';
import { registerAuditSubscriber } from './subscribers/audit.subscriber.js';

// Middleware
import { requireAuth } from '../core/middleware/auth.js';
import { resolveTenantFromHost, resolveTenantFromAuth } from '../core/middleware/tenant.js';
import { errorHandler, notFoundHandler } from '../core/middleware/error.js';
import legacyRoutes from './routes/legacy.routes.js';

// Modules
import authRoutes from './modules/auth/auth.controller.js';
import {
  publicRouter as articlesPublic,
  adminRouter as articlesAdmin,
} from './modules/articles/articles.controller.js';
import {
  publicRouter as projectsPublic,
  adminRouter as projectsAdmin,
} from './modules/projects/projects.controller.js';
import {
  publicRouter as sitePublic,
  adminRouter as siteAdmin,
} from './modules/site/site.controller.js';
import {
  publicRouter as leadsPublic,
  adminRouter as leadsAdmin,
} from './modules/leads/leads.controller.js';
import {
  adminRouter as mediaAdmin,
} from './modules/media/media.controller.js';
import {
  publicRouter as pagesPublic,
  adminRouter as pagesAdmin,
} from './modules/pages/pages.controller.js';
import usersAdmin from './modules/users/users.controller.js';
import auditAdmin from './modules/audit/audit.controller.js';
import tenantsAdmin from './modules/tenants/tenants.controller.js';
import { rootRouter as seoRoot, jsonLdRouter as seoJsonLd } from './modules/seo/seo.controller.js';
import { registerSeoSubscriber } from './modules/seo/seo.subscriber.js';
import {
  rootRouter as indexingRoot,
  adminRouter as indexingAdmin,
} from './modules/indexing/indexing.controller.js';
import { registerIndexingSubscriber } from './modules/indexing/indexing.subscriber.js';
import { indexingService } from './modules/indexing/indexing.service.js';
import {
  middleware as redirectionsMiddleware,
  adminRouter as redirectionsAdmin,
  subscribeAutoCreate as subscribeRedirectionsAutoCreate,
} from './modules/redirections/redirections.controller.js';
import {
  startFlushTimer as startRedirectionFlushTimer,
  stopFlushTimer as stopRedirectionFlushTimer,
} from './modules/redirections/redirections.cache.js';
import {
  logMiddleware as error404LogMiddleware,
  adminRouter as error404Admin,
  startFlushTimer as startError404FlushTimer,
  stopFlushTimer as stopError404FlushTimer,
} from './modules/error_log/error_log.controller.js';
import { errorLogRepository } from './modules/error_log/error_log.repository.js';
import { publicRouter as snippetPublic } from './modules/snippet/snippet.controller.js';
import { adminRouter as seoValidatorAdmin } from './modules/seo-validator/seo-validator.controller.js';

// v1.4.4 — license + API gating
import licenseAdmin from './modules/license/license.controller.js';
import { licenseGate, enforcementMode } from '../core/middleware/licenseGate.js';
import { requireApiKey, requireScope, enforceQuota } from '../core/middleware/apiKey.js';
import { attributionHeaders } from '../core/middleware/attribution.js';
import { maskLeadsForPlan } from '../core/middleware/softLock.js';
import { loadPublicKey } from '../core/lib/licenseKey.js';

// Quoted (v0.1.0 overlay) — WP plugin endpoints + public llms.txt
import wpSitesRouter, { dashboardRouter as quotedDashboardRouter } from './modules/plugin-runtime/wp-sites/wp-sites.controller.js';
import botCrawlsRouter from './modules/plugin-runtime/bot-crawls/bot-crawls.controller.js';
import citationsRouter from './modules/plugin-runtime/citations/citations.controller.js';
import liveAiTestRouter from './modules/plugin-runtime/live-ai-test/live-ai-test.controller.js';
import llmsContentRouter from './modules/plugin-runtime/llms-content/llms-content.controller.js';

// Quoted SaaS admin (v0.6.0) — operator-facing read-only views of
// customers/subscriptions/licenses/wp-sites/bot-crawls/posts/citations
import quotedSaasAdmin from './modules/plugin-runtime/quoted-admin/quoted-admin.controller.js';

// Quoted customer portal (v0.6.4) — customer self-service dashboard.
// License-key bearer auth; read-only; mounted at /api/customer/*
import quotedCustomerPortal from './modules/plugin-runtime/customer-portal/customer-portal.controller.js';

// Quoted commercial layer (v0.4.0) — payments + licenses.
import {
  paymentsRouter as quotedPaymentsRouter,
  webhookRouter  as quotedWebhookRouter,
  productsRouter as quotedProductsRouter,
} from './modules/commerce/payments/payments.controller.js';
import quotedLicensesRouter from './modules/commerce/licenses/licenses.controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== 1. Wire domain event subscribers =====
//
// Production startup is owned by scripts/start.sh:
//   migrate -> verify-schema -> server
// This module assumes the database is already migrated and verified.
// Subscribers are sync; registration is cheap.
registerAuditSubscriber();
registerSeoSubscriber();
registerIndexingSubscriber();
subscribeRedirectionsAutoCreate();

// ===== 2. Create Express app =====
const app = express();
if (env.TRUST_PROXY) app.set('trust proxy', true);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src':   ["'self'"],
      'script-src':    ["'self'", 'https://cdn.jsdelivr.net'],
      'script-src-attr': ["'none'"],
      'style-src':     ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      'img-src':       ["'self'", 'data:', 'blob:', 'https:'],
      'font-src':      ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com', 'data:'],
      'connect-src':   ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri':      ["'self'"],
      'form-action':   ["'self'"],
      'object-src':    ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOrigins = env.CORS_ORIGIN === '*'
  ? '*'
  : env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: corsOrigins.length === 0 ? false : corsOrigins,
  credentials: false,
}));

// Logging — skip for high-frequency health probes (Fly hits /api/health
// every 30s × N machines × multiple paths) so we don't fill stdout with noise
// and don't pay the morgan formatting cost on the hot path.
if (env.NODE_ENV !== 'test') {
  const skipHealth = (req) => req.path === '/api/health' || req.path === '/health';
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', { skip: skipHealth }));
}

// Body parsing
const LICENSE_BODY_LIMIT = '8kb';
function normalizeLicenseBodyParserError(err, req, res, next) {
  if (err && err.type === 'entity.too.large') {
    err.statusCode = 413;
    err.code = 'PAYLOAD_TOO_LARGE';
    err.message = 'License payload exceeds 8KB cap';
  } else if (err && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    err.message = 'Invalid JSON payload';
  }
  next(err);
}
app.use('/api/admin/license', express.json({ limit: LICENSE_BODY_LIMIT }));
app.use('/api/admin/license', express.urlencoded({ extended: true, limit: LICENSE_BODY_LIMIT }));
app.use('/api/admin/license', normalizeLicenseBodyParserError);

// CRITICAL: the Lemon Squeezy webhook MUST receive the raw body so HMAC
// verification can compute against the exact bytes LS signed. Mount the
// raw-body parser BEFORE the global express.json() so the JSON parser
// doesn't consume the stream first. Limit 1 MB (LS payloads are ~5 KB).
// Raw-body parser for EVERY vendor's webhook. The vendor-agnostic router
// at /api/payments/webhook/:vendor picks the provider and verifies HMAC
// against the exact bytes the vendor signed. Mount BEFORE the global
// express.json() so the JSON parser doesn't consume the stream first.
app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ===== 3. Static =====
// Admin static assets — set Cache-Control: no-cache so the browser
// re-validates each request. Without this, ES module scripts get
// pinned in memory cache and the operator sees old admin UI even
// after a deploy. ETag still saves bandwidth via 304s when content
// hasn't changed.
app.use('/admin', express.static(path.join(__dirname, '..', 'cms', 'admin'), {
  index: 'index.html',
  setHeaders: (res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cache-Control', 'no-cache, must-revalidate');
  },
}));

app.use(env.UPLOAD_PUBLIC_URL, express.static(path.resolve(env.UPLOAD_DIR), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => res.set('Access-Control-Allow-Origin', '*'),
}));

// ===== 4. Healthcheck (NO tenant middleware) =====
//
// Spec: GET /api/health -> { status, version, product, vendor, license, homepage }
// Keep /health for platform health checks.
//
// Performance:
//   - The "SELECT 1" probe is prepared ONCE at boot (not per request) — calling
//     db.prepare() inline allocates a new statement per call. On shared-cpu-1x
//     that's measurable when Fly polls health every 30s × concurrency.
//   - The response body is also static apart from db.prepare's status; we
//     pre-build it once.
const _healthProbe = db.prepare('SELECT 1');
const _healthBodyOk = JSON.stringify({
  status: 'ok',
  version: pkg.version,
  product: 'OmniPlug CMS Core',
  vendor: 'OmniPlug',
  license: 'PolyForm Noncommercial 1.0.0',
  homepage: 'https://omniplug.com',
});
function healthCheck(req, res) {
  try {
    _healthProbe.get();
    res.type('application/json').send(_healthBodyOk);
  } catch (err) {
    res.status(503).json({
      status: 'error',
      version: pkg.version,
      product: 'OmniPlug CMS Core',
      vendor: 'OmniPlug',
      license: 'PolyForm Noncommercial 1.0.0',
      homepage: 'https://omniplug.com',
      message: err.message,
    });
  }
}
app.get('/api/health', healthCheck);
app.get('/health', healthCheck);

// ===== 4a. Soft tenant resolution + redirections middleware =====
//
// "Soft" means: try to set req.tenantId from Host, but if it fails (unknown
// host, in production no fallback), DO NOT terminate the request — just
// leave req.tenantId undefined and let the request flow on. The terminal
// route (or its own resolveTenantFromHost) will handle 404 in the normal
// way; redirections middleware skips when tenantId is missing.
function softResolveTenant(req, res, next) {
  resolveTenantFromHost(req, res, (err) => {
    // Swallow tenant errors at this stage. Anything that needs the tenant
    // for sure (public/admin routes) will re-run the strict resolver and
    // bubble up the error there.
    if (err) {
      // Clear any partial state so downstream sees an unresolved tenant.
      req.tenantId = undefined;
      req.tenant = undefined;
    }
    next();
  });
}

app.use(softResolveTenant);
app.use(redirectionsMiddleware);

// ===== 4b. Root-level SEO surfaces (sitemap, robots, llms, feed) =====
//
// Mounted at root because every crawler convention (Google, Bing, GPTBot,
// ClaudeBot, PerplexityBot) looks for these at fixed paths. Tenant resolved
// by Host header; in production unknown host -> 404 (same contract as
// /api/public). Cache headers set in controller (s-maxage=3600) so edge
// serves > 95% of crawler traffic without hitting this server.
app.use(resolveTenantFromHost, seoRoot);

// ===== 4c. IndexNow key verification file =====
//
// Bing fetches /<key>.txt at the tenant's root to verify ownership before
// accepting submissions. The controller validates the key matches the
// tenant's stored key, else 404.
app.use(resolveTenantFromHost, indexingRoot);

// ===== 5. Auth routes — Host-based tenant (login UI từ tenant.domain) =====
//
// Note: login chính nó không gắn tenant_id (user.tenant_id từ DB sẽ vào JWT).
// Resolve tenant from Host chỉ để rate limit + audit ghi đúng tenant context.
app.use('/api/auth', resolveTenantFromHost, authRoutes);

// ===== 6. PUBLIC API — Host-based tenant resolution =====
//
// CRITICAL: resolveTenantFromHost chạy TRƯỚC controllers.
//          Production: unknown host → 404 Tenant Not Found.

// v1.4.4 SEC-12: Sunset header + legacy traffic monitoring on /api/public/*.
// Legacy public endpoints will move to /api/v1/* in v1.5.0. We count
// usage so the operator can plan the cutover.
let _legacyPublicCounter = 0;
function trackLegacyPublic(req, res, next) {
  _legacyPublicCounter++;
  if (_legacyPublicCounter % 100 === 0) {
    console.log(`[legacy] /api/public/* called ${_legacyPublicCounter} times since boot`);
  }
  res.setHeader('Sunset', 'Sat, 31 Oct 2026 00:00:00 GMT');
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '<https://omniplug.com/docs/api-v1-migration>; rel="deprecation"');
  next();
}

// v1.4.4: attribution headers on ALL public + admin responses
app.use(attributionHeaders);

// P0.3 (master prompt) — `/api/public/llm` must mount BEFORE the
// generic `resolveTenantFromHost` chain. The LLM controller resolves
// tenant from the `X-Quoted-Domain` header (the customer's site
// domain, not the SaaS API host). If `resolveTenantFromHost` ran first
// in production strict mode and `api.quotedeasy.com` wasn't itself a
// tenant.domain row, the request 404s before reaching the controller.
// trackLegacyPublic is fine to run here too — it only adds a Sunset
// header + a counter, no tenant gating.
app.use('/api/public/llm',      trackLegacyPublic, llmsContentRouter);

app.use('/api/public', trackLegacyPublic, resolveTenantFromHost);
app.use('/api/public/articles', articlesPublic);
app.use('/api/public/projects', projectsPublic);
app.use('/api/public/site',     sitePublic);
app.use('/api/public/leads',    leadsPublic);
app.use('/api/public/pages',    pagesPublic);
app.use('/api/public/jsonld',   seoJsonLd);
app.use('/api/public/snippet',  snippetPublic);

// ===== 7. ADMIN API — Auth-based tenant resolution =====
//
// CRITICAL: requireAuth → resolveTenantFromAuth → controllers.
//   1. JWT verify → set req.user
//   2. Load tenant từ req.user.tenant_id → set req.tenantId
//   3. Production: user thiếu tenant_id → 403.
//
// Mỗi controller bên trong vẫn check RBAC (requireRole).
app.use('/api/admin', requireAuth, resolveTenantFromAuth);
app.use('/api/admin/articles', articlesAdmin);
app.use('/api/admin/projects', projectsAdmin);
app.use('/api/admin/media',    mediaAdmin);
// v1.4.4: gated leads view for admin — applies PII mask for community plan
app.use('/api/admin/leads',     maskLeadsForPlan);
app.use('/api/admin/leads',    leadsAdmin);
app.use('/api/admin/site',     siteAdmin);
app.use('/api/admin/pages',    pagesAdmin);
app.use('/api/admin/users',    usersAdmin);
app.use('/api/admin/audit',    auditAdmin);
app.use('/api/admin/tenants',  tenantsAdmin);
app.use('/api/admin/indexing', indexingAdmin);
app.use('/api/admin/redirections', redirectionsAdmin);
app.use('/api/admin/error-404', error404Admin);
app.use('/api/admin/seo',       seoValidatorAdmin);

// Quoted SaaS admin (v0.6.0) — JWT-gated read-only operator views
// P0.1 (master prompt): cross-tenant data must require platform admin,
// not just any tenant admin. requirePlatformAdmin layered AFTER
// requireAuth + resolveTenantFromAuth (mounted globally on /api/admin).
import { requirePlatformAdmin } from '../core/middleware/requirePlatformAdmin.js';
app.use('/api/admin/quoted',    requirePlatformAdmin, quotedSaasAdmin);

// v1.4.4: license admin endpoints (activate / sync-crl / status)
app.use('/api/admin/license',   licenseAdmin);

// ===== 7b. /api/v1/* — gated by license + API key (v1.4.4) =====
//
// New public surface for SDK / CRM integrations. Every request must:
//   1. Pass requireApiKey (SEC-1, SEC-3, SEC-5)
//   2. Pass licenseGate (refuse if community/revoked/expired in strict mode)
//
// Soft-locked plans (community) cannot reach /api/v1/* — clients should
// fall back to /api/public/* (deprecated) until they upgrade.

// Health endpoint inside /api/v1 (no API key needed for diagnostics on
// the customer's own host) — useful for uptime monitors.
app.get('/api/v1/health/legacy-traffic', (req, res) => {
  res.json({
    legacy_public_calls_since_boot: _legacyPublicCounter,
    sunset_date: '2026-10-31T00:00:00Z',
    migration_url: 'https://omniplug.com/docs/api-v1-migration',
  });
});

// ===== Quoted overlay — WP plugin endpoints =====
//
// Mounted BEFORE the /api/v1 requireApiKey gate so the plugin can authenticate
// with its own HS256 plugin-JWT (minted at /wp-sites/register) instead of an
// op_live_* API key. The /register endpoint itself is public — license signature
// is the proof of identity.
// ===== Commercial layer (v0.4.0) =====
// Mounted BEFORE the /api/v1 requireApiKey gate. /api/payments/* is
// pre-purchase (no auth); /api/v1/licenses/* uses its own activation_token
// (decoded inside the router). /api/payments/webhook/lemon-squeezy uses
// HMAC against the raw body.
app.use('/api/payments',                       quotedPaymentsRouter);
app.use('/api/payments/webhook', quotedWebhookRouter);
app.use('/api/products',                       quotedProductsRouter);
app.use('/api/v1/licenses',                    quotedLicensesRouter);

// Customer portal (v0.6.4) — mounted BEFORE the /api/v1 requireApiKey
// gate. License key in Authorization: License header authenticates the
// customer to their OWN data. No JWT, no signup — see
// customer-portal.controller.js for rationale.
app.use('/api/customer', quotedCustomerPortal);

app.use('/api/v1/wp-sites',  wpSitesRouter);
app.use('/api/v1/bot-crawls', botCrawlsRouter);
app.use('/api/v1/citations',  citationsRouter);
app.use('/api/v1/live-test',  liveAiTestRouter);
app.use('/api/v1/dashboard',  quotedDashboardRouter);

app.use('/api/v1', requireApiKey, licenseGate, enforceQuota);
app.use('/api/v1/leads',    requireScope('leads:write'),               leadsPublic);
app.use('/api/v1/site',     requireScope('site:read'),                  sitePublic);
app.use('/api/v1/articles', requireScope('articles:read'),              articlesPublic);
app.use('/api/v1/projects', requireScope('projects:read'),              projectsPublic);
app.use('/api/v1/pages',    requireScope('pages:read'),                 pagesPublic);

// ===== 7c. Internal perf probe — for load-test SLO measurement only =====
//
// Returns server-side hrtime measurements so load tests can compute app-only
// latency excluding proxy / network / TLS overhead. Mounted at /api/_perf-probe
// (underscore-prefixed) so it's distinct from product surface.
//
// IMPORTANT: this endpoint deliberately does NO database work — its purpose is
// to measure Node.js event-loop responsiveness and HTTP framing cost only.
// Pair it with a request to /api/health (which DOES do a DB SELECT 1) to
// isolate the per-request DB overhead.
//
// Security: read-only; reveals no business data. Intentionally NOT gated by
// license or API key — load tests must be able to hit it before warm-up.
// We DO emit a HSTS-style header to prevent crawler indexing.
//
// Usage in load harness:
//   1. Make N requests to /api/_perf-probe
//   2. Compare wall-clock latency vs response.server_elapsed_us
//   3. Difference = proxy + network + TLS round-trip
app.get('/api/_perf-probe', (req, res) => {
  const t0 = process.hrtime.bigint();
  // Tiny event-loop yield to flush pending I/O — without this the response
  // is suspiciously instant on idle machines (μs scale) which throws off
  // ratio calculations. Doing one setImmediate captures realistic Node
  // scheduling latency.
  setImmediate(() => {
    const t1 = process.hrtime.bigint();
    const serverElapsedUs = Number((t1 - t0) / 1000n);
    res.set('X-Robots-Tag', 'noindex');
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true,
      server_elapsed_us: serverElapsedUs,
      now_iso: new Date().toISOString(),
      hostname: process.env.FLY_MACHINE_ID || 'unknown',
      version: pkg.version,
    });
  });
});

// ===== 8. LEGACY API — backward compat with security =====
//
// Legacy paths VẪN phải apply tenant + auth. Không bypass security.
// Smart resolver: nếu Bearer token → auth-based; nếu không → host-based.
//
// Hành xử y hệt /api/admin (sau auth) hoặc /api/public (trước auth) tùy route.
// Will be removed in the next breaking release.

app.use('/api', legacyRoutes);

// Redirect root
app.get('/', (req, res) => res.redirect('/admin/'));

// ===== 8b. 404 Monitor — runs just before the terminal 404 handler =====
//
// req.tenantId was set (if possible) by softResolveTenant at the top.
// If tenant is not resolved, the middleware skips silently.
app.use(error404LogMiddleware);

// ===== 9. Error handlers (LAST) =====
app.use(notFoundHandler);
app.use(errorHandler);

// ===== 10. Start =====

// v1.4.4 SEC-9 / SEC-10: validate license configuration BEFORE listen.
// In strict mode + production we refuse to start without a real public key.
function logEnforcementWarning() {
  console.warn(
    '[license] WARNING: enforcement=warn in production — /api/v1/* is OPEN. ' +
    'Set LICENSE_ENFORCEMENT=strict to gate. Operator: OmniPlug Engineering <licensing@omniplug.com>'
  );
}

const mode = enforcementMode();
if (mode === 'strict') {
  try {
    loadPublicKey();
    console.log('[license] enforcement=strict — public key loaded, RSA-4096+ verified');
  } catch (err) {
    console.error('[license] FATAL: ' + err.message);
    if (env.NODE_ENV === 'production') {
      process.exit(2);
    } else {
      console.warn('[license] dev mode — continuing despite key error');
    }
  }
} else if (mode === 'warn') {
  if (env.NODE_ENV === 'production') {
    logEnforcementWarning();
    setInterval(logEnforcementWarning, 60_000).unref();
  } else {
    console.log('[license] enforcement=warn (dev) — /api/v1/* will pass through');
  }
} else {
  console.log('[license] enforcement=off — all gating disabled');
}

const server = app.listen(env.PORT, () => {
  const tenantCount = tenancy.listAll().length;
  console.log(`OmniPlug CMS Core v${pkg.version}`);
  console.log('Environment: ' + env.NODE_ENV);
  console.log('DB:          ' + env.DB_PATH);
  console.log('Port:        ' + env.PORT);
  console.log('Tenants:     ' + tenantCount + ' (production fallback: ' +
    (env.NODE_ENV === 'production' ? 'DISABLED - strict 404' : 'enabled - dev mode') + ')');
  console.log('Admin:       http://localhost:' + env.PORT + '/admin/');
  console.log('Public API:  http://localhost:' + env.PORT + '/api/public/');
  console.log('Health:      http://localhost:' + env.PORT + '/api/health');

  pruneOldAttempts();
  startTelemetry(pkg.version);
  pruneOldAuditLog(env.AUDIT_LOG_RETENTION_DAYS);

  // v1.4.2: prune indexing + 404 logs at startup (same pattern as audit_log).
  indexingService.pruneOldLogs(env.INDEXING_LOG_RETENTION_DAYS || 90);
  try {
    const r = errorLogRepository.prune(env.ERROR_404_RETENTION_DAYS || 90);
    if (r && r.changes > 0) {
      console.log('[error_404] pruned ' + r.changes + ' entries older than 90 days');
    }
  } catch (err) {
    console.warn('[error_404] prune failed:', err.message);
  }
  // v1.4.2: start buffered-write flush timers for redirect hits + 404 logs.
  startRedirectionFlushTimer();
  startError404FlushTimer();
});

// Graceful shutdown
function shutdown(signal) {
  console.log('\n▸ ' + signal + ' received, shutting down...');
  stopTelemetry();
  // v1.4.2: flush buffered writes before exit so we do not lose hit counters.
  try { stopRedirectionFlushTimer(); } catch {}
  try { stopError404FlushTimer(); } catch {}
  server.close(() => {
    try { db.close(); } catch { /* noop */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
