# 00 — System Snapshot

> Captured 2026-05-25 against `claude/awesome-ptolemy-8phkw` @ `187c50e` (v0.5.0).

## Product Identity

| Item | Value |
|---|---|
| Product name | Quoted |
| Current version | 0.5.0 |
| Product purpose | WordPress plugin + backend that makes a customer's WP site AI-readable (llms.txt, clean Markdown, bot crawl tracking, citation tracking) and sells subscription plans (Pro / Agency) via Lemon Squeezy |
| Target user | SMB / agency WordPress operators who want to be cited by ChatGPT / Claude / Perplexity / Google AI Search |
| Current state | **Local-ready** — admin UI, marketing site (hero + 6 promo cards), and the full commercial layer (checkout + webhook + license) all work end-to-end in `LEMONSQUEEZY_TEST_MODE`. Production needs operator action (domain + real LS credentials + admin password rotate). |

## Tech Stack

| Layer | Technology | Status | Notes |
|---|---|---|---|
| Front-end (marketing) | Static HTML + small JS hydration (`frontend/assets/cms.js`) | Working | Hero + 6 promo cards CMS-driven; rest static |
| Back-end | Node 22 + Express, ES modules, OmniPlug CMS Core v1.4.4 vendored | Working | `backend/omniplug/src/backend/server.js` |
| Database | SQLite (better-sqlite3) + Litestream for backup | Working | `data/cms.db`, migrations 001-039 idempotent |
| CMS / Admin | OmniPlug admin SPA (`/admin/`) — rewired in M2 to call real APIs | Working | Pages + Sections + Site Settings save; Users/Tenants/Audit/License/Leads/Media read-only |
| Media | OmniPlug `/api/admin/media` upload API + `/uploads/*` static serve | Partial | Backend works; admin UI is read-only listing (write UI deferred M6) |
| Auth | JWT (HS256), bcrypt, rate-limited, audited | Working | `requireAuth` + `resolveTenantFromAuth` |
| Payment | Lemon Squeezy adapter, hosted-checkout proxy | Working in sandbox | `FEATURE_LIVE_PAYMENT=false` lock; 15/15 commercial tests pass |
| Webhook | HMAC-verified, idempotent, raw-body parser, audit-logged | Working | `POST /api/payments/webhook/lemon-squeezy` handles 6 events |
| Vendor APIs | LS License API via internal adapter | Working in sandbox | No vendor keys leak to front-end |

## Working Flows

| Flow | Status | Evidence |
|---|---|---|
| Front-end starts | **Pass** | `npm run dev` → `:5500` returns 200; `curl /` 200 OK |
| Back-end starts | **Pass** | `curl /api/health` → `{"status":"ok","version":"1.4.4"}` |
| Database connects | **Pass** | Schema verifier in `npm run check` passes |
| Admin login | **Pass** | `POST /api/auth/login` with `admin@omniplug.local` returns JWT |
| CMS save (Pages → Sections) | **Pass** | M2 live PATCH verified: payload edit reflected in public API <100ms |
| CMS save (Site Settings) | **Pass** | M2 live PUT verified |
| Media upload (backend API) | **Pass** | `POST /api/admin/media` accepts multipart; tested via curl |
| Media upload (admin UI button) | **Not implemented** | Admin UI shows list only with banner "write UI lands in M6" |
| API health | **Pass** | `/api/health` returns 200 with version |
| Build (`npm test`) | **Pass** | 19/19 — SQL lint, schema verify, 18 OmniPlug smoke, 6 CMS-frontend, 15 commercial, 25 PHP plugin, 4 SDK |

## Do-Not-Break List

1. The 19/19 test suite must stay green on every change (`npm test`).
2. The `page_sections` schema (tenant-scoped, `payload_json` flex) — used by hero + programs binding.
3. The Lemon Squeezy webhook signature verification + idempotency check — security-critical for billing.
4. The license JWT verification flow (license activation → plugin JWT mint).
5. The CORS allow-list — adding wrong origin opens admin to CSRF; removing :5500 breaks CMS hydration in dev.

## Main Risks

| Risk | Severity | Why It Matters |
|---|---|---|
| Operator deploys with `LEMONSQUEEZY_TEST_MODE=true` | P0 | License API returns synthetic success → real customer pays but no license issued |
| Operator forgets to update tenant 1 `domain` to production hostname | P1 | `resolveTenantFromHost` strict mode → 404 on prod marketing site |
| Operator skips admin password rotation from `ChangeMe123!` | P0 | Whole CMS publicly hijackable |
| Operator changes `LEMONSQUEEZY_WEBHOOK_SECRET` without updating LS dashboard | P1 | All future webhooks fail signature → no license / entitlement updates |
| Browser cache pins old admin JS after deploy | P2 | Mitigated in M2.1 with `Cache-Control: no-cache` + visible build stamp |
| FAQ / Docs / Changelog / Nav admin UI not implemented | P2 — by design | CEO can't yet edit those without developer; documented in CEO guide as M3 |
