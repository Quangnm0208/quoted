# AUDIT REPORT — Quoted SaaS Admin v0.6.0

> Conducted 2026-05-25 against `claude/awesome-ptolemy-8phkw` @ `0d885e5`.
> Test method: ephemeral DB fixtures + assertions + cleanup.
> Result: **0 P0 / 0 P1 / 0 P2 bugs found.**

## Phase-by-phase results

### Phase 1 — Cold start
| Step | Result |
|---|---|
| Fresh ZIP extract | ✅ 983 KB / 500 files |
| `npm run bootstrap` (fresh) | ✅ install + migrate clean |
| `npm test` cold-start | ✅ 19/19 pass |
| `npm run dev` | ✅ BE :4000 + FE :5500 |
| `/api/health` | ✅ 200 `{"status":"ok","version":"1.4.4"}` |
| `/admin/quoted-dashboard.html` | ✅ 200 (data-page attribute correct) |

### Phase 2 — Backend API audit

All 10 endpoints under `/api/admin/quoted/*`:

| Endpoint | Method | Auth Required | Empty DB | Seeded DB | Status | Notes |
|---|---|---|---|---|---|---|
| `/dashboard` | GET | ✅ 401 w/o token | ✅ all-zero KPIs | ✅ MRR/ARR/Rev correct | ✅ | KPI fields numeric |
| `/customers` | GET | ✅ 401 w/o token | ✅ `{rows:[]}` | ✅ shows alice+bob | ✅ | |
| `/subscriptions` | GET | ✅ 401 w/o token | ✅ `{rows:[], by_status:[]}` | ✅ + status breakdown | ✅ | |
| `/licenses` | GET | ✅ 401 w/o token | ✅ `{rows:[]}` | ✅ joined sub info | ✅ | |
| `/wp-sites` | GET | ✅ 401 w/o token | ✅ `{rows:[], active:0}` | ✅ + post + crawls 7d | ✅ | |
| `/orders` | GET | ✅ 401 w/o token | ✅ `{rows:[], total_revenue_cents:0}` | ✅ sum correct | ✅ | |
| `/bot-crawls` | GET | ✅ 401 w/o token | ✅ `{by_bot:[], by_day:[], top_sites:[]}` | ✅ all 3 aggregates | ✅ | intentional aggregate shape, not `rows[]` |
| `/posts` | GET | ✅ 401 w/o token | ✅ `{rows:[]}` | ✅ site_domain join | ✅ | |
| `/citations` | GET | ✅ 401 w/o token | ✅ `{rows:[]}` | ✅ Phase-2 ready | ✅ | |
| `/webhook-events` | GET | ✅ 401 w/o token | ✅ `{rows:[], failures:0}` | ✅ failure count | ✅ | |

**Edge cases tested:**
- `?limit=99999` → clamped to 500 (no crash)
- `?limit=-1` → clamped to 1
- `?limit=abc` → defaults to 50
- `?offset=-99` → clamped to 0
- `?days=999` → clamped to 90
- `?days=0` → defaults to 1
- `?days=abc` → defaults to 7

All edge cases return 200 with reasonable values. No 5xx crash.

**Secret leak scan:** 5 secret markers (`LEMONSQUEEZY_API_KEY`, `JWT_SECRET`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `eyJ0eXAi`, `whsec_`) scanned across all 10 endpoint responses → 0 leaks.

### Phase 3 — Admin UI render

Renderer simulator (`/tmp/admin-render-test-m3.mjs`) ran each page through the production `page-content.js::renderPage()` against the live backend:

| Page | Empty DB chars | Seeded DB chars | Status |
|---|---:|---:|---|
| `dashboard` (OmniPlug generic) | 3228 | 3228 | ✅ |
| `quoteddashboard` (Quoted SaaS KPIs) | 4257 | 4407 | ✅ KPIs update |
| `pages` | 16267 | 16267 | ✅ |
| `sections` | 15063 | 15063 | ✅ |
| `site` | 27135 | 27135 | ✅ |
| `users` | 5697 | 6151 | ✅ |
| `tenants` | 1019 | 1019 | ✅ |
| `audit` | 36542 | 36457 | ✅ varies with log volume |
| `license` | 1674 | 1674 | ✅ |
| `leads` | 5123 | 5497 | ✅ |
| `media` | 606 | 606 | ✅ empty handled |
| `articles` | 560 | 560 | ✅ |
| `projects` | 577 | 577 | ✅ |
| `articleEdit` | 477 | 477 | ✅ stub |
| `customers` | 612 | **1731** | ✅ data appears |
| `subscriptions` | 673 | **2277** | ✅ data appears |
| `wpsites` | 722 | **2122** | ✅ data appears |
| `botcrawls` | 737 | **1905** | ✅ data appears |
| `posts` | 644 | **1711** | ✅ data appears |

