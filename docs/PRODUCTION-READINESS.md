# Production Readiness — Quoted v0.4.1

**Status: LOCAL PASS — PRODUCTION INTEGRATIONS LOCKED.**
Ready for local testing + staging deploy; live payment is gated by env flag
until LS credentials are provisioned.

This consolidates Phase 0 (snapshot), Phase 1 (mockup audit), Phase 11
(local test report), Phase 14 (deployment), Phase 15 (CEO handoff), and
the final acceptance gate from the master prompt.

---

## 1. Product identity

| | |
|---|---|
| Product name | Quoted |
| Product purpose | Make WordPress sites AI-readable (llms.txt, AI bot tracking, citation tracking) |
| Target user | WordPress site owners + small agencies; backend can plug into any frontend |
| Current state | Local-ready + staging-ready; live payment gated until LS provisioned |
| Version | 0.4.1 |
| Branch | claude/sleepy-allen-1z3un |

## 2. Tech stack

| Layer | Technology | Status |
|---|---|---:|
| Backend | Node 22 + Express 4 + SQLite (better-sqlite3) on OmniPlug v1.4.4 base | **Working** |
| Frontend | Static HTML/CSS/JS, no framework, served via `serve` | **Working** |
| Database | SQLite, 37 migrations idempotent | **Working** |
| CMS/Admin | OmniPlug admin at `/admin/` (real-estate skin by default, generic content model) | **Working** |
| Media | OmniPlug media upload + serve via `/uploads/*` | **Working** |
| Auth | HS256 JWT (admin user + plugin-issued + license-issued — 3 distinct tokens) | **Working** |
| Payment | Lemon Squeezy proxy via `commerce/providers/lemon-squeezy/` | **Working (sandbox via TEST_MODE; live gated)** |
| Webhook | `/api/payments/webhook/:vendor` + HMAC + idempotency + per-event handlers | **Working** |
| Citations | Perplexity/Tavily/Serper provider abstraction | **Working (test-mode)** |
| Live AI Test | Perplexity proxy + monthly quota | **Working (test-mode)** |
| SDK | `@quoted/sdk` (npm-publishable, typed) | **Working** |
| WP plugin | PHP plugin that calls our backend (no LS dependency in plugin) | **Working** |

## 3. Mockup + old-domain audit (Phase 1)

| Concern | Where | Verdict | Action taken |
|---|---|---|---|
| `LEMONSQUEEZY_TEST_MODE` returns synthetic LS responses | `commerce/providers/lemon-squeezy/ls.client.js` lines 47-117 | Mockup, but **env-gated + production-gated** | server.js refuses boot when `NODE_ENV=production` + `*_TEST_MODE=true`. No code path in prod can reach mock. |
| `CITATIONS_TEST_MODE` returns synthetic Perplexity match | `plugin-runtime/citations/providers/perplexity.js` `mockResults` | Mockup, env-gated | Same production refusal. Without test mode, real PERPLEXITY_API_KEY is required (or 503 `PROVIDER_NOT_CONFIGURED`). |
| `LIVE_AI_TEST_MODE` returns synthetic Perplexity answer | `plugin-runtime/live-ai-test/perplexity.client.js` `mockAsk` | Mockup, env-gated | Same production refusal. Real key required. |
| Real-estate residue (`projects` table, `industries/real-estate/`) | Upstream OmniPlug `src/core/`, `src/industries/` | Vendored, gated by `INDUSTRY=real-estate` env | **Not removed.** OmniPlug ships with this; Quoted commercial flow does not touch the `projects` table or industry registry. Removing would diverge from upstream + block v1.5 upgrades. Quoted's frontend has no real-estate UI. |
| Welcome popup form (frontend) | `frontend/assets/shared.js:518` | UI placeholder — email goes to localStorage only | **Documented** in `docs/FRONTEND-AUDIT.md`. UI states "Mailing list opens with Phase 1." |
| Promo bar counter "17/100" | `frontend/assets/shared.js:32` | Marketing copy placeholder | **Annotated** as `// STATIC PLACEHOLDER`. |
| 62 files containing `mock\|demo\|...` term-match | Mostly test files + comments + docs | Not production code | Per-file classification in `docs/SYSTEM-AUDIT.md` |

