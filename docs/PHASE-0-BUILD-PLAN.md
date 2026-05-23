# Phase 0 — Build Plan (Weeks 1–4)

**Goal:** Ship a WordPress plugin that installs in <2 minutes, completes
onboarding in 8 clicks, and generates real bot traffic data within 24 hours
of install. Free tier only. No payment integration yet.

**Acceptance:** A WP site operator (think: Marcus, our primary persona) can
install the plugin, see `ClaudeBot visited 2h ago` on their dashboard within
a day, and feel "AI is reading me" instead of "AI is killing me."

**Out of scope:** Live AI Test, citation polling, paywalls, push notifs, agency tier.

---

## Week 1 — Backend foundation (Mon–Sun)

Solo effort: ~25h. Freelance: 0h (you own the backend).

### Mon — Migrations + new modules scaffold (5h)

- [ ] Copy `backend/migrations/022_wp_sites.sql` through `025_notif_prefs.sql`
      into `omniplug-cms-core/src/core/db/migrations/`
- [ ] Run `node src/core/db/migrate.js` against test DB
- [ ] Verify `node scripts/verify-schema.js` shows 4 new tables
- [ ] Copy `backend/modules/wp-sites/*` into OmniPlug `src/backend/modules/`
- [ ] Copy `backend/modules/bot-crawls/*` into same
- [ ] Copy `backend/modules/llms-content/*` into same
- [ ] Wire routes in `src/backend/server.js`:
  ```js
  import wpSitesRouter from './modules/wp-sites/wp-sites.controller.js';
  import botCrawlsRouter from './modules/bot-crawls/bot-crawls.controller.js';
  import llmsContentRouter from './modules/llms-content/llms-content.controller.js';
  app.use('/api/v1/wp-sites', wpSitesRouter);
  app.use('/api/v1/bot-crawls', botCrawlsRouter);
  app.use('/api/public/llm', llmsContentRouter);
  ```
- [ ] Boot backend, hit `GET /api/health` → 200

**Done when:** `curl localhost:4000/api/health` returns 200 AND 4 new tables exist.

### Tue — wp-sites registration endpoint (5h)

The WP plugin needs to "phone home" on activation. Implement:
`POST /api/v1/wp-sites/register` — accepts license key + domain → creates tenant.

- [ ] Implement `wp-sites.service.js → register(licenseKey, domain, wpVersion)`
- [ ] Validate license key signature (reuse OmniPlug `core/lib/licenseKey.js`)
- [ ] Domain validation: must match license `domain` field (anti-resale)
- [ ] Create or reuse tenant via `tenancy.byDomain()` (OmniPlug)
- [ ] Return JWT for subsequent WP→backend calls
- [ ] Unit test: valid key + matching domain → 200 + JWT
- [ ] Unit test: valid key + WRONG domain → 403
- [ ] Unit test: expired license → 410

**Done when:** 3 unit tests pass.

### Wed — Bot crawl ingestion endpoint (5h)

WP plugin batches bot crawl events and POSTs hourly:

```
POST /api/v1/bot-crawls/batch
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "events": [
    {
      "bot_name": "ClaudeBot",
      "url_path": "/best-running-shoes",
      "user_agent": "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "ip_hash": "sha256:abc...",
      "crawled_at": "2026-05-23T10:32:00Z"
    }
  ]
}
```

- [ ] Implement controller with auth middleware
- [ ] Validate event shape (zod schema)
- [ ] Batch insert with tenant_id from JWT
- [ ] Rate limit: max 500 events per request, max 24 requests/hour/site
- [ ] Dedupe: same bot + url + minute = 1 row (UPSERT with unique index)

**Done when:** `tests/test-bot-crawls.mjs` passes (4 cases).

### Thu — llms.txt + markdown content endpoint (6h)

- [ ] Implement `llms-content.controller.js`:
  - `GET /api/public/llm/sitemap.txt` → returns llms.txt for tenant
  - `GET /api/public/llm/posts/:slug.md` → returns markdown
