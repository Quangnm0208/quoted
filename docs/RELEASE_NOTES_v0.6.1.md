# Release Notes — v0.6.1

**Tagged:** 2026-05-25
**Branch:** `claude/awesome-ptolemy-8phkw`
**Audit status:** ✅ PASS — 0 P0 / 0 P1 / 0 P2 bugs

## TL;DR

v0.6.1 is **v0.6.0 + the formal audit-pass artifacts**. No code changes from v0.6.0 — the audit found everything green. Bumping the patch version to capture the audit + 5 new release-engineering documents in the deliverable history.

## What v0.6 was (recap)

v0.6.0 transformed the admin from a generic content CMS into a real SaaS operator console matching the product Quoted actually sells:

- **Quoted Dashboard** — MRR / ARR / Revenue / Customers / Active Subs / Active WP Sites / Posts Synced / Bot Crawls 7d / Citations 7d / Webhook Failures
- **Customers** — every paying customer with latest plan + active subs/licenses counts
- **Subscriptions** — by-plan and by-status breakdown, with renewal/end dates
- **WP Sites** — installed plugin instances with post counts + 7-day crawl activity per site
- **Bot Crawls** — aggregated AI-crawler hits by bot, by site, by day (the product's value-prop data visible to the operator)
- **Synced Posts** — content WP plugins have sent to the backend
- 10 new admin endpoints under `/api/admin/quoted/*`
- 6 new admin HTML pages
- Sidebar reorganized into 4 priority groups

## What v0.6.1 adds

| Artifact | Purpose |
|---|---|
| [`AUDIT_REPORT.md`](AUDIT_REPORT.md) | Full 8-phase audit per master-prompt with concrete Pass/Fail per requirement |
| [`BUG_FIX_LOG.md`](BUG_FIX_LOG.md) | 3 audit findings (all false positives) + cross-link to the 9 real bugs already fixed earlier in this session's git history |
| [`SMOKE_TEST_REPORT.md`](SMOKE_TEST_REPORT.md) | 7-section release smoke (backend / admin / SaaS logic / webhook / security / cold-start ZIP / npm test 19/19) |
| [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) | Auth / secrets / input safety / output safety / transport / observability — zero exploitable findings |
| `RELEASE_NOTES_v0.6.1.md` (this file) | Summary |

## What was tested

| Area | Method | Result |
|---|---|---|
| Cold-start | extract ZIP → `npm run bootstrap` → `npm test` on fresh `/tmp` | ✅ 19/19 |
| Backend API — auth | 401 on all 10 SaaS endpoints w/o token | ✅ |
| Backend API — empty DB | 200 + `{rows: []}` shape (or aggregate shape for bot-crawls) | ✅ |
| Backend API — seeded DB | rows reflect injected fixtures | ✅ |
| Backend API — invalid params | `?limit=abc` → default; `?days=999` → clamp 90; SQL inj → rejected | ✅ |
| Backend API — secret leak | scan responses for 5 markers | ✅ 0 leaks |
| Admin UI render | 19 pages via simulator, both empty + seeded | ✅ |
| Admin UI XSS escape | inject `<img src=x onerror=...>` → entity-encoded | ✅ |
| MRR formula | `pro-monthly` × 1900 + `pro-yearly` × 1583 = 3483 | ✅ |
| ARR formula | MRR × 12 = 41796 | ✅ |
| Revenue formula | sum paid orders amount_cents = 20900 | ✅ |
| Active sub count | cancelled excluded → 2 of 3 | ✅ |
| Webhook valid HMAC | 200 with raw-body signature match | ✅ |
| Webhook bad HMAC | 401 | ✅ |
| Webhook empty secret | 401 fail-closed (intended) | ✅ |
| Webhook idempotency | redelivery → 1 row insert, 1 customer, 1 order | ✅ |
| `npm test` regression | 19 suites (lint + schema + smoke + commercial + WP + SDK) | ✅ 19/19 |

## What changed from v0.6.0

```
docs/AUDIT_REPORT.md          (new)
docs/BUG_FIX_LOG.md           (new)
docs/SMOKE_TEST_REPORT.md     (new)
docs/SECURITY_REVIEW.md       (new)
docs/RELEASE_NOTES_v0.6.1.md  (new)
package.json                  0.6.0 → 0.6.1
```

No source code changes. Audit confirmed v0.6.0 already passes acceptance.

## Known limitations (carried from v0.6.0)

Stated honestly — none of these blocks v0.6.1 release:

| Surface | State | Roadmap |
|---|---|---|
| FAQ / Docs / Changelog editable | static (M3 partial — only home page covered) | M3.x — `pricing.html`, `faq.html`, `docs.html`, `blog.html`, `changelog.html` |
| Media upload UI in admin | read-only listing | M6 |
| Header logo / footer / navigation from CMS | static HTML | M5 |
| Admin write UI for Users / Tenants / License | read-only views | M7 |

## Operator action required to go live

1. Read [`LAUNCH-HANDOFF.md`](LAUNCH-HANDOFF.md) (Vietnamese, 10 sections)
2. Follow [`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md) (11 numbered steps)
3. Pass the 11-step smoke test in step 10
4. Public launch

## Final verdict

```
READY — FINAL LOCAL-RUN ZIP DELIVERED
```

Ship `final-product-local-ready.zip` (v0.6.1) to operator + DevOps.
