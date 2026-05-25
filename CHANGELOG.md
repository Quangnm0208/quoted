# Changelog

All notable changes to Quoted will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.7.0] — 2026-05-25 — Blog/article content management

Adds full content management to Quoted CMS — CEO can publish blog
articles + docs + changelog with SEO panel without developer help.
Extends existing `articles` table (24 → 33 columns) rather than creating
a duplicate `content_posts` module per master-prompt directive.

See `docs/RELEASE_NOTES_v0.7.0.md` for full detail. TL;DR:

- Article status workflow: `draft → scheduled → published / archived`
- 2 new admin endpoints: `/schedule`, `/unpublish`
- Full article editor in admin UI with collapsible SEO panel
- `frontend/blog.html` now hydrates from CMS; `frontend/blog-post.html`
  NEW single-article view with SEO meta + schema.org JSON-LD
- Sidebar: "Articles" moved from System → Marketing CMS, renamed
  "Blog Articles"
- 12 new tests (T-ART-1..12); npm test 20/20 pass

## [0.6.4] — 2026-05-25 — Customer portal + WP-site revoke + webhook-events admin view

### Added
- **Customer-facing dashboard** at `frontend/customer.html` + backend
  `/api/customer/dashboard`. Customer pastes their license key →
  see their license status, plan, sites, post sync count, bot crawls 7d,
  setup checklist. No password, no signup — license key IS the bearer
  credential (master prompt §7: 1–2 min onboarding). Read-only;
  strictly scoped to the customer resolved from the key (verified
  no-leak in audit). Per-IP rate limit 60/min via shared limiter.
- **Plugin JWT revoke** — `POST /api/admin/quoted/wp-sites/:id/revoke`
  with `{reason}` body. Sets `is_active=0` + clears `license_jti` →
  next plugin request fails JWT-jti check → forces re-activation.
  SaaS threat T10 mitigation. Audit-logged as `wp_site.revoke`.
- **WP Sites admin** gets per-row Revoke button with confirmation +
  reason prompt + toast + auto-reload.
- **Webhook Events admin tab** — new `/admin/webhook-events.html`
  showing every LS webhook delivery (event_name, event_id,
  signature_valid, processed, received_at, processed_at, error).
  Failures count surfaces in dashboard header.
- **Per-license rate limit** — `activateRateLimit` now also enforces
  3 attempts/min per license key (hashed before bucket lookup). Stops
  distributed brute-force across many IPs against one specific key.
  SaaS threat T8 enhanced.

### Tests
- `npm test`: 19/19 still green.
- `bash scripts/security-smoke.sh`: 9/9 still green.
- Live-verified end-to-end: customer portal auth (401/401/200 with
  correct scope), site revoke (DB updated + customer dashboard
  reflects + audit_log entry), webhook events endpoint returns
  proper shape.

### Bumps
- `ADMIN_BUILD` → M3.1 (sidebar footer stamp visible on next deploy)
- `package.json` 0.6.3 → 0.6.4

## [0.6.3] — 2026-05-25 — P1 cancel-fix + release engineering + dev rate-limit exemption

### Fixed
- **P1 — subscription cancellation no longer skips entitlement disable** when
  variant_id is unknown. Previously `handleSubscriptionEnded` wrapped
  `handleSubscriptionUpsert` (which throws on unmapped variants) and the
  entitlement disable in one transaction → operator rotates a variant in LS
  dashboard → every subsequent cancel rolls back → customer stays "active"
  forever despite cancelling. Fix: split the upsert (best-effort) from the
  disable (always runs); on upsert failure, directly UPDATE subscription
  status + disable entitlement. Live-verified end-to-end with unknown variant.

### Added
- `scripts/check-no-secrets.sh` — 9-check secret/PII scanner. Working-tree
  mode is git-aware (only flags tracked files); release-mode (passed a
  target dir) is strict.
- `scripts/build-plugin-zip.sh` — produces `quoted.zip` with PHP lint +
  secret scan + structural verification (top-level main file present).
  Strips dev/test files, OS noise.
- `scripts/verify-release.sh` — pre-release gate chaining: SQL lint, full
  test suite, security smoke (9 checks), secret scan, npm audit, PHP lint,
  cold-start ZIP test.
- `docs/SECURITY_THREAT_MODEL.md` — 20-row threat × defense table mapping
  every realistic attack to the current mitigation + status.
