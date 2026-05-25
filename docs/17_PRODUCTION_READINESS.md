# 17 — Production Readiness Gate

> **The single most important file in `docs/`.** Run this checklist before flipping DNS to production.

## Final acceptance gate (v0.5.0)

Each row marked honestly — claims have an evidence column.

| Requirement | Status | Evidence |
|---|---|---|
| All mock production logic removed | ✅ | `01_MOCKUP_AUDIT.md` — all P1/P2 mocks fixed; renderer simulator 13/13 zero mock strings |
| Old wrong-domain residue cleaned | ✅ | grep `vinhomes` in user-facing code = 0 hits; `industries/real-estate.js` library kept + documented |
| Front-end sections mapped to CMS (hero + programs cards) | ✅ | `03_FRONTEND_CMS_CONTRACT.md` |
| Front-end sections mapped to CMS (the_shift, how_it_works, pricing, faq, testimonials, etc.) | ⏳ | Deferred to M3 per design doc |
| CMS admin can edit Pages + Sections + Site Settings | ✅ | M2 — live PATCH/PUT verified |
| CMS admin can edit FAQ / Docs / Changelog / Navigation / Users / Tenants / License / Media | ⏳ | Read-only with banner; M3-M7 |
| Media upload API works | ✅ | `POST /api/admin/media` multipart, verified |
| Media upload UI in admin | ⏳ | M6 |
| Media attached to section renders on front-end | ⏳ | No `data-cms-src` consumer wired; M6 |
| Pricing editable | ⏳ M3 (env-driven today) | `LEMONSQUEEZY_VARIANT_*` + `LEMONSQUEEZY_CHECKOUT_*` env vars |
| Pricing visible on front-end | ✅ partial | `/api/products/plans` works; pricing.html still static (M3 wires) |
| FAQ editable + visible | ⏳ M3 | not in v0.5.0 |
| Docs editable + visible | ⏳ M4 | `articles` table exists; not wired |
| Changelog editable + visible | ⏳ M4 | not in v0.5.0 |
| Site settings editable | ✅ | `/admin/site.html` PUT works |
| Site settings consumed on front-end | ⏳ M5 | header/footer still static |
| API contracts match front-end | ✅ | `06_API_CONTRACT.md` alignment table — all live calls match |
| Payment sandbox ready | ✅ | `08_INTEGRATIONS_*` — T-PAY-1..9 pass; `LEMONSQUEEZY_TEST_MODE=true` defaults |
| Payment provider adapter pattern | ✅ | `commerce/providers/lemon-squeezy/*.adapter.js`; vendor isolated |
| Webhooks signature-verified | ✅ | HMAC SHA-256 against raw body; T-PAY-4..9 |
| Webhooks idempotent | ✅ | `webhook_events` table dedupe; T-PAY-* covers this |
| License activation flow | ✅ | T-LIC-1..5 + T-E2E-1 |
| Local run works | ✅ | `npm run bootstrap && npm run dev` clean from fresh extract |
| Build works | ✅ | `npm test` 19/19 from fresh extract |
| Env templates complete | ✅ | `.env.example` 50+ keys with inline docs |
| Database migrations ready | ✅ | 39 migrations, idempotent, schema-verifier passes |
| Media storage documented | ✅ | `05_MEDIA_SYSTEM.md` |
| API URLs configurable (no hardcode) | ✅ | All URLs from env (`APP_URL`, `API_URL`, `CORS_ORIGIN`, `CHECKOUT_*`) |
| Live payment locked by flag | ✅ | `LEMONSQUEEZY_TEST_MODE=true` default + `.env.example` warns "PRODUCTION MUST NOT SET THIS" |
| No exposed secrets | ✅ | `.gitignore` covers `.env`, private keys; T-PAY-3 verifies no API key in checkout response |
| Domain/DNS guide ready | ✅ | `15_DOMAIN_DNS_SSL.md` + `GO_LIVE_GUIDE.md` |
| Rollback plan ready | ✅ | `16_ROLLBACK.md` |
| Audit log records every important change | ✅ | login, section edit, site config edit, webhook receive |
| Cache strategy in place | ✅ | Public sections 60s edge; admin assets `no-cache`; build stamp visible |
| Tenant isolation works | ✅ | OmniPlug v1.4.4 multi-tenant; all queries `WHERE tenant_id = ?`; M2 admin uses `tenant 1` |
| Production admin password rotation documented | ✅ | `09_ENVIRONMENT.md` + `GO_LIVE_GUIDE.md` step 9 |
| Telemetry opt-out documented | ✅ | `TELEMETRY_ENABLED=false` |
| Backup strategy (Litestream) | ✅ partial | configured in `fly.toml`; restore tested in `16_ROLLBACK.md` |
| Uptime monitoring plan | ✅ documented | `GO_LIVE_GUIDE.md` step 11.2 — UptimeRobot suggested |
| Error monitoring plan | ⏳ optional | Sentry suggested but not required for launch |
| CEO handoff docs complete | ✅ | `LAUNCH-HANDOFF.md` + `CMS-CEO-GUIDE.md` |
| Developer debugging docs complete | ✅ | `DEBUGGING.md` + `DEBUGGING_MAP.md` (this PR) + `MODULE-MAP.md` |
| AI agent handoff docs | ✅ | `AI_AGENT_HANDOFF.md` (this PR) |
| No P0 bugs | ✅ | `12_BUG_LOG.md` — zero open |
| No P1 bugs | ✅ | `12_BUG_LOG.md` — zero open |
| ZIP package created | ✅ | `13_PACKAGE_REPORT.md` |
| README quick start works | ✅ | Verified: extract → bootstrap → test 19/19 |