- [ ] Resolve tenant from `Host` header (use existing OmniPlug `tenantMiddleware`)
- [ ] Implement `markdown.serializer.js`:
  - Reuse `htmlToText()` from `seo-validator.rules.js` as base
  - Extend: preserve headings as `# H1`, `## H2`, etc.
  - Convert `<a>` to `[text](url)`, `<img>` to `![alt](url)`
  - Strip script/style/iframe entirely
  - Strip nav/footer/aside semantic tags
- [ ] Cache rendered markdown 24h in `seo.cache.js` (reuse cache layer)
- [ ] Set headers: `Content-Type: text/markdown`, `X-Quoted-Version: 1`,
      `Cache-Control: public, max-age=300, s-maxage=86400`

**Done when:** `curl localhost:4000/api/public/llm/posts/test-post.md -H "Host: testsite.local"` returns clean markdown.

### Fri — Free tier quota enforcement (3h)

- [ ] In `wp-sites.service.js`, expose `getQuota(tenantId)` returning:
  ```js
  { posts_synced: 47, posts_limit: 50, history_days: 7 }
  ```
- [ ] Plugin uses this to gate features. Backend doesn't reject sync past
      limit — just flags `over_quota: true` so plugin shows upgrade prompt.
- [ ] Migration 025 already sets `plan='free'` default on `tenants`.

### Sat–Sun — Backend integration test + Fly.io staging deploy (6h)

- [ ] Write `tests/e2e-phase0.mjs`:
  1. Register WP site → get JWT
  2. POST 10 bot crawl events → 200
  3. GET dashboard summary → counts match
  4. GET llms.txt → contains synced post slugs
  5. GET markdown for slug → returns content
- [ ] All 5 steps green
- [ ] `fly deploy -a omniplug-staging`
- [ ] Smoke test against staging URL

**Week 1 acceptance gate:** Staging backend serves all 5 endpoints, e2e test green.

---

## Week 2 — WordPress plugin scaffold (Mon–Sun)

Solo effort: ~20h. Freelance: ~15h (let them do the boilerplate WP class structure).

### Mon — Plugin skeleton (4h)

- [ ] Take `wp-plugin/` from this package
- [ ] Replace `__YOUR_BACKEND_URL__` in `includes/class-quoted-api-client.php`
      with your Fly.io staging URL
- [ ] Symlink into local WP dev environment
- [ ] Activate → no fatal errors → "Quoted" menu appears in admin
- [ ] Deactivate → no fatal errors → orphan options cleaned up

**Done when:** Plugin activates clean on PHP 7.4 + WP 6.0 + PHP 8.2 + WP 6.5.

### Tue — License activation flow (5h)

- [ ] Polish `admin/partials/onboarding.php` step 1 (license key entry)
- [ ] Wire `class-quoted-license.php → activate($key)` to call backend
      `POST /api/v1/wp-sites/register`
- [ ] On success: store JWT in `wp_options` (encrypted via WP salts)
- [ ] On fail: show specific error code from backend response
- [ ] Test: enter fake key → graceful error, no crash
- [ ] Test: enter real key (from your test issuance) → success, redirect to step 2

### Wed — Bot detector + crawl logger (5h)

- [ ] Polish `includes/class-quoted-bot-detector.php`
- [ ] Hook `init` action: check `$_SERVER['HTTP_USER_AGENT']` against bot list
- [ ] If matched: log to local `wp_quoted_bot_log` table (created on activation)
- [ ] Cron hourly: batch-send `wp_quoted_bot_log` → backend, clear local table
- [ ] If backend unreachable: keep local log (retry next hour)
- [ ] Cap local log at 10,000 rows (drop oldest if exceeded)

**Test manually:**
```bash
curl -A "ClaudeBot/1.0" http://your-wp-site.local/sample-post/
# Then check wp_quoted_bot_log table — should have 1 row
# Wait 1h or run wp-cron manually — backend should receive
```

### Thu — llms.txt + markdown REST endpoints (4h)

- [ ] Polish `public/class-quoted-rest.php`:
  - `register_rest_route('quoted/v1', '/llms.txt', ...)` (yes, file extension in path is legal in WP REST)
  - `register_rest_route('quoted/v1', '/llm/(?P<slug>[a-z0-9-]+)', ...)`