- `docs/INCIDENT_RESPONSE.md` — 10 numbered runbooks: leaked API key,
  leaked webhook secret, compromised admin, license abuse, webhook backlog,
  broken checkout, broken plugin activation, prod TEST_MODE, DB corruption,
  rollback. Each with stop-bleed → investigate → recover → prevent.

### DX (dev-only)
- Localhost rate-limit exemption in `rateLimiterIp.js`, `rateLimit.js`
  (auth attempts), and `leads.controller.js`. When `NODE_ENV !== production`
  AND request IP is `127.0.0.1` / `::1`, the rate-limit check is skipped.
  Production traffic never originates from 127.0.0.1; this eliminates
  test-suite flakiness without weakening the production posture. Verified:
  3/3 consecutive `npm test` runs green; previously ~60% pass rate on
  cumulative test runs.

### Tests
- `npm test`: 19/19 pass (3 runs consecutive verified).
- `bash scripts/security-smoke.sh`: 9/9 pass.
- New runbook drill targets in `INCIDENT_RESPONSE.md` quarterly schedule.

## [0.6.2] — 2026-05-25 — P0 security hardening from master-prompt audit

Acted on the CTO master-prompt P0 items. Four exploitable surfaces hardened
before paid launch. Security smoke (`scripts/security-smoke.sh`) green 9/9.

### Security fixes

- **P0.1 — Cross-tenant data lockdown.** `/api/admin/quoted/*` (customers,
  subscriptions, orders, revenue) now requires platform admin (`tenant_id=1`
  + `role=admin`). Previously gated only by `requireAuth` — any tenant
  admin would have seen everyone's SaaS data. New middleware
  `core/middleware/requirePlatformAdmin.js`. Returns 403 PLATFORM_ADMIN_REQUIRED
  for non-platform users, 401 AUTH_REQUIRED for unauthenticated.
- **P0.2 — Activation token domain binding + normalization.** Previously
  `validate({ token, site_url })` decoded the token but did NOT compare
  `claims.site_url === site_url` — a token issued for `example.com` could
  be replayed on `attacker.com` to use the customer's paid license on
  another site. Now: token mint includes `normalized_domain` (lowercase,
  no-protocol, no-port, no-path, www-stripped). `validate` rejects with
  403 LICENSE_DOMAIN_MISMATCH if the request site_url normalizes to a
  different host. Backward-compat: tokens without `normalized_domain` (≤
  24h old from pre-fix mint) still validate.
- **P0.3 — Public LLM route mount order.** `/api/public/llm` was mounted
  AFTER `app.use('/api/public', resolveTenantFromHost)` — in production
  with strict tenant resolution, the marketing API host would 404 before
  the LLM controller could resolve the customer's site via the
  `X-Quoted-Domain` header. Now mounted BEFORE the generic resolver so
  the LLM controller handles its own tenant resolution.
- **P0.4 — Production boot preflight.** Added 2 fail-fast checks in
  `core/config/env.js`:
  1. `NODE_ENV=production` + `LEMONSQUEEZY_TEST_MODE=true` → throws on
     boot. Without this, real customers would pay but receive synthetic
     LS responses → no license, no entitlement, silent revenue loss.
  2. `NODE_ENV=production` + missing `LEMONSQUEEZY_WEBHOOK_SECRET` →
     throws on boot. Without it, every webhook returns 401 fail-closed
     → silent subscription/license update loss.

### Added

- `scripts/security-smoke.sh` — 9-check security smoke test runner
  covering all 4 P0s. Run after every deploy.
- `docs/AUDIT_REPORT.md` + `BUG_FIX_LOG.md` + `SMOKE_TEST_REPORT.md` +
  `SECURITY_REVIEW.md` + `RELEASE_NOTES_v0.6.1.md` (the v0.6.1 audit
  package — kept for trail).

### Tests

- 19/19 npm test still green (no regression).
- `bash scripts/security-smoke.sh` → 9/9 pass.
- requirePlatformAdmin unit test: 5/5 (4 role/tenant combos + no-user).

## [0.6.1] — 2026-05-25 — Formal audit pass + release-eng docs

(See `docs/RELEASE_NOTES_v0.6.1.md`. v0.6.0 audited; 0 P0/P1/P2 found.
v0.6.2 layered the master-prompt P0 hardening on top.)