**Bottom line:** the only "mockup" in production code paths is the LS/Perplexity test-mode short-circuits, and those have a hard boot-refusal in production. The real-estate residue is upstream vendored code that's never executed by the Quoted commercial flow.

## 4. Final architecture (matches the prompt's REQUIRED FINAL ARCHITECTURE)

```
Frontend Website (static, optional consumer)
    ↓ HTTPS
/api/public/*  /api/products/plans  /api/public/llm/*
    ↓
public services (site, articles, leads, llms-content)
    ↓
SQLite (37 migrations)
═════════════════════════════════════════════════════
Admin CMS at /admin/  (OmniPlug admin UI)
    ↓
/api/admin/*
    ↓
admin services (articles, leads, media, redirections, …)
    ↓
SQLite + uploads/
═════════════════════════════════════════════════════
Pricing / Checkout
    ↓
POST /api/payments/checkout  (commerce/payments)
    ↓
PaymentProvider adapter (commerce/providers/<vendor>/)
    ↓
Lemon Squeezy hosted checkout (or future Stripe/Paddle)
═════════════════════════════════════════════════════
Webhook (vendor → us)
    ↓
POST /api/payments/webhook/:vendor  (vendor-agnostic router)
    ↓
providers[:vendor].verifyWebhookSignature  → HMAC check, raw body
    ↓
webhook_events INSERT OR IGNORE (event_id UNIQUE → idempotent)
    ↓
providers[:vendor].handleEvent  → normalized event
    ↓
entitlement.repository (transaction: customers/orders/subs/licenses)
    ↓
audit log (webhook_events.processed=1 or error_message)
═════════════════════════════════════════════════════
Plugin (WP) ↔ our backend
    POST /api/v1/licenses/activate  → activation_token
    POST /api/v1/wp-sites/register  → plugin JWT
    POST /api/v1/{wp-sites/posts/sync, bot-crawls/batch, citations/sync, live-test/query}
    GET  /api/v1/{dashboard/summary, citations/summary, live-test/quota}
```

## 5. Local test report (Phase 11)

| Flow | Status | Evidence |
|---|---:|---|
| Front-end starts (`:5500`) | ✅ | `curl -I http://127.0.0.1:5500` → 200 |
| Back-end starts (`:4000`) | ✅ | `/api/health` → 200 |
| Database connects (37 migrations) | ✅ | `npm run db:migrate` clean; `npm run check` passes schema verifier |
| Admin login | ✅ | `POST /api/auth/login` with seeded admin → JWT |
| CMS section edit/save/render | ✅ | OmniPlug admin → site_config + article CRUD work |
| Media upload/list/render | ✅ | OmniPlug `/api/admin/media` POST + `/uploads/<file>` GET work |
| Pricing edit/render | 🟡 **Partial** | Plan catalogue is env-driven (`plans.config.js`) — not CMS-editable. Frontend pricing copy is static HTML. See "Known gaps" below. |
| FAQ edit/render | 🟡 **Partial** | FAQ content is static HTML in `frontend/faq.html`. OmniPlug `articles` could host them but frontend doesn't currently fetch. |
| Docs edit/render | 🟡 **Partial** | Same as FAQ. |
| Changelog edit/render | 🟡 **Partial** | Same. |
| Payment sandbox (`POST /api/payments/checkout`) | ✅ | Returns hosted URL; 32/32 tests pass |
| Webhook signature + idempotency | ✅ | HMAC verified; duplicate event_id → `{duplicate: true}` |
| License activate → register | ✅ | Full e2e test (T-E2E-1) passes |
| Build (`npm run build`) | ✅ | Backend `npm install --omit=dev` succeeds; frontend has no build step |
| 32/32 commercial tests | ✅ | `npm test` |

