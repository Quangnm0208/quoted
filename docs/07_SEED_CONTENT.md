# 07 — Seed Content Report

> Honest: only **3 surfaces seeded** in v0.5.0. The rest is intentionally static (deferred to M3-M5 per `CMS-FRONTEND-INTEGRATION.md` roadmap).

## What's seeded (production-safe content)

| Content Type | Migration | Editable | Front-end Visible | Production Safe? | Notes |
|---|---|---|---|---|---|
| Admin user | `migrate.js::bootstrapInitialAdmin()` | ✅ via `/admin/users.html` once M7 lands; today via API | n/a | ✅ if `ADMIN_INITIAL_PASSWORD` is rotated | Single user `admin@omniplug.local`/`ChangeMe123!` in dev; operator must override via env in prod |
| Default tenant 1 | `migrate.js::bootstrapDefaultTenantDomain()` | ✅ via API | n/a | ✅ if `TENANT_DEFAULT_DOMAIN` set to prod host | `domain=localhost` in dev; operator must override |
| Homepage hero | `037_quoted_marketing_pages.sql` | ✅ via `/admin/pages.html` (Pages → `quoted_home` → `hero`) | ✅ on `/` hero | ✅ real Quoted copy, no lorem | Idempotent `INSERT OR IGNORE` |
| Homepage programs header | `038_quoted_marketing_programs.sql` | ✅ same path → `programs` | ✅ on `/` "Programs" section header | ✅ real Quoted copy | Idempotent |
| Homepage promo cards (6 items) | `039_quoted_marketing_programs_items.sql` | ✅ same path → edit `payload.items[N]` in JSON | ✅ on `/` 6 promotion cards | ✅ real Quoted launch promos (EARLYBIRD30, etc.) | Idempotent via `json_set` + `json_extract IS NULL` guard |
| Site settings (`site_config`) | OmniPlug migration 001 | ✅ via `/admin/site.html` | ❌ not wired to header/footer yet | ✅ no preset values | Empty values; operator fills in |
| Pricing plans | env-driven via `commerce/plans/*` | ✅ via env vars (variant IDs + checkout URLs) | ✅ via `/api/products/plans` | ✅ no production prices hardcoded | Placeholder URLs in dev; real LS URLs in prod |
| License JWT keys | n/a | n/a | n/a | ✅ operator generates; dev only ships public key | `keys/op-license-pub.pem` shipped; private key NEVER committed |
| Test license envelope | `keys/marcus-outdoor.qtd-license.txt` | n/a | n/a | ✅ dev-only signed for `marcus-outdoor.test` | For smoke tests only — would not be accepted by prod backend if its keys differ |

## What's NOT seeded (intentional — deferred)

| Content Type | Reason | Roadmap |
|---|---|---|
| FAQ entries | No FAQ model yet (faq.html is static) | M3 — add `faqs` table or reuse `page_sections` `component_type='faq'` |
| Documentation articles | `articles` table exists but no Quoted-specific seed; WP plugins sync their own | M4 — add starter Quoted product docs |
| Changelog entries | No changelog model yet (changelog.html is static) | M4 — add `changelog_entries` table |
| Testimonials | static block on home | M3 — same items[]-on-section pattern as promo cards |
| Navigation items | header/footer hardcoded in HTML partials | M5 |
| Media library starter assets | empty by design | operator uploads as needed |
| Demo lead | not seeded | operator wants real leads only |

## Anti-patterns avoided

| Bad pattern | Why we don't do it | Where we'd violate it |
|---|---|---|
| Lorem ipsum filler | CEO sees "Lorem" and assumes feature is broken / never updated | Hero subtitle real copy; promo cards real promo text |
| Real-estate demo data (Vinhomes) | Wrong-domain residue confuses operator | M2.1 scrubbed last 3 hardcodes |
| Hardcoded admin password | Login security gone | `ChangeMe123!` is DEV ONLY; production requires override via `ADMIN_INITIAL_PASSWORD` env (validated in migrate.js) |
| Fake testimonials with real-looking faces | Misrepresents real customer endorsements | Static block today; will require operator-provided real names + photos when CMS'd |
| Pre-seeded pricing with promo discounts that aren't real | Misleading customers | Real Quoted launch prices ($19/29/190/290); EARLYBIRD30 code is real per Quoted promo |

## Production readiness check

| Question | Answer |
|---|---|
| Will seed run on fresh production database? | ✅ Yes — `bash scripts/bootstrap.sh` applies all migrations idempotently |
| Will seed overwrite operator edits? | ❌ No — all `INSERT OR IGNORE` or `json_set` with `IS NULL` guard |
| Does seed include any vendor secrets? | ❌ No — secrets are env-driven |
| Does seed include any test credentials that could authenticate? | ❌ No real licenses; only signed test envelope for `marcus-outdoor.test` (rejected by production keys) |