## [0.6.0] — 2026-05-25 — Quoted SaaS admin surfaces (M3)

10 new admin endpoints under `/api/admin/quoted/*` for customers,
subscriptions, licenses, WP sites, bot crawls, posts, citations,
webhook events + a SaaS-focused dashboard. 6 new admin UI tabs.
Sidebar restructured into 4 priority groups. Renderer simulator 19/19
real-data pages.

## [0.5.0] — 2026-05-25 — Real CMS-driven marketing + functional admin

The marketing site's home page can now be edited from the admin without
code changes, and the admin UI itself was rewritten to actually call the
backend (the previous shipping admin was a UI mockup with hardcoded
Vinhomes real-estate demo data and zero fetch calls).

### Added (M1 — hero through OmniPlug page_sections)
- Migration `037_quoted_marketing_pages.sql` seeds `page_key=quoted_home`,
  `section_key=hero` with the live Quoted hero copy. Idempotent
  (`INSERT OR IGNORE`).
- `frontend/assets/cms.js` (~150 LoC) — hydration helper. Reads
  `data-cms` / `data-cms-href` bindings on the static HTML and patches
  text + safe attrs only (never `innerHTML`). 5s fetch budget. Fail-safe
  to static fallback if API down.
- `frontend/index.html` hero is now CMS-editable: eyebrow chip, lead
  paragraph, both CTA labels + URLs. `<h1>` stays static (inline
  `<br>`+`<span class="accent">` — milestone 6 will add a whitelisted
  mini-markup).
- New test suite `quoted-test-cms-frontend.mjs` (T-CMS-FE-1..6) covering
  endpoint shape, hero contract, cache header, programs header, promo
  items array, unknown-page safety.

### Added (M1b — promotions section header)
- Migration `038_quoted_marketing_programs.sql` seeds the "Programs"
  promotions section header (eyebrow / heading / lead paragraph) on
  the home page.

### Added (M2 — admin UI wired to real backend)
- Full rewrite of `backend/omniplug/src/cms/admin/assets/page-content.js`.
  Every renderer is async and calls the real `/api/admin/*` endpoint.
  All Vinhomes demo arrays removed.
- New `page-content-handlers.js` — centralised Save handlers:
  - `.js-save-section` → `PATCH /api/admin/pages/sections/:id` with
    inline JSON parse + busy state + toast feedback.
  - `.js-save-site` → `PUT /api/admin/site/:key` (the upstream uses PUT,
    not PATCH; the original mock UI would have hit the wrong verb).
- `page-init.js` now `await`s the async renderer and shows a loading
  skeleton between the chrome and the data.
- New `renderPagesAdmin` (the old admin had no `pages:` case at all —
  `/admin/pages.html` was falling back to the dashboard renderer).
  Groups sections by `page_key`, renders an inline form per section
  with Title / Subtitle / Payload JSON / Visible toggle + Save button.
- `renderSite` is a real per-key editor backed by `/api/admin/site`.
- `renderUsers`, `renderTenants`, `renderAudit`, `renderLicense`,
  `renderLeads`, `renderMedia`, `renderArticles`, `renderProjects`
  show real DB data read-only with a warning banner where the write UI
  is deferred (queued for M3).
- `renderDashboard` shows real counts (users, tenants, sections, audit
  entries, leads, site config keys, license plan) instead of fake KPI
  numbers.
- `frontend/assets/cms.js`: `pickField` extended to walk dot paths
  (`programs.items.0.title` → `payload.items[0].title`). Backward
  compatible with the flat `hero.subtitle` style.
- Migration `039_quoted_marketing_programs_items.sql` enriches the
  `programs` payload with `items[]` for all 6 launch cards (Early bird,
  Guarantee, Switch & save, Partner, Non-profit & edu, Refer) via
  `json_set` guarded by `json_extract($.items) IS NULL` — strictly
  idempotent + never overwrites operator edits.
- `frontend/index.html`: all 6 promotion cards now bind to
  `programs.items.N.{pill,title,body,code,cta_label,cta_url,meta}`.
  SVG icons + per-card styling stay static.
- `pages.html` `data-page` fixed from `sections` → `pages`.
- Sidebar gains a Pages link (was missing).

