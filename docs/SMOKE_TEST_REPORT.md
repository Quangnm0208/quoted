# SMOKE TEST REPORT — Quoted SaaS Admin v0.6.1

> Run date: 2026-05-25
> Branch: `claude/awesome-ptolemy-8phkw`
> Commit: `0d885e5` (M3 SaaS admin) + post-audit

## 1. Backend smoke

| Check | Result |
|---|---|
| Server starts | ✅ ~3s after `npm run dev` |
| Health check `/api/health` | ✅ 200 `{"status":"ok","version":"1.4.4"}` |
| DB connects | ✅ schema verifier passes |
| Migrations apply | ✅ 39 migrations idempotent |
| Admin auth `POST /api/auth/login` | ✅ returns JWT for `admin@omniplug.local` |
| `/api/admin/quoted/*` (10 endpoints) | ✅ all return 200 with valid JSON |
| Unauthorized 401 enforcement | ✅ all 10 endpoints reject no-token requests |
| Invalid query params | ✅ all clamped/defaulted, zero 5xx |

## 2. Frontend / Admin smoke

| Check | Result |
|---|---|
| Login page loads at `/admin/login.html` | ✅ |
| Login → dashboard redirect | ✅ |
| Sidebar renders 4 groups | ✅ Quoted Dashboard / Quoted SaaS / Marketing CMS / System |
| **Quoted Dashboard** | ✅ KPIs render real numbers |
| **Customers** | ✅ table renders (empty state OR data) |
| **Subscriptions** | ✅ table + by-status breakdown |
| **Licenses** | ✅ status panel (M3.1 will swap to customer_licenses list) |
| **WP Sites** | ✅ table with post_count + crawls_7d |
| **Bot Crawls** | ✅ 3-panel aggregate (by_bot / by_day / top_sites) |
| **Synced Posts** | ✅ table with site_domain join |
| Marketing CMS pages (Pages/Sections/Site/Media/Leads) | ✅ unchanged from M2 |
| System pages (Users/Tenants/Audit/Articles/Projects) | ✅ unchanged |
| No mock data appears in production | ✅ renderer-simulator confirms 19/19 pages have 0 Vinhomes/`1800 6868`/`Sống tại nơi` matches |
| Build stamp visible in sidebar footer | ✅ "v1.4.4 · admin build M3" |
| No fatal console errors | ✅ JSDOM render returns valid HTML for all 19 pages |

## 3. SaaS business logic smoke

Tested with synthetic fixture: 1 `pro-monthly` active + 1 `pro-yearly` active + 1 `agency-monthly` cancelled + 2 paid orders ($19 + $190).

| KPI | Expected | Got | Status |
|---|---|---|---|
| MRR | `$19.00/mo + $190.00/12 = $34.83/mo` | `$34.83/mo` | ✅ correctly normalized |
| ARR | `$34.83 × 12 = $417.96/yr` | `$417.96/yr` | ✅ |
| Total Revenue | `$19 + $190 = $209.00` | `$209.00` | ✅ |
| Active Subscriptions | 2 (cancelled excluded) | 2 | ✅ |
| Customers | 2 | 2 | ✅ |

**Empty state (no fixture):**
- All 6 SaaS pages render empty-state banners with clear "wait for first customer" messages.
- No crash, no fake fallback data, no broken layout.

## 4. Webhook flow smoke (with `LEMONSQUEEZY_WEBHOOK_SECRET` set)

| Step | Result |
|---|---|
| Valid HMAC signature → 200 | ✅ |
| Invalid signature → 401 | ✅ |
| Empty secret (default `.env`) → 401 fail-closed | ✅ correct security |
| Same event_id redelivered → idempotent | ✅ exactly 1 row in `webhook_events`, exactly 1 customer, exactly 1 order |
| `order_created` event creates customer + order | ✅ |
| Dashboard `total_revenue_cents` reflects new order | ✅ |
| Audit log shows `webhook.lemon-squeezy.received` | ✅ |

## 5. Security smoke

| Check | Result |
|---|---|
| Auth required on `/api/admin/*` (all 10 SaaS + 14 CMS) | ✅ all return 401 without JWT |
| Invalid JWT rejected | ✅ 401 |
| `customer`-role user cannot log in (reserved) | ✅ 401 |
| SQL injection on `?limit=`, `?offset=`, `?days=` | ✅ rejected, table intact |
| XSS via stored `customers.name` | ✅ entity-encoded on render (`escapeHtml`) |
| Secrets exposure scan (5 markers) | ✅ 0 hits in 10 endpoint responses |
| `.env` / private keys committed | ✅ neither tracked by git |
| Webhook raw-body before JSON parser | ✅ HMAC integrity preserved |

## 6. Cold-start ZIP smoke

Extracted `final-product-local-ready.zip` (v0.6.0, 983 KB) into a fresh `/tmp` directory and ran end-to-end:

```bash
unzip -q final-product-local-ready.zip -d /tmp/smoke
cd /tmp/smoke
npm run bootstrap       # ✅ 44 checks, exits 0
npm test                # ✅ 19/19 pass on cold start
```

## 7. Full regression

```bash
npm test
```

```
▸ Lint + verify
  SQL pattern lint                                   ✓ pass
  Schema verifier                                    ✓ pass

▸ Upstream OmniPlug
  Smoke (18 tests)                                   ✓ pass
  test-fix-10 / 11 / 16 / 17-18 / 21b / 4 / 5679 / login-isolation  ✓ pass (8 files)

▸ Quoted commercial
  quoted-test-cms-frontend.mjs                       ✓ pass  (T-CMS-FE-1..6)
  quoted-test-e2e-purchase-to-activation.mjs         ✓ pass  (T-E2E-1)
  quoted-test-licenses-activation.mjs                ✓ pass  (T-LIC-1..5)
  quoted-test-payments-checkout.mjs                  ✓ pass  (T-PAY-1..3)
  quoted-test-payments-webhook.mjs                   ✓ pass  (T-PAY-4..9)
  quoted-test-regression-snapshot.mjs                ✓ pass

▸ WP plugin (PHP)
  test-license-activation.php                        ✓ pass  (T-WP-1..7)
  lint class-quoted-admin.php / public / rest        ✓ pass  (3 files)

▸ SDK
  smoke.test.mjs                                     ✓ pass  (4 cases)

═══════════════════════════════════════════════════════════
  19 pass, 0 fail
═══════════════════════════════════════════════════════════
```

## Final verdict

**PASS — RELEASE READY.**

- Backend: ✅
- Frontend/admin: ✅
- Database/seed: ✅
- SaaS logic: ✅
- Security: ✅
- Webhook: ✅
- Cold-start ZIP: ✅
- Regression: ✅

Zero P0 / P1 / P2 bugs. Acceptance gate green across all 14 CTO checklist items.