- [ ] Also add rewrite rule: `/llms.txt` at root → REST endpoint
      (use `add_rewrite_rule` + flush on activation)
- [ ] llms.txt content: pull from backend `/api/public/llm/sitemap.txt`
      with 5-minute transient cache locally
- [ ] markdown content: same pattern

### Fri — Admin dashboard + onboarding UI (6h)

- [ ] Polish `admin/partials/dashboard.php`:
  - AI Distribution Score gauge (use Chart.js, bundled)
  - Bot activity feed (last 7 days, max 20 items)
  - "Next action" card
- [ ] Polish `admin/partials/onboarding.php`:
  - 4 steps with progress bar (steps map to clicks 3–6 in design doc)
  - Each step has explicit "Continue" button
  - Step 4 = "Auto-scan top 20 posts" → AJAX call sync API
- [ ] CSS: keep minimal, follow WP admin design language
- [ ] Mobile-responsive (Marcus checks WP on phone too)

**Done when:** Fresh install → onboarding → dashboard in ≤8 clicks.

### Sat–Sun — Polish + smoke test on staging (6h)

- [ ] Test full flow on local WP (PHP 8.2, WP 6.5)
- [ ] Test on local WP (PHP 7.4, WP 6.0) — minimum supported
- [ ] Test with WooCommerce active (compatibility check)
- [ ] Test with RankMath active (no conflict, no duplicate llms.txt)
- [ ] Test with Yoast active (same)
- [ ] Fix any conflicts found

**Week 2 acceptance gate:** Fresh WP install + plugin activate + onboarding + first bot crawl synced to backend in <10 minutes total.

---

## Week 3 — Polish, edge cases, internationalization (Mon–Sun)

Solo effort: ~15h. Freelance: ~10h (i18n + tests).

### Mon — Error handling sweep (4h)

- [ ] Backend unreachable: plugin shows "Reconnecting..." not white screen
- [ ] License expired: graceful re-activation prompt
- [ ] Quota hit: clear UI message, no crash
- [ ] Malformed bot user-agent: don't log garbage
- [ ] Post with no content: markdown endpoint returns 404 not 500
- [ ] Multi-byte chars (Vietnamese, CJK, Arabic): UTF-8 preserved through markdown

### Tue — i18n + .pot file (4h)

- [ ] Wrap all user-facing strings in `__('...', 'quoted')`
- [ ] Generate `languages/quoted.pot`:
  ```bash
  wp i18n make-pot wp-plugin languages/quoted.pot --domain=quoted
  ```
- [ ] Test: switch WP to vi_VN → strings show as English (translations come later)
- [ ] All admin notices use `_n()` for plural forms

### Wed — Privacy + GDPR hooks (4h)

- [ ] Implement WP privacy policy text suggestion
- [ ] Implement personal data export hook (admin → tools → export)
- [ ] Implement personal data erasure hook
- [ ] Add settings: "Hash IPs before sending to Quoted backend" (default ON)
- [ ] Add settings: "Disable bot crawl logging entirely" escape hatch

### Thu — WP coding standards + security audit (5h)

- [ ] Run `phpcs --standard=WordPress wp-plugin/`
- [ ] Fix all errors, document any intentional warnings
- [ ] Verify nonces on ALL admin POST actions
- [ ] Verify capability checks on ALL admin pages (`manage_options`)
- [ ] Verify all DB writes use `$wpdb->prepare()`
- [ ] Verify all REST callbacks have proper `permission_callback`
- [ ] No `eval()`, no `extract()`, no `unserialize()` of untrusted data

### Fri — Performance budget (3h)

- [ ] Plugin must not add >50ms to TTFB on any frontend page
- [ ] Measure with Query Monitor plugin active
- [ ] llms.txt endpoint must respond <200ms (cached)
- [ ] Bot detection must not trigger DB query on every pageview (use static cache)
- [ ] Admin dashboard must load <1s on staging backend

### Sat–Sun — Browser + device testing (5h)

- [ ] Chrome / Firefox / Safari / Edge — admin dashboard
- [ ] iPhone Safari (Marcus checks WP on phone)
- [ ] Android Chrome
- [ ] Test in WP multisite (network activate, single site activate)
- [ ] Test on shared hosting (Bluehost / SiteGround simulators if possible)

