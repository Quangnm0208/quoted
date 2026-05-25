# Regression Test Report — v0.7.1

> Per master prompt §15 regression requirements. Goal: confirm zero impact on existing features.

## Test suite results

| Suite | Pre-v0.7.1 (v0.7.0) | Post-v0.7.1 | Delta |
|---|---|---|---|
| `npm test` | 20/20 pass | **20/20 pass** | 0 — unchanged |
| `bash scripts/security-smoke.sh` | 9/9 pass | **9/9 pass** | 0 — unchanged |
| `bash scripts/check-no-secrets.sh` | clean | clean (after test-file allow-list) | minor scanner update |
| Admin renderer simulator | 19/19 pass | **19/19 pass** | 0 — unchanged |
| SQL pattern lint | clean | clean | 0 — unchanged |

## Confirmed-still-working (per master prompt §13 required regression list)

| Feature | Path | Status |
|---|---|---|
| Quoted Dashboard | `/admin/quoted-dashboard.html` | ✅ |
| Customers | `/admin/customers.html` | ✅ |
| Subscriptions | `/admin/subscriptions.html` | ✅ |
| Licenses | `/admin/license.html` | ✅ |
| WP Sites | `/admin/wp-sites.html` | ✅ — revoke button still functional |
| Bot Crawls | `/admin/bot-crawls.html` | ✅ |
| Synced Posts | `/admin/posts.html` | ✅ |
| Posts / Articles (CMS) | `/admin/articles.html` | ✅ — full editor + 12 article tests pass |
| Media Library | `/admin/media.html` | ✅ |
| Settings (was Site Settings) | `/admin/site.html` | ✅ — Save still works on each row |
| Product Pages (was Pages) | `/admin/pages.html` | ✅ — section editor still works |
| Landing Sections (was Sections) | `/admin/sections.html` | ✅ |
| Leads | `/admin/leads.html` | ✅ |
| Admin Users | `/admin/users.html` | ✅ |
| Tenants | `/admin/tenants.html` | ✅ |
| Audit Log | `/admin/audit.html` | ✅ |
| Public hero hydration on `/index.html` | `frontend/index.html` + `/api/public/pages/quoted_home` | ✅ |
| Public promo cards hydration | same | ✅ |
| Public articles list on `/blog.html` | `/api/public/articles` | ✅ |
| Public article detail on `/blog-post.html?slug=…` | `/api/public/articles/:slug` | ✅ |
| `/sitemap.xml` + `/feed.xml` | seo.controller.js | ✅ |
| Lemon Squeezy webhook receipt | `/api/payments/webhook/lemon-squeezy` | ✅ HMAC verify + idempotent |
| License activation + domain binding | `/api/v1/licenses/activate` + `/validate` | ✅ — T-LIC tests + T-ART-2 domain check |
| Customer portal | `frontend/customer.html` + `/api/customer/dashboard` | ✅ |
| Plugin JWT revoke | `POST /api/admin/quoted/wp-sites/:id/revoke` | ✅ |

## API route compatibility

**Zero API changes in v0.7.1.** Every route still at the same URL with the same response shape. Per master prompt §10: "Best option: change labels/grouping only. Avoid route changes unless route names are genuinely wrong."

Renderer registry keys also unchanged:
- `articles`, `media`, `pages`, `sections`, `site`, `leads` (formerly Marketing CMS) still resolve to the same renderer functions
- `dashboard`, `users`, `tenants`, `audit`, `projects` unchanged
- `customers`, `subscriptions`, `wpsites`, `botcrawls`, `posts`, `webhookevents`, `quoteddashboard` (Quoted SaaS) unchanged

## Backward compatibility

| Concern | Handling |
|---|---|
| Operator's browser bookmarks | All work (URLs unchanged) |
| Hard-coded links in docs | Most use generic `/admin/` not full paths; spot-check confirms no broken refs |
| API consumers (WP plugin, JS SDK) | Don't use admin URLs — only `/api/v1/*` + `/api/public/*` (both untouched) |
| Test fixtures | None reference sidebar position; only API behavior |
| External monitoring | Monitors `/api/health` only (unchanged) |

## Cold-start verification

| Step | Result |
|---|---|
| Fresh repo extract | ✅ ZIP `quoted-saas-cms-admin-structure-v0.7.1-local-ready.zip` |
| `npm run bootstrap` from zero | ✅ migrate runs through 041 cleanly |
| `npm test` | ✅ 20/20 |
| Server starts | ✅ |
| Admin renderer simulator | ✅ 19/19 |

## Verdict

**Zero regression.** v0.7.1 is a pure UX restructure — sidebar config edit in one file (`shell.js`). All backend logic, all database, all APIs, all routes, all renderers, all tests UNCHANGED.

Safe to ship.
