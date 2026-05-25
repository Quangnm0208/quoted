# 11 — Local Full Product Test Report

> Generated 2026-05-25 against `claude/awesome-ptolemy-8phkw` @ `bf06dd6` (v0.5.0).
> Re-run with `npm test` from repo root.

## Automated suite — 19/19 pass

| Suite | Tests | Status | File / Command |
|---|---|---|---|
| SQL pattern lint | static check | ✅ | `backend/omniplug/scripts/check-sql-patterns.mjs` |
| Schema verifier | column drift | ✅ | `backend/omniplug/scripts/verify-schema.js` |
| OmniPlug smoke | 18 | ✅ | `backend/omniplug/scripts/smoke.js` |
| OmniPlug regression — fix-4, 5679, 10, 11, 16, 17-18, 21b, login-isolation | 8 files | ✅ | `backend/omniplug/tests/test-fix-*.mjs` |
| Quoted CMS frontend (T-CMS-FE-1..6) | 6 | ✅ | `backend/omniplug/tests/quoted-test-cms-frontend.mjs` |
| Quoted commercial — payments checkout (T-PAY-1..3) | 3 | ✅ | `quoted-test-payments-checkout.mjs` |
| Quoted commercial — payments webhook (T-PAY-4..9) | 6 | ✅ | `quoted-test-payments-webhook.mjs` |
| Quoted commercial — licenses activation (T-LIC-1..5) | 5 | ✅ | `quoted-test-licenses-activation.mjs` |
| Quoted commercial — E2E purchase to activation (T-E2E-1) | 1 | ✅ | `quoted-test-e2e-purchase-to-activation.mjs` |
| Quoted regression snapshot | 7 (4 pass + 2 skip + 1 conditional pass) | ✅ | `quoted-test-regression-snapshot.mjs` |
| WP plugin PHP unit | 25 | ✅ | `wp-plugin/tests/test-license-activation.php` |
| WP plugin PHP lint | 3 files | ✅ | inline in test-all.sh |
| SDK smoke | 4 | ✅ | `sdk/js-client/test/smoke.test.mjs` |

**Total: 19 suites, 0 failures.**

## Manual E2E flows — verified this session

| Flow | Status | Evidence |
|---|---|---|
| Front-end starts | ✅ | `curl :5500/` → 200; all 7 HTML files serve |
| Back-end starts | ✅ | `curl :4000/api/health` → `{"status":"ok","version":"1.4.4"}` |
| Database connects | ✅ | Schema verifier passes; `data/cms.db` writable |
| Admin login | ✅ | `POST /api/auth/login` returns 219-char JWT with `role=admin, tenant_id=1` |
| Admin renderer simulator | ✅ | `/tmp/admin-render-test.mjs`: 13/13 pages render real API data, zero mock strings |
| CMS section edit/save | ✅ | `PATCH /api/admin/pages/sections/5` with edited payload → 200, public API reflects immediately |
| CMS section render on website | ✅ | `curl :5500/index.html` shows `data-cms` attrs; hydration helper served at `:5500/assets/cms.js` |
| Site config edit/save | ✅ | `PUT /api/admin/site/contact.address` → 200; readback shows new value |
| CORS allow on dev frontend | ✅ | `Access-Control-Allow-Origin: http://127.0.0.1:5500` on `/api/public/pages/*` |
| Cache header on public API | ✅ | `Cache-Control: public, max-age=60, stale-while-revalidate=300` |
| Cache header on admin assets | ✅ | `Cache-Control: no-cache, must-revalidate` |
| Build stamp visible | ✅ | Sidebar footer fetches `/api/health` and renders `v1.4.4 · admin build M2.1` |
| Audit log captures edits | ✅ | `page.section.update` + `site.config.update` + `auth.login.success` entries appear with real timestamps |

## Manual E2E flows — NOT verified (deferred features)

| Flow | Status | Reason |
|---|---|---|
| Media upload via admin UI button | ⏳ | Admin UI is read-only (M6); API works via curl |
| Media attach to section + render publicly | ⏳ | No `data-cms-src` consumer wired in index.html yet (M6) |
| Pricing edit via CMS | ⏳ | Pricing display still static on home (M3); pricing data is env-driven |
| FAQ edit/render | ⏳ | No FAQ model yet (M3) |
| Docs edit/render | ⏳ | docs.html static; articles module exists but not wired (M4) |
| Changelog edit/render | ⏳ | No changelog model yet (M4) |
| Payment sandbox in browser (full purchase) | ⏳ | Requires real LS account; tested at API level (T-PAY-*) |
| Webhook from real LS to local | ⏳ | Requires ngrok tunnel; idempotency + signature verified at unit level (T-PAY-4..9) |

## Build verification

```bash
# Fresh extract from ZIP
unzip quoted-v0.5.0-source.zip -d /tmp/verify && cd /tmp/verify
npm run bootstrap   # ✅ ~2 min, exits 0
npm test            # ✅ 19/19 pass
```

Performed this session against `quoted-v0.5.0-source.zip` — recorded in `13_PACKAGE_REPORT.md`.

## P0/P1 bugs at time of report

**None.** All 3 P1 bugs found this session (CORS missing dev origin, `LEMONSQUEEZY_TEST_MODE` default wrong, `pages.html` data-page wrong) are fixed and retest-green. See `12_BUG_LOG.md`.
