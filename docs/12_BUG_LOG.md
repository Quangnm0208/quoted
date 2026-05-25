# 12 — Bug Log

> Bugs found and fixed during the v0.4.0 → v0.5.0 work in this session.
> All fixed, all retest-green, all recorded with reproduction.

## Summary table

| Bug ID | Severity | Area | Status | Root Cause | Fix Commit | Retest |
|---|---|---|---|---|---|---|
| BUG-001 | P1 | Env | Fixed | `LEMONSQUEEZY_TEST_MODE=false` in `.env.example` contradicted README contract | `c219a62` | ✅ 19/19 |
| BUG-002 | P1 | Env | Fixed | Empty `LEMONSQUEEZY_CHECKOUT_*` URLs broke SDK + checkout suites on fresh bootstrap | `c219a62` | ✅ T-PAY + SDK smoke pass |
| BUG-003 | P1 | CORS | Fixed | `CORS_ORIGIN` missing `:5500` blocked CMS hydration from dev frontend | `c219a62` | ✅ curl with `Origin: http://127.0.0.1:5500` returns ACAO header |
| BUG-004 | P1 | Admin UI | Fixed | `page-content.js` was 505 LoC of hardcoded Vinhomes mock with 0 fetch calls — all admin pages rendered fake data | `8dc83e7` | ✅ admin renderer simulator 13/13 with zero mock strings |
| BUG-005 | P1 | Admin UI | Fixed | `pages.html` had `data-page="sections"` (wrong); `renderPage` had no `pages:` case → Pages link fell through to dashboard | `8dc83e7` | ✅ `/admin/pages.html` now renders the Pages module |
| BUG-006 | P2 | Admin UI | Fixed | Sidebar brand sub hardcoded `vinhomes.vn`; email fallback `admin@vinhomes.vn`; role label hardcoded `'Pro'` for admin | `6a4cb96` | ✅ grep shows zero `vinhomes` in user-facing code; brand sub resolves from `/api/admin/tenants` |
| BUG-007 | P2 | Cache | Fixed | `/admin/*` static had no `Cache-Control` → browsers cached ESM modules aggressively; new admin UI invisible until manual hard-refresh | `6a4cb96` | ✅ curl `-D -` shows `Cache-Control: no-cache, must-revalidate` |
| BUG-008 | P3 | Copy | Fixed | Login form placeholder still said `admin@vinhomes.vn` | `6a4cb96` | ✅ now `admin@quoted.local` |

## Bug details

---

### BUG-001 — LEMONSQUEEZY_TEST_MODE default contradicts README contract

- **Severity:** P1
- **Area:** Env / bootstrap
- **Environment:** Fresh clone, fresh bootstrap
- **File:** `backend/omniplug/.env.example` line 84 (pre-fix)
- **Reproduction:**
  1. `git clone` fresh
  2. `npm run bootstrap` (copies `.env.example` → `.env`)
  3. `npm test`
- **Expected:** 19/19 pass per README claim "default `.env` ships in `LEMONSQUEEZY_TEST_MODE=true`"
- **Actual:** 3 fails — `payments-checkout`, `regression-snapshot`, SDK `smoke` — because real LS call attempted with no credentials
- **Root cause:** `.env.example` had `LEMONSQUEEZY_TEST_MODE=false`. Whoever flipped it didn't update README.
- **Fix:** Restore to `true` + add comment "PRODUCTION MUST NOT SET THIS"
- **Retest:** `npm test` → 19/19 pass
- **Status:** ✅ Resolved in `c219a62`

---

### BUG-002 — Empty LEMONSQUEEZY_CHECKOUT_* URLs

- **Severity:** P1
- **Area:** Env / commercial layer
- **File:** `backend/omniplug/.env.example` lines 95-98 (pre-fix)
- **Reproduction:** same as BUG-001
- **Expected:** SDK smoke + checkout tests pass in test mode
- **Actual:** `QuotedError: Plan "pro-monthly" has no hosted checkout URL configured`
- **Root cause:** `.env.example` had empty values; tests need URL strings even in test mode
- **Fix:** Added placeholder hosted-checkout URLs (`https://example.lemonsqueezy.com/buy/test-*`)
- **Retest:** `npm test` → SDK smoke pass + checkout tests pass
- **Status:** ✅ Resolved in `c219a62`

---

### BUG-003 — CORS missing dev frontend port

- **Severity:** P1
- **Area:** CORS
- **File:** `backend/omniplug/.env.example` `CORS_ORIGIN` line
- **Reproduction:**
  1. Start `npm run dev`
  2. Open `http://127.0.0.1:5500/` in browser
  3. Open DevTools → Network
  4. Reload
- **Expected:** Hydration fetch to `:4000/api/public/pages/quoted_home` succeeds with ACAO header
- **Actual:** Would have been CORS-blocked (before hydration even introduced)
- **Root cause:** `CORS_ORIGIN` listed `:3000, :5173, :4000` only — no `:5500`
- **Fix:** Added `http://localhost:5500,http://127.0.0.1:5500,http://127.0.0.1:4000` to the env example
- **Retest:** `curl -H "Origin: http://127.0.0.1:5500" /api/public/pages/quoted_home -D -` → `Access-Control-Allow-Origin: http://127.0.0.1:5500`
- **Status:** ✅ Resolved in `c219a62`

---

### BUG-004 — Admin UI was a Vinhomes mockup (505 LoC, 0 fetch calls)