### Fixed (M2.1 — final mock scrub + cache strategy)
- Three remaining hardcoded `vinhomes.vn` strings in `shell.js`:
  the email fallback, the brand sub-line, and the `'Pro'` role label.
  Brand sub now resolves from `/api/admin/tenants` (the current tenant's
  domain).
- Brand name flipped from "OmniPlug CMS" → "Quoted CMS".
- Login form placeholder updated from `admin@vinhomes.vn` →
  `admin@quoted.local`.
- `/admin/*` static assets now send `Cache-Control: no-cache,
  must-revalidate` — without this, ESM modules were pinned in browser
  memory and the new admin UI was invisible until the operator manually
  hard-refreshed.
- New visible build stamp in the sidebar footer (`vX.Y.Z · admin build
  M2.1`) so the operator can confirm a fresh deploy at a glance.

### Fixed (pre-existing P1 in `.env.example`)
- `LEMONSQUEEZY_TEST_MODE` defaulted to `false`, contradicting the
  README's "default `.env` ships in `TEST_MODE=true`" promise and
  breaking the SDK + checkout suites on every fresh bootstrap.
  Restored to `true` + added placeholder hosted-checkout URLs so
  `npm test` is 19/19 green from a clean install.
- `CORS_ORIGIN` now includes `:5500` (the marketing site dev port —
  `npm run fe`) and the `127.0.0.1` variants so CMS hydration is not
  blocked in dev.

### Docs
- `docs/CMS-FRONTEND-INTEGRATION.md` — design + milestone roadmap
  (M1..M7).
- `docs/CMS-CEO-GUIDE.md` — CEO operator walkthrough: what's editable
  today, what's coming, what never to touch.
- `docs/LAUNCH-HANDOFF.md` — 10-section CEO handoff: exec summary,
  production checklist, Lemon Squeezy webhook setup, domain mapping,
  sales flow, smoke test, do-not-touch list, commercial-readiness
  statement, one-page operator instruction.

### Tests
- `npm test`: 19/19 pass (was 16/19 before TEST_MODE fix; +6 new
  CMS-frontend assertions; no regression on the 15 commercial
  T-PAY/T-LIC/T-E2E tests).

## [0.4.0] — 2026-05-25 — Commercial layer

### Added
- Backend `payments/` module — `/api/payments/checkout` (Mode A hosted-URL),
  `/api/payments/webhook/lemon-squeezy` (HMAC + idempotency), `/api/products/plans`.
- Backend `licenses/` module — `/api/v1/licenses/{activate,validate,deactivate}`
  proxying the Lemon Squeezy License API server-side. Plugin holds no LS keys.
- 7 new schema migrations (030–036): `customers`, `orders`, `subscriptions`,
  `customer_licenses`, `entitlements`, `webhook_events`, plus `wp_sites` link
  columns.
- Frontend `success.html` post-checkout landing page + `assets/checkout.js`
  wiring `[data-checkout-plan]` CTAs to `/api/payments/checkout`. Cloudflare
  Pages `_headers` (CSP) + `_redirects` (pretty URLs).
- WP plugin `includes/class-quoted-backend-client.php` — thin client for our
  backend API (no LS dependency).
- 15 new commercial-flow tests (T-PAY × 9, T-LIC × 5, T-E2E × 1) in
  `tests/quoted-test-*.mjs`.
- `docs/ARCHITECTURE-COMMERCIAL.md` — ADR explaining LS-proxy choice.
- `docs/SYSTEM-AUDIT.md` — 12-area system audit from this pass.
- `docs/FRONTEND-AUDIT.md` — frontend audit from this pass.

### Changed
- WP plugin `class-quoted-license.php` rewritten (288 → 203 lines): now calls
  our backend's `/api/v1/licenses/*` instead of `api.lemonsqueezy.com` direct.
  Public interface (`activate`, `validate`, `deactivate`, `is_connected`,
  `current_plan`) preserved.
- `POST /api/v1/wp-sites/register` now requires `{ activation_token, domain, … }`
  (was `{ license_key, domain, … }`). Legacy envelope path removed.
- Marketing CTAs in `index.html` + `pricing.html` say "Start Pro"/"Start Agency"
  (was "Start Starter"/"Start Pro") to match backend plan vocabulary.

### Removed
- `qtd_(live|test)_<jwt>` envelope flow: `verifyQuotedLicense` +
  `isQuotedLicenseRevoked` in `wp-sites/quoted-licenses.js`.
