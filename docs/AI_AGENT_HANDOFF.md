# AI Agent Handoff

> For the next AI agent picking up this project. Read this first.

## Current product status

| Surface | Status | Notes |
|---|---|---|
| Local run | ✅ green | `npm run bootstrap && npm run dev` works on fresh extract |
| Build (`npm test`) | ✅ 19/19 | SQL lint, schema verify, OmniPlug smoke (18), regression (8), CMS-frontend (6), commercial (15), PHP plugin (25), SDK (4) |
| CMS — home hero | ✅ wired | Migration 037; edit at `/admin/pages.html` → `quoted_home` → `hero` |
| CMS — home programs header | ✅ wired | Migration 038 |
| CMS — home 6 promo cards | ✅ wired | Migration 039 (`json_set` idempotent); `data-cms="programs.items.N.field"` bindings on `index.html` |
| CMS — Site Settings | ✅ save works | `/admin/site.html` PUT; frontend wiring is M5 |
| Admin UI | ✅ live data | 13 renderers all call real `/api/admin/*` (was a mockup until M2) |
| Media — backend API | ✅ works | `POST/GET/PATCH/DELETE /api/admin/media`; upload UI is M6 |
| Payment / webhook / license | ✅ green in sandbox | T-PAY×9, T-LIC×5, T-E2E×1; `LEMONSQUEEZY_TEST_MODE=true` default |
| Frontend other pages (pricing, faq, docs, blog, changelog, success) | ⏳ static | M3-M4 will CMS-ify; static fallback present |
| Production deploy | ⏳ operator action | Domain + Fly secrets + LS credentials; see `GO_LIVE_GUIDE.md` |

## What has been completed (commits this session)