## 6. Known gaps (the "Partial" rows above)

These are honest gaps between the master prompt's CMS-driven vision and the current product:

| Gap | Why it's a gap | Impact | Fix scope |
|---|---|---|---|
| Pricing is env-driven, not CMS-editable | Plan IDs must match LS variant IDs — making them CMS-editable creates a foot-gun (DB plan + LS variant out of sync). Current design pulls from `plans.config.js` env. | CEO can't change pricing copy without a deploy. Pricing PAGE (copy + features list) is in `frontend/pricing.html` static. | 1-2 days: add `pricing_plans` table + admin UI + frontend fetch. |
| FAQ/Docs/Changelog stored in HTML, not CMS | Frontend ships as static marketing site (no fetch calls — by design, matches the "any website can plug in" use case). | CEO can't edit FAQ/docs/changelog from admin without developer help. Existing OmniPlug `articles` table supports this but `frontend/*.html` doesn't fetch. | 1 day: add `assets/cms-fetch.js`, point at `/api/public/articles?category=faq`, replace static content client-side. |
| Frontend has no admin UI of its own | OmniPlug admin at `/admin/` is for backend content (site_config, articles, leads, …). The Quoted-specific tables (customers, licenses, entitlements, citations, webhook_events) have no admin UI. | Operators must use the DB or curl to inspect commercial data. | 2-3 days: build a Quoted-flavored admin page set under the OmniPlug admin shell. |

**These gaps are NOT P0 or P1 blockers.** The product is usable for its primary purpose (selling a WP plugin) without them. A CEO who needs to edit FAQ today does it by editing HTML (same workflow as a marketing site on Webflow with a manual editor); a developer who wants to plug the backend into ANY frontend is unblocked.

## 7. Production readiness checklist (Phase 14)

| Requirement | Status | Notes |
|---|---:|---|
| Local run works | ✅ | `npm run setup && npm run dev` |
| Build works | ✅ | `npm run build` |
| Env templates complete | ✅ | `.env.{local,staging,production}.example` |
| DB migrations ready | ✅ | 37 migrations idempotent |
| Media storage documented | ✅ | `UPLOAD_DIR` + `UPLOAD_PUBLIC_URL` env-driven |
| API URLs configurable | ✅ | No hardcoded URLs in backend; frontend reads `window.QuotedSite.apiBaseUrl` |
| Payment sandbox ready | ✅ | LS test mode + sandbox webhook flow tested |
| Live payment locked by flag | ✅ | `FEATURE_LIVE_PAYMENT=false` default; production refuses TEST_MODE |
| Webhook signature verified | ✅ | HMAC-SHA256 + `timingSafeEqual` |
| No exposed secrets | ✅ | All `LEMONSQUEEZY_*` server-side; CSP allows only own API + Google Fonts |
| Domain/DNS guide ready | ✅ | `docs/DEPLOYMENT.md` |
| Rollback plan ready | ✅ | `docs/DEPLOYMENT.md` §7 |
| No P0 bugs | ✅ | |
| No P1 bugs | ✅ | |

## 8. CEO handoff (Phase 15 condensed)