## Final status

```
LOCAL PASS — PRODUCTION INTEGRATIONS LOCKED
```

**Reason:** All P0/P1 fixed; full edit-loop (CEO → CMS → website) proven for hero + 6 promotion cards; commercial layer (checkout + webhook + license) end-to-end green in sandbox; 19/19 tests pass on fresh extract; deployment + rollback docs complete.

**Production readiness gate is open** — the only items between this state and a live launch are operator actions documented in `GO_LIVE_GUIDE.md`:

1. Buy domain (Cloudflare Registrar, ~10 min)
2. Deploy backend (Fly.io, ~15 min)
3. Deploy frontend (Cloudflare Pages, ~10 min)
4. Wire DNS + SSL (~5 min)
5. Configure Lemon Squeezy real credentials + webhook (~15 min)
6. Update Fly secrets with LS values + flip `LEMONSQUEEZY_TEST_MODE=false`
7. Rotate `ADMIN_INITIAL_PASSWORD`
8. Run 11-step smoke test
9. If smoke test green → public launch

## What is NOT in this gate (intentional — per design)

| Item | Why not |
|---|---|
| Editable FAQ / Docs / Changelog via CMS | These pages remain static for v0.5.0. Operator can ship the launch with static content; CMS-ifying them is M3-M4. |
| Editable header/footer / nav / logo | M5. Static HTML in v0.5.0 — change requires developer push, but content is correct. |
| Media upload via admin UI button | M6. API works; admin UI is read-only with banner. |
| Live AI test (Perplexity proxy) | Phase 1 (separate v0.6) — not blocking commerce |
| Active citation polling | Phase 2 — not blocking commerce |

## Decision

Recommend: **deliver this ZIP to operator + DevOps**.

- For the CEO: read `LAUNCH-HANDOFF.md` + `GO_LIVE_GUIDE.md` in order.
- For the developer: read `README.md` → `10_LOCAL_RUN.md` → `MODULE-MAP.md` → `DEBUGGING_MAP.md` for triage path.

After M3-M6 land in subsequent versions, the deferred items above turn ✅. **None of them blocks production launch today** — they only narrow the set of things the CEO can edit without code push.