- **Severity:** P1
- **Area:** Admin UI
- **File:** `backend/omniplug/src/cms/admin/assets/page-content.js` (entire file pre-fix)
- **Reproduction:**
  1. Login to `/admin/`
  2. Click Users / Tenants / Sections / Site / Audit / License
  3. Observe data
- **Expected:** Real DB data (current admin email, real audit entries, etc.)
- **Actual:** Hardcoded "Đỗ Minh Thu", "vinhomes.vn", "1800 6868" — every page showed same fake data regardless of DB state. Save buttons did nothing.
- **Root cause:** Original UI shipped as a static HTML mockup; renderers had hardcoded arrays and zero `fetch()` calls
- **Fix:** Full rewrite to async renderers calling real `/api/admin/*`. New `page-content-handlers.js` for Save → PATCH/PUT. `page-init.js` made async.
- **Retest:** `/tmp/admin-render-test.mjs` (renderer simulator): 13/13 pages render with real data + zero MOCK_BANNED strings (`vinhomes`, `1800 6868`, `Sống tại nơi`, etc.)
- **Status:** ✅ Resolved in `8dc83e7`

---

### BUG-005 — Pages link broke (data-page mismatch + missing renderer)

- **Severity:** P1
- **Area:** Admin routing
- **Files:** `backend/omniplug/src/cms/admin/pages.html` + `assets/page-content.js`
- **Reproduction:**
  1. Login to `/admin/`
  2. Sidebar → click Pages (the link existed but to the wrong location)
- **Expected:** Pages editor shows
- **Actual:** Dashboard rendered (fallthrough)
- **Root cause:**
  - `pages.html` had `<body data-page="sections">` (typo from copy-paste of sections.html)
  - `renderPage` switch had no `pages:` case → fell to default `renderDashboard`
  - Sidebar nav didn't even include a "Pages" entry
- **Fix:**
  - Set `pages.html` → `data-page="pages"`
  - Added `renderPagesAdmin` function calling `/api/admin/pages`
  - Added sidebar nav item "Pages" in `shell.js`
- **Retest:** `curl /admin/pages.html | grep "<body"` → `data-page="pages"`; renderer simulator includes `pages` page rendering 16KB of real section data
- **Status:** ✅ Resolved in `8dc83e7`

---

### BUG-006 — Sidebar brand always said "vinhomes.vn"

- **Severity:** P2
- **Area:** Admin shell
- **File:** `backend/omniplug/src/cms/admin/assets/shell.js`
- **Reproduction:** Login to admin; look at sidebar top-left brand block
- **Expected:** Shows the current tenant's domain
- **Actual:** Always showed `vinhomes.vn` (hardcoded) even for `admin@omniplug.local`
- **Root cause:** Three hardcoded strings in `renderShell`:
  - Line 124: `user.email || 'admin@vinhomes.vn'`
  - Line 153: `<div class="brand-sub">vinhomes.vn</div>`
  - Line 126: `'Pro'` for admin role
- **Fix:** Brand sub now resolves from `/api/admin/tenants` (current tenant.domain). Email fallback → `'admin'`. Role label uses actual role.
- **Retest:** `grep -c "vinhomes" backend/omniplug/src/cms/admin/assets/shell.js` → `0`
- **Status:** ✅ Resolved in `6a4cb96`

---

### BUG-007 — Admin ESM modules cached in browser, deploys invisible

- **Severity:** P2 (P1 in CEO perception — looks like deploy didn't happen)
- **Area:** Cache strategy
- **File:** `backend/omniplug/src/backend/server.js` line 216 (static admin mount)
- **Reproduction:**
  1. Deploy new admin JS
  2. CEO refreshes admin page (regular F5)
- **Expected:** New JS runs
- **Actual:** Browser used cached ESM module from earlier session → admin UI looked unchanged
- **Root cause:** Express `static` mount for `/admin/` set no `Cache-Control` header → browsers cached ESM modules aggressively by URL
- **Fix:** Set `Cache-Control: no-cache, must-revalidate` on `/admin/*` static serve. Also added a visible "build stamp" (`v1.4.4 · admin build M2.1`) in sidebar footer fetched from `/api/health` so the operator can confirm at a glance.
- **Retest:** `curl -D - /admin/assets/page-content.js | grep Cache-Control` → `Cache-Control: no-cache, must-revalidate`
- **Status:** ✅ Resolved in `6a4cb96`

---

### BUG-008 — Login form placeholder said `admin@vinhomes.vn`

- **Severity:** P3
- **Area:** Copy
- **File:** `backend/omniplug/src/cms/admin/login.html` line 22
- **Reproduction:** Open `/admin/login.html`; look at email field placeholder
- **Expected:** `admin@<your-domain>` or generic
- **Actual:** `admin@vinhomes.vn`
- **Fix:** Changed to `admin@quoted.local`
- **Status:** ✅ Resolved in `6a4cb96`

## Bugs deferred / not in scope for v0.5.0

| Description | Why deferred | Roadmap |
|---|---|---|
| Admin UI for FAQ/Docs/Changelog write | Models don't exist yet | M3-M4 |
| Media upload UI button | Admin shows read-only with banner; API works | M6 |
| Admin UI for Users/Tenants/License write | API supports; UI is M7 | M7 |
| Section-level preview link in admin | Hard-refresh of `/` works as preview | nice-to-have |
| Multi-locale CMS support | Sections are single-locale | future |