| Commit | Tag | Description |
|---|---|---|
| `c219a62` | M1 | Hero through OmniPlug page_sections + migration 037 + cms.js + CORS fix + LS_TEST_MODE default fix |
| `3fd8f3c` | M1b | Programs header migration 038 |
| `51a42be` | docs | LAUNCH-HANDOFF.md (10-section CEO production manual) |
| `8dc83e7` | M2 | Admin UI rewired (page-content.js full rewrite + page-content-handlers.js for Save; 6 promo cards via list-rendering + migration 039) |
| `6a4cb96` | M2.1 | Last vinhomes scrubbing + Cache-Control no-cache on /admin/* + visible build stamp |
| `187c50e` | release | v0.5.0 — CHANGELOG + README updated |
| `bf06dd6` | docs | 00 system snapshot + 01 mockup audit |

## What the next agent should NOT redo

- ❌ Don't rewrite `page-content.js` — it's now real, tested via `/tmp/admin-render-test.mjs` (kept in scratch)
- ❌ Don't add features to OmniPlug upstream files outside `cms/admin/`, `backend/modules/plugin-runtime/`, `backend/modules/commerce/` — those are vendored and need to stay merge-able
- ❌ Don't delete `backend/omniplug/src/industries/real-estate.js` — it's an OmniPlug vertical preset, not residue. Documented in `01_MOCKUP_AUDIT.md`.
- ❌ Don't change the public API response shape from OmniPlug's flat style to `{success, data, error}` envelope — consumers (browser + SDK) are wired to the flat shape; would break both
- ❌ Don't reintroduce hardcoded admin content — every renderer is async + API-backed now

## Next safe tasks (M3 candidates)

In priority order, each is a small enough vertical slice to fit one session:

### M3.a — Wire remaining home sections to CMS
- Add `data-cms="<section>.<field>"` attrs on `index.html` for: the_shift, how_it_works, live_demo, product, compat, use_cases, pricing, testimonials, faq, final_cta
- Add migrations 040-048 seeding each section (`page_sections` rows, `tenant_id=1`, `page_key=quoted_home`)
- Pattern matches M1+M1b exactly. The architecture in `cms.js` (dot-path + array index) already supports all shapes.
- Expected effort: 1 session

### M3.b — CMS-ify pricing page
- Make `pricing.html` fetch `/api/products/plans` (already exists) instead of hardcoded prices
- Read `LEMONSQUEEZY_VARIANT_*` env vars on backend to publish plan data
- Wire CTA buttons to `/api/payments/checkout` (already wired in `checkout.js`)
- Expected effort: 1 session

### M3.c — Add FAQ model + admin + frontend
- New table `faqs (id, tenant_id, category, question, answer, sort_order, published)`
- Migration + repository + controller + admin UI in `page-content.js` (new `renderFaqs` async)
- Wire `faq.html` to `/api/public/faqs`
- Expected effort: 1-2 sessions

### M4 — Articles for docs/blog
- Articles table exists; not wired to docs.html / blog.html
- Add public endpoint listing + category filter
- Wire each frontend page
- Expected effort: 1 session

### M5 — Site settings consumers
- Read `/api/public/site` for header/footer rendering
- Replace static logo + footer text with hydrated values
- Add file picker + upload UI for logo (depends on M6 partial)
- Expected effort: 1 session

### M6 — Media upload UI in admin + frontend image consumer
- Drag-drop in `/admin/media.html`
- Thumbnail grid + alt edit + delete
- Media picker modal callable from Pages editor
- `data-cms-src` consumer on `index.html`
- Expected effort: 2 sessions

### M7 — Write UI for Users, Tenants, License activation
- API already supports POST/PATCH; add forms in admin UI
- Expected effort: 1 session

## If a bug appears

1. Read `docs/12_BUG_LOG.md` for prior art
2. Triage with `docs/DEBUGGING_MAP.md`
3. Find code with `docs/MODULE-MAP.md`
4. Reproduce → fix → retest (run `npm test`) → commit with full bug template from `12_BUG_LOG.md`

## Key files map

| Concern | File |
|---|---|
| Boot order, mount order | `backend/omniplug/src/backend/server.js` |
| Auth | `backend/omniplug/src/backend/modules/auth/auth.controller.js` |
| Page sections (the CMS data model) | `backend/omniplug/src/backend/modules/pages/pages.controller.js` + `pages.repository.js` |
| Admin UI shell | `backend/omniplug/src/cms/admin/assets/shell.js` |
| Admin UI per-page renderers | `backend/omniplug/src/cms/admin/assets/page-content.js` |
| Admin UI save handlers | `backend/omniplug/src/cms/admin/assets/page-content-handlers.js` |
| Frontend hydration | `frontend/assets/cms.js` |
| LS webhook handler | `backend/omniplug/src/backend/modules/commerce/providers/lemon-squeezy/ls.webhook.handler.js` |
| WP plugin API client | `wp-plugin/includes/class-quoted-backend-client.php` |
| Migrations | `backend/omniplug/src/core/db/migrations/*.sql` (037-039 are Quoted) |

## How to verify your work before committing

```bash
# In one terminal
npm run dev

# In another
node /tmp/admin-render-test.mjs   # 13/13 should pass with zero mock strings
npm test                           # 19/19 should pass
```

Both green = safe to commit. If either fails, do NOT commit until fixed.

## Conventions

- Vietnamese for user-facing strings (operator + CEO documentation)
- English for code comments, identifiers, log messages, commit messages
- Errors return `{error: {code, message}}` shape (not `{success, data, error}` — OmniPlug doesn't use envelopes)
- New migrations: append-only, numbered, idempotent (`INSERT OR IGNORE` / `json_set` guards / `WHERE NOT EXISTS`)
- Commit messages explain the WHY in the body, not just WHAT
- Build stamp `ADMIN_BUILD` constant in `shell.js` — bump on every functional admin UI change

## Don'ts

- Don't add a feature flag for cosmetic changes
- Don't suppress test failures
- Don't widen permission scope on existing routes
- Don't introduce a new abstraction for a single use case
- Don't push to main without test green
- Don't enable Cloudflare orange-cloud proxy on `api.*` without SSL mode = Full (strict)
- Don't deploy with `LEMONSQUEEZY_TEST_MODE=true`
- Don't ship `keys/op-license-rsa.priv.pem` in any commit or zip