**Mock-data scan** across all 19 rendered pages: zero hits on `vinhomes`, `Sống tại nơi`, `1800 6868`, `cskh@vinhomes`. The "Vinhomes demo" mockups previously embedded in `page-content.js` (M1) are entirely gone.

**Content extraction verification** (does the seeded data actually appear in HTML, not just inflate char count?):
- `customers`: HTML contains `alice@acme.test`, `bob@brooklyn.test`, `Alice Smith`, `pro-monthly`, `pro-yearly` ✅
- `wpsites`: HTML contains `acme-coffee.com`, `brooklyn-cafe.com`, `>3<`, `>2<`, `>1<` (counts) ✅
- `botcrawls`: HTML contains `GPTBot`, `ClaudeBot`, `PerplexityBot`, both domains ✅
- `quoteddashboard`: HTML contains `$34.83` (MRR), `$417.96` (ARR), `$209.00` (Revenue) ✅

### Phase 4 — Database & data integrity

| Check | Result |
|---|---|
| Tables present | ✅ customers, subscriptions, orders, customer_licenses, entitlements, wp_sites, bot_crawls, quoted_posts, citations, webhook_events |
| FK `customers.id ← subscriptions.customer_id` | ✅ exists |
| FK `subscriptions.id ← customer_licenses.subscription_id` | ✅ exists |
| FK `wp_sites.customer_id ← customers.id` | ✅ exists |
| FK `wp_sites.id ← bot_crawls.wp_site_id` | ✅ exists |
| FK `wp_sites.id ← quoted_posts.wp_site_id` | ✅ exists |
| Tenant scoping on `wp_sites`, `bot_crawls`, `quoted_posts`, `citations` | ✅ `WHERE tenant_id = 1` in every admin query |
| `amount_cents` (not float) | ✅ orders.amount_cents INTEGER |
| Plan IDs match business | ✅ `pro-monthly`, `pro-yearly`, `agency-monthly`, `agency-yearly` |
| Status enums consistent | ✅ subscriptions: active/cancelled/expired/paused; orders: paid/refunded; licenses: active/inactive |
| Active subscription logic | ✅ `WHERE status = 'active'` (verified — cancelled sub doesn't count in MRR/active total) |
| `wp_sites.is_active = 1` drives active count | ✅ verified |
| Bot crawl 7d window | ✅ `datetime(crawled_at) >= datetime('now','-7 days')` |
| Citations 7d window | ✅ `datetime(first_seen_at) >= datetime('now','-7 days')` |

### Phase 5 — Business logic (MRR/ARR)

Critical test from CTO notes — yearly subscriptions must NOT count their raw price as MRR.

**Fixture:** 1 `pro-monthly` active + 1 `pro-yearly` active + 1 `agency-monthly` cancelled.

| Metric | Expected | Got | ✓ |
|---|---|---|---|
| MRR cents | `1900 + (19000 / 12 = 1583) = 3483` | `3483` | ✅ |
| ARR cents | `3483 × 12 = 41796` | `41796` | ✅ |
| Total revenue cents (paid orders only) | `1900 + 19000 = 20900` | `20900` | ✅ |
| Active subscriptions count | `2` (cancelled excluded) | `2` | ✅ |

**Code reference:** `backend/omniplug/src/backend/modules/plugin-runtime/quoted-admin/quoted-admin.controller.js::renderDashboard()`:

```js
const monthly = s.plan_id.endsWith('-yearly') ? Math.round(price / 12) : price;
mrrCents += monthly * s.c;
```

This is SaaS-standard MRR normalization. ✅ correct per CTO note.

### Phase 6 — Lemon Squeezy webhook readiness

**Webhook signature:**
- ✅ Empty secret in `.env` → fail-closed reject all webhooks (intended security default)
- ✅ Valid HMAC SHA-256 with `X-Signature` header → 200
- ✅ Bad signature → 401 `{error: {code: "BAD_SIGNATURE"}}`
- ✅ HMAC computed against raw body (not parsed JSON) — verified via `app.use('/api/payments/webhook', express.raw(...))` in `server.js:210`

**Webhook idempotency:**
- Fixture: send same event_id twice with valid signature
- Both deliveries return 200
- `webhook_events` table has EXACTLY 1 row (dedupe key = `lemon-squeezy:<webhook_id>`)
- Customer created EXACTLY once (count of `audit-idem@test.local` = 1)
- Order created EXACTLY once (count of `lemon_order_id='500001'` = 1)
- ✅ verified

**Webhook event coverage:** 6 events handled by `ls.webhook.handler.js`:
- `order_created` → creates customer + order
- `subscription_created` → creates subscription + entitlement
- `subscription_cancelled` → disables entitlement
- `subscription_expired` → disables entitlement
- `subscription_resumed` → re-enables entitlement
- `license_key_created` → creates license + entitlement

Other LS events return 200 + are logged but not processed (intentional — no business action required).

### Phase 7 — WordPress plugin data flow readiness

| Flow | Endpoint | Tested | Status |
|---|---|---|---|
| Plugin registers site | `POST /api/v1/wp-sites/register` | npm test smoke | ✅ |
| Plugin syncs posts | `POST /api/v1/wp-sites/posts/sync` | npm test smoke | ✅ |
| Plugin sends bot crawls | `POST /api/v1/bot-crawls/batch` | npm test smoke | ✅ |
| License activate | `POST /api/v1/licenses/activate` | T-LIC-1..5 | ✅ |
| License validate | `POST /api/v1/licenses/validate` | T-LIC | ✅ |
| Free quota enforcement | 50-post cap via `QUOTED_FREE_POST_LIMIT` | observed in code | ✅ |

WP Sites admin UI reflects all expected fields with seeded data:
- domain ✅
- customer_email (joined) ✅
- plan ✅
- post_count (subquery) ✅
- crawls_7d (subquery filtered to 7d) ✅
- wp_version + plugin_version ✅
- last_seen_at ✅

### Phase 8 — Security review

| Area | Test | Result |
|---|---|---|
| **Auth — unauthorized access** | All 10 `/api/admin/quoted/*` w/o token | ✅ 401 each |
| **Auth — invalid JWT** | Bearer with garbage payload | ✅ 401 |
| **Auth — non-admin role** | `customer`-role user attempts login | ✅ 401 (reserved role blocked at login) |
| **Secrets in response** | Scan responses for 5 secret markers | ✅ 0 leaks across 10 endpoints |
| **`.env` committed** | `git ls-files -- backend/omniplug/.env` | ✅ not tracked |
| **Private keys committed** | `git ls-files -- '**/op-license-rsa.priv.pem'` | ✅ not tracked |
| **SQL injection — limit param** | `?limit=1; DROP TABLE customers; --` | ✅ rejected (200 with default limit) |
| **SQL injection — offset param** | `?offset=1' OR '1'='1` | ✅ rejected |
| **SQL injection — days param** | `?days=7'; SELECT * FROM users; --` | ✅ rejected |
| **Table integrity after SQLi probe** | re-query customers | ✅ table intact |
| **XSS — stored customer name** | Insert `<img src=x onerror="...">` then render admin | ✅ escaped to `&lt;img src=x onerror=&quot;...&quot;&gt;` via `shell.js::escapeHtml()` |
| **CORS for admin routes** | Admin endpoints not in `CORS_ORIGIN` allow-list | ✅ admin = same-origin only (browser blocks cross-origin) |
| **Webhook raw body** | Mount order: raw parser BEFORE JSON parser | ✅ verified `server.js:210` |
| **Rate limiting** | Login attempts | ✅ `rateLimiterIp.js` per-IP bucket |
| **Audit log records edits** | PATCH section → check audit table | ✅ `page.section.update` row written |

## Findings summary

| Severity | Count | Detail |
|---|---|---|
| P0 (blocks release) | **0** | — |
| P1 (must fix before release) | **0** | — |
| P2 (nice-to-have) | **0** | — |
| False positives during audit | 3 | bot-crawls aggregate shape (test bug); webhook 401 with empty secret (fail-closed correct); webhook 401 from audit (script forgot to skip-on-empty-secret) |

## Acceptance gate (CTO checklist from master prompt)

| Requirement | Status |
|---|---|
| Fresh install works | ✅ |
| Tests pass (19/19) | ✅ |
| Build passes | ✅ |
| Admin renders real backend data | ✅ verified per-page |
| No mock data in production path | ✅ zero hits on Vinhomes / Sống tại / 1800 6868 |
| Empty state works | ✅ all 10 endpoints + 6 SaaS UI pages |
| Seeded SaaS data works | ✅ alice/bob fixtures display correctly |
| Quoted Dashboard KPI logic correct | ✅ MRR/ARR normalized per SaaS standard |
| `/api/admin/quoted/*` endpoints stable | ✅ |
| Auth protection works | ✅ |
| Lemon Squeezy webhook simulation works | ✅ |
| WP plugin data flow structurally ready | ✅ |
| No P0/P1 bugs remain | ✅ |
| No code debt / duplicate architecture | ✅ single quoted-admin.controller.js module |
| CEO can refresh and see real SaaS data | ✅ verified via seed scenario |

## Recommendation

**RELEASE READY.** No fixes required.

Tag this commit (`0d885e5` + audit reports = next commit) as `v0.6.1` and ship.