**Week 3 acceptance gate:** phpcs clean, no security warnings, <50ms TTFB overhead.

---

## Week 4 — Soft launch prep (Mon–Sun)

Solo effort: ~20h. Freelance: ~10h (case study site + WP.org assets).

### Mon — Production backend deploy (4h)

- [ ] Generate operator EC P-384 keypair (YubiKey, per OmniPlug RUNBOOK-LICENSING)
- [ ] Replace `keys/op-license-pub.pem` placeholder
- [ ] `fly deploy -a omniplug-prod`
- [ ] Run `npm run preflight` — 10/10 green
- [ ] Issue first 5 test licenses to friends willing to alpha-test

### Tue — WP.org submission prep (5h)

- [ ] Polish `wp-plugin/readme.txt` (this format matters for wp.org)
- [ ] Take 5 screenshots:
  1. Dashboard with real data
  2. Onboarding step 1
  3. Bot activity feed
  4. AI Distribution Score
  5. Settings page
- [ ] Create plugin banner (1544×500px) + icon (256×256px)
- [ ] Submit to wordpress.org/plugins — expect 2–4 week review

### Wed — Build "case study site" (4h)

Your own site (or a throwaway) where you:
- Install Quoted
- Have real content (10+ posts)
- Document citations as they appear over Phase 1
- Use as social proof in launch posts

- [ ] Pick existing site OR spin up new WP on $5 DigitalOcean
- [ ] Install plugin, complete onboarding
- [ ] Verify ClaudeBot, GPTBot, PerplexityBot crawl within 7 days
      (they crawl new content reliably — verified in Sep 2025 onwards)

### Thu — Soft launch content (4h)

- [ ] Blog post: "I built an AI-readable layer for my WordPress site. Here's
      what 30 days of ClaudeBot crawls looked like." (publish on your own
      site, link from r/juststart + Niche Pursuits)
- [ ] Twitter thread: 6-tweet teardown of llms.txt with screenshots
- [ ] One LinkedIn post for B2B angle (Ravi persona reach)

### Fri — Soft launch channels (3h)

- [ ] Post in r/juststart (comply with self-promotion rules — give first, ask never)
- [ ] Post in r/SEO (same)
- [ ] Submit to Indie Hackers
- [ ] Cold email 10 niche site operators offering free Pro for case study

### Sat–Sun — Monitor + iterate (4h)

- [ ] Watch error logs hourly
- [ ] Watch first user signups, note where they drop off in onboarding
- [ ] Iterate copy / button placement based on actual drop-off

**Week 4 acceptance gate:** Production deployed, 10 alpha users active, 0 P0 bugs in last 48h.

---

## Risk gates — DO NOT SKIP

| End of week | Gate | If fail, do this |
|---|---|---|
| Week 1 | Backend e2e test green | Stop. Don't start WP plugin. Debug backend. |
| Week 2 | Plugin installs clean on PHP 7.4 + WP 6.0 | Fix compat before adding features |
| Week 3 | phpcs clean, <50ms overhead | Refactor. Performance is non-negotiable. |
| Week 4 | 10 alpha users + 0 P0 bugs | Delay public launch. Don't ship with bugs to wp.org. |

---

## What Marcus feels at end of Week 4

> "I installed this plugin yesterday and just got a notification that ClaudeBot
> crawled my 'best running shoes 2026' post 3 hours ago. I've been worried
> about AI for months. This is the first thing that made me feel like AI is
> actually working *with* my site, not against it."

That sentence is the success metric. Every line of code in this package
exists to produce that sentence in Marcus's head.

---

## Effort summary

| Week | Solo | Freelance | Wall clock |
|---|---|---|---|
| 1 | 25h | 0h | 7 days |
| 2 | 20h | 15h | 7 days |
| 3 | 15h | 10h | 7 days |
| 4 | 20h | 10h | 7 days |
| **Total** | **80h** | **35h × $30 = $1,050** | **28 days** |

If you're solo with no freelance: realistic timeline is 6 weeks, not 4.
The 4-week plan assumes ~25h/week from you + a freelance to take WP boilerplate
work + i18n + tests.