- `scripts/qtd-license-sign.js` (was a never-shipped operator CLI).

### Fixed
- `upsertCustomerByLemon` dual-key conflict (email + lemon_customer_id):
  rewrote as explicit find-by-lemon-id → find-by-email → update-or-insert.
- llms-content endpoint stripped `www.` prefix and rejected empty
  `X-Quoted-Domain` headers (was silently falling back to Host tenant).
- `/api/v1/wp-sites/register` rate-limited (5/min/IP, was unlimited).
- SQL pattern lint false-positive on `markdown.serializer.js` JSDoc.

## [0.3.0] — 2026-05-22

## [0.1.0] — 2026-05-23

### Initial Phase 0 Scaffold

**Maintainer:** Nguyễn Mạnh Quang &lt;quangnm0208@gmail.com&gt;

Production-bound scaffold. Not yet deployed.

#### Added — WordPress plugin

- Main entry point with WP plugin headers, PSR-style autoloader
- 8-click onboarding wizard (license → niche → scan → test → done)
- Admin dashboard with AI Distribution Score gauge
- Bot detection middleware covering 14 AI bots:
  - ClaudeBot, GPTBot, ChatGPT-User, OAI-SearchBot
  - PerplexityBot, Perplexity-User
  - GoogleExtended, Applebot-Extended
  - Bytespider, FacebookBot/Meta, CCBot, DiffBot
  - Cohere, YouBot
- Local bot crawl logging with SHA-256 IP hashing
- Hourly cron sync to backend (`quoted_cron_sync_crawls`)
- Twice-daily post sync (`quoted_cron_sync_posts`)
- Hourly JWT refresh (`quoted_cron_refresh_token`)
- REST endpoints:
  - `GET /wp-json/quoted/v1/llms.txt`
  - `GET /wp-json/quoted/v1/llm/{slug}`
- Rewrite rule: `/llms.txt` at site root
- "Powered by Quoted" footer badge (free tier)
- Full uninstall cleanup
- WordPress.org-compatible `readme.txt`
- i18n template (`languages/quoted.pot`)
- Settings: backend URL, IP hashing toggle, badge toggle, disable logging
- HTML→Markdown serializer using DOMDocument

#### Added — Backend (OmniPlug v1.5.0 extensions)

- SQL migrations 022 (wp_sites), 023 (bot_crawls), 024 (citations), 025 (notif_prefs)
- `wp-sites` module: registration, JWT issuance, post sync, dashboard summary
- `bot-crawls` module: batch ingestion with minute-precision dedup
- `llms-content` module: public llms.txt + markdown endpoints
- `citations` module: schema + stub endpoints (full impl in Phase 2)
- `live-ai-test` module: stub returning 501 (full impl in Phase 1)
- jsdom-based markdown serializer reusing OmniPlug seo-validator patterns
- Domain-bound license verification with anti-resale check
- Free tier quota enforcement: 50 posts limit
- AI Distribution Score formula (diversity 40 / volume 30 / coverage 30)

#### Added — Documentation

- Architecture overview
- API contract (8 endpoints documented)
- Phase 0 build plan (4-week, task-by-task)
- Citation tracking algorithm spec (for Phase 2)
- Deployment guide (Fly.io + WP install)
- Debugging guide (12 common failure modes)

#### Known limitations (intentional)

- Live AI Test returns "coming soon" placeholder in onboarding step 4
- Citation tracking dashboard tab shows paywall teaser for free tier
- Push notifications not implemented (Phase 1)
- Paddle payment integration not implemented (Phase 1)
- Niche benchmark not implemented (Phase 3)
- Agency tier not implemented (Phase 4)
- Chart.js must be manually downloaded (see admin/js/chart.umd.min.js note)

#### Conventions established

- Vietnamese-facing strings: keep Vietnamese with diacritics
- Code comments, variable names, log messages: English
- User-facing UI strings: English first (i18n-ready)
- Error envelope: `{ error: { code, message, details } }`
- License key prefix: `qtd_live_` / `qtd_test_`
- License signing: full Vietnamese name "Nguyễn Mạnh Quang" with diacritics
- SQL migrations: idempotent, numbered, never edit shipped ones
- WP coding standards (phpcs WordPress standard)
- Backend follows OmniPlug v1.4.4 module pattern (controller/service/repository)
