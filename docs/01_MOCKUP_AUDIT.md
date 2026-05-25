# 01 — Mockup and Old-Domain Audit

> Captured during M2 + M2.1 in this session. All items below are either resolved (most) or explicitly classified.

## Findings — pre-cleanup state

| File | Term / Issue | Current Usage | Risk | Action | Status |
|---|---|---|---|---|---|
| `backend/omniplug/src/cms/admin/assets/page-content.js` (old) | Vinhomes real-estate demo arrays + 0 fetch calls | Every admin page rendered hardcoded mock | P1 | **REPLACED** with API-backed renderers (M2 commit `8dc83e7`) | ✅ |
| `backend/omniplug/src/cms/admin/assets/shell.js` line 124 | `email \|\| 'admin@vinhomes.vn'` fallback | Sidebar showed Vinhomes email when user.email missing | P2 | **REPLACED** with `'admin'` fallback (M2.1 `6a4cb96`) | ✅ |
| `backend/omniplug/src/cms/admin/assets/shell.js` line 153 | `<div class="brand-sub">vinhomes.vn</div>` hardcoded | Sidebar brand sub always said "vinhomes.vn" | P2 | **REPLACED** — now resolves from `/api/admin/tenants` (real tenant domain) | ✅ |
| `backend/omniplug/src/cms/admin/login.html` | `placeholder="admin@vinhomes.vn"` | Login form hint | P3 | **REPLACED** with `admin@quoted.local` | ✅ |
| `backend/omniplug/src/cms/admin/pages.html` | `data-page="sections"` (wrong) | Pages link fell through to dashboard renderer | P1 | **FIXED** to `data-page="pages"` + new sidebar link | ✅ |
| `backend/omniplug/.env.example` | `LEMONSQUEEZY_TEST_MODE=false` + empty checkout URLs | Contradicted README's "test mode by default" promise; broke 3 tests on fresh bootstrap | P1 | **FIXED** to `true` + placeholder URLs (M1 commit) | ✅ |
| `backend/omniplug/.env.example` | `CORS_ORIGIN` missing `:5500` | CMS hydration blocked from dev marketing site | P1 | **FIXED** to include `:5500` + `127.0.0.1` variants | ✅ |
| Marketing site copy in `index.html` (hero) | Hardcoded — no CMS connection | CEO could not edit without developer | P1 — by original brief | **WIRED** to `/api/public/pages/quoted_home` via `cms.js` (M1) | ✅ |
| 6 promotion cards in `index.html` | Hardcoded text + URLs | CEO could not edit | P2 | **WIRED** via `programs.items.N.field` binding + migration 039 (M2) | ✅ |
| `backend/omniplug/src/industries/real-estate.js` (+ `spa.js`, `aesthetics.js`, `branding.js`, `professional.js`, `_base.js`, `registry.js`) | OmniPlug vertical-industry presets | Bundled with vendored OmniPlug CMS Core — Quoted does NOT reference these | None — library code, not user-facing | **DOCUMENTED AS KEPT** — see "Vendored OmniPlug industry presets" below | ✅ |

## Required Cleanup — summary

| Area | Current Problem | Production Fix | Done? |
|---|---|---|---|
| Admin UI rendering | All Vinhomes demo arrays | Async renderers calling real `/api/admin/*` | ✅ M2 |
| Admin UI brand/footer | `vinhomes.vn` everywhere | Resolved from tenant domain + build stamp | ✅ M2.1 |
| Cache strategy | No `Cache-Control` on `/admin/*` → stale JS | `no-cache, must-revalidate` + visible build stamp | ✅ M2.1 |
| Marketing hero | Static-only | CMS-editable via `page_sections` | ✅ M1 |
| Marketing promo cards | Static-only | CMS-editable via items[] | ✅ M2 |
| Default env (LS test mode) | Contradicted README contract | Test mode default + placeholder URLs | ✅ M1 |
| CORS for dev | Blocked CMS hydration | Added :5500 / 127.0.0.1 variants | ✅ M1 |
| Remaining marketing sections (the_shift, how_it_works, live_demo, product, pricing cards, FAQ, final_cta) | Static-only | CMS-editable | ⏳ M3 |
| Media upload UI in admin | Read-only listing | Upload form with progress + preview + alt edit | ⏳ M6 |
| FAQ / Docs / Changelog editors in admin | Not implemented | Dedicated admin modules backed by new models | ⏳ M3-M4 |

## Vendored OmniPlug industry presets — why they stay

`backend/omniplug/src/industries/` contains `_base.js`, `aesthetics.js`, `branding.js`, `professional.js`, `real-estate.js`, `registry.js`, `spa.js`. These are **OmniPlug's intended multi-industry preset feature** — not real-estate residue from a wrong-domain CMS.

- They are vendored from OmniPlug CMS Core v1.4.4 alongside everything else.
- Zero Quoted code (`frontend/`, `wp-plugin/`, `backend/omniplug/src/backend/modules/plugin-runtime/`, `commerce/`) references them.
- Deleting any of them would diverge from upstream OmniPlug, complicating future merges.
- They do NOT appear in any production route, admin UI, public response, or user-facing string in Quoted.

**Classification: KEEP AS NON-USER-FACING LIBRARY CODE.** Documented here so the next reviewer doesn't flag them.

## Production-route mock audit

| Production route | Mock found? | Action |
|---|---|---|
| `GET /api/health` | No | — |
| `GET /api/public/pages/:pageKey` | No — real DB read | — |
| `GET /api/public/sections/*`, `articles/*`, `site/*`, `leads/*` | No | — |
| `POST /api/auth/login` | No | — |
| `GET/POST/PATCH /api/admin/pages/*` | No | — |
| `GET/PUT /api/admin/site/*` | No | — |
| `POST /api/payments/checkout` | Synthetic provider only when `LEMONSQUEEZY_TEST_MODE=true` (guarded for sandbox) | Production must set false |
| `POST /api/payments/webhook/lemon-squeezy` | Real HMAC verify against raw body | — |
| `POST /api/v1/licenses/activate` | Synthetic provider only when `LEMONSQUEEZY_TEST_MODE=true` | Production must set false |
| `POST /api/v1/wp-sites/register` | No | — |

**Result: production routes carry zero mock behaviour.** Test-mode behaviour is gated behind a documented env flag with an explicit "PRODUCTION MUST NOT SET THIS" comment in `.env.example`.
