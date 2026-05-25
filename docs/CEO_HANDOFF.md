# CEO Handoff

> **Canonical doc:** [`LAUNCH-HANDOFF.md`](./LAUNCH-HANDOFF.md) — 10-section CEO production manual in Vietnamese.
> **Daily content editing:** [`CMS-CEO-GUIDE.md`](./CMS-CEO-GUIDE.md).
> **Step-by-step go-live:** [`GO_LIVE_GUIDE.md`](./GO_LIVE_GUIDE.md).

This file is a 1-page summary required by the master-prompt taxonomy.

## Product status

| Field | Value |
|---|---|
| Product name | Quoted |
| Version | 0.5.0 |
| Environment | Local-ready; awaiting domain + LS credentials for production |
| Website URL (dev) | <http://127.0.0.1:5500/> |
| Admin URL (dev) | <http://127.0.0.1:4000/admin/> |
| API URL (dev) | <http://127.0.0.1:4000> |
| Website URL (prod, planned) | https://quotedeasy.com (after step 6 of `GO_LIVE_GUIDE`) |
| Admin URL (prod, planned) | https://api.quotedeasy.com/admin/ |
| API URL (prod, planned) | https://api.quotedeasy.com |

## What CEO can do today

| # | Task | Where |
|---|---|---|
| 1 | Edit homepage hero (eyebrow, lead, CTAs) | Admin → Pages → `quoted_home` → `hero` |
| 2 | Edit "Programs" section header | Admin → Pages → `quoted_home` → `programs` |
| 3 | Edit 6 promotion cards (pill/title/body/code/CTA/meta) | Same → edit `payload.items[N]` in JSON box |
| 4 | Edit site-wide config (contact email, SEO defaults) | Admin → Site Settings |
| 5 | See real-time audit log of every change | Admin → Audit Log |
| 6 | See real users / tenants / leads / license status | Admin → respective tab (read-only in v0.5) |
| 7 | Upload media via API | `curl POST /api/admin/media` (UI button is M6) |

## What CEO can't yet do (M3+)

- Edit FAQ / Docs / Changelog from CMS
- Upload media via admin UI button (only API)
- Edit header logo / footer / navigation
- Add/remove users from admin UI
- Activate license from admin UI

For these, ask developer. Each has a stated milestone in [`17_PRODUCTION_READINESS.md`](./17_PRODUCTION_READINESS.md).

## Do not touch

| Area | Reason |
|---|---|
| `LEMONSQUEEZY_TEST_MODE` (set to true) | Production must be `false` or customers pay without getting license |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Mismatching this with LS dashboard breaks all future webhooks |
| `JWT_SECRET` | Rotating mid-session logs all admins out and breaks plugin JWTs |
| `ADMIN_INITIAL_PASSWORD` default `ChangeMe123!` | MUST be rotated before opening admin to operator team |
| Tenant 1 row in DB | The marketing site depends on it |
| Database file `data/cms.db` | Contains everything; back up before any manual touch |

## When something breaks

Send the developer:
1. Page URL
2. Screenshot (with browser DevTools Network tab open if possible)
3. Time of issue (helps audit log search)
4. What you clicked
5. Expected vs actual result
6. (If admin) what the toast/error message said

Developer follows [`DEBUGGING_MAP.md`](./DEBUGGING_MAP.md) triage tree.