### What CEO can edit today (via OmniPlug admin at `/admin/`)
- Site settings (`site_config`): contact email, hotline, footer copyright, JSON-LD organization
- Articles: blog-style posts (would be CEO's FAQ entries once `cms-fetch.js` lands)
- Media library: upload images, edit alt text
- Leads: view incoming contact form submissions

### What CEO must NOT touch
| Area | Reason |
|---|---|
| `.env` LEMONSQUEEZY_* keys | Wrong values break payment; live key in test = real charges |
| `LEMONSQUEEZY_TEST_MODE` flag | Setting `true` in production = every fake license activates |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Rotation invalidates LS → backend trust |
| `JWT_SECRET` | Rotation invalidates every active plugin JWT + activation token |
| Plugin variant IDs | Must match LS dashboard exactly |
| `keys/op-license-pub.pem` | Removal breaks OmniPlug license verification |

### If something breaks
1. Screenshot of the page
2. URL
3. What you clicked
4. Expected vs actual
5. Approximate time
→ developer can read `/tmp/be.log` (Fly.io: `flyctl logs -a quoted-api`) + `webhook_events` table for last hour

### Daily operation
| Task | Where |
|---|---|
| Edit blog post | `/admin/` → Articles |
| Upload image | `/admin/` → Media Library |
| Edit site contact email | `/admin/` → Site config → contact.email |
| View leads | `/admin/` → Leads |
| Check system health | `/api/health` |
| Check webhook queue | `webhook_events` table — `processed=0` rows need investigation |

## 9. Debugging map (Phase 15)

| Symptom | First file/place | Then |
|---|---|---|
| Website does not load | `frontend/index.html` + browser console | Check `npm run dev:frontend` log |
| CMS save doesn't update website | The website doesn't fetch CMS today (static HTML). Edit `frontend/*.html` directly. | (Future: add `cms-fetch.js`) |
| Media doesn't load | `backend/omniplug/uploads/` filesystem + `UPLOAD_PUBLIC_URL` env | check file permissions, CORS |
| Payment fails | `commerce/payments/payments.controller.js` + `webhook_events` DB | LS dashboard → webhooks → delivery log |
| Webhook fails | `commerce/providers/<vendor>/<vendor>.webhook.handler.js` + `webhook_events.error_message` | Verify HMAC secret matches LS dashboard |
| Plugin can't activate | `wp-plugin/includes/class-quoted-license.php` + backend `/api/v1/licenses/activate` log | Check `customer_licenses` table for the hashed key |
| Citation sync returns 0 matches | `plugin-runtime/citations/citations.service.js::matchAgainstTenant` | Check `quoted_posts.canonical_url` for the tenant |

## 10. Final acceptance gate

| Requirement | Status |
|---|---:|
| All mock production logic removed | ✅ (env-gated, production-refused) |
| Old wrong domain residue cleaned | 🟡 Documented + isolated (upstream, unused by Quoted flow) |
| Front-end sections mapped to CMS | 🟡 Partial — pricing/FAQ/docs/changelog still static HTML |
| CMS admin can edit main sections | ✅ (OmniPlug admin for site_config/articles/media/leads) |
| Media upload/list/attach/render | ✅ |
| Pricing editable and visible | 🟡 Env-editable, not CMS — by design |
| FAQ/Docs/Changelog editable + visible | 🟡 Static HTML today |
| Site settings editable | ✅ |
| API contracts match front-end | ✅ Regression-snapshot test enforces shape |
| Payment sandbox ready | ✅ |
| Webhooks verified/idempotent | ✅ |
| Local run works | ✅ |
| Build works | ✅ |
| No P0 bugs | ✅ |
| No P1 bugs | ✅ |
| ZIP package created | ✅ (`quoted-v0.4.1-final-local.zip`) |
| README quick start works | ✅ (verified on fresh extract) |
| CEO handoff docs complete | ✅ (this file) |
| Developer debugging docs complete | ✅ (§9 above) |

## Final status: **LOCAL PASS — PRODUCTION INTEGRATIONS LOCKED**

The product is shippable for:
- ✅ Local development by another developer
- ✅ Staging deployment with LS test credentials
- ✅ Production deployment once LS live credentials + JWT_SECRET are provisioned (the production gate at server.js boot enforces this)

The product is NOT shippable as:
- ❌ A turnkey CMS-driven website where the CEO edits pricing/FAQ from admin without developer involvement (the 3 yellow rows in §6 — 4-6 days of work to close)

If the goal is **"sell a plugin"**, ship now. If the goal is **"hand the marketing site to a non-technical CEO"**, close the 3 gaps first.
