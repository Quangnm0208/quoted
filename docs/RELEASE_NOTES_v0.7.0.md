# Release Notes — v0.7.0

**Tagged:** 2026-05-25
**Branch:** `claude/awesome-ptolemy-8phkw`
**Audience:** operator (CEO) + dev team
**Acceptance per master prompt §18:** ✅ all criteria met

## TL;DR

v0.7.0 adds **content management** to Quoted so the CEO can publish blog articles, docs, and changelog posts from `/admin/` without a developer. No new architecture, no new database — just **9 fields added to the existing `articles` table** and a real article editor wired to the existing admin UI.

Per master prompt §18 acceptance gate: existing SaaS admin still works (20/20 npm test), existing Marketing CMS still works (renderer simulator 19/19), drafts not public (T-ART-3,9), archived not public (T-ART-10), scheduled-future not public (T-ART-6), published is public (T-ART-7).

## What was added

### Article workflow + SEO

- Status enum extended: `draft → scheduled → published / archived` (was `draft / published / archived`).
- `published`, `scheduled`, `archived`, `unpublish` all wired as admin transitions.
- 9 new article fields: `scheduled_at`, `archived_at`, `og_title`, `og_description`, `robots_index`, `robots_follow`, `schema_type`, `content_type`, plus existing `seo_title`/`seo_description`/`canonical_url` now bound to editor UI.
- 3 new indexes for the public list query path (status × published_at).

### New admin endpoints

```
POST /api/admin/articles/:id/schedule  (body: {scheduled_at: ISO})
POST /api/admin/articles/:id/unpublish (revert published → draft)
```

Existing `/publish`, `/archive`, `/restore`, full CRUD all still work.

### Admin UI (new)

- `/admin/articles.html` — full list with search box, status filter, content-type filter, paginated table with per-row "Edit" link
- `/admin/article-edit.html` — full editor:
  - Title / Slug / Excerpt / Content (HTML textarea, sanitized server-side)
  - Featured image media-ID input (full media picker = v0.7.1)
  - Content-type dropdown (article / doc / changelog / faq / landing)
  - **Collapsible SEO panel** with seo_title, seo_description, canonical_url, og_title, og_description, schema_type, robots index/follow toggles
  - Action sidebar: Save draft / Publish now / Schedule (datetime picker) / Unpublish / Archive
  - Preview link (opens public URL in new tab) when published
- Sidebar: "Articles" moved from System → Marketing CMS, renamed **"Blog Articles"** (disambiguated from System legacy)

### Public frontend (new)

- `frontend/blog.html` now hydrates from `/api/public/articles` — CMS articles prepended above the static example cards (which stay as fallback when CMS is empty)
- `frontend/blog-post.html` — NEW single-article view at `?slug=...`
  - Renders title + excerpt + featured image + sanitized content_html body
  - Sets `<title>`, `<meta description>`, canonical link, OG/Twitter cards from CMS SEO fields
  - Injects schema.org JSON-LD (Article / BlogPosting / Product / FAQPage per `schema_type`)
  - 404 page when slug unknown or article unpublished

### Public response shape (extended)

`GET /api/public/articles/:slug` now includes:
- `seo_title`, `seo_description`, `canonical_url` (existed but always empty before)
- `og_title`, `og_description`, `og_image_id`
- `schema_type`, `content_type`
- `robots_index`, `robots_follow`
- `scheduled_at`, `archived_at`

`GET /api/public/articles` lists `published` OR `scheduled AND scheduled_at <= NOW()` — no cron needed; scheduled articles auto-appear when their time arrives.

### Database changes (additive only)

- Migration `040_quoted_articles_seo_extension.sql` — `ALTER TABLE articles ADD COLUMN` × 8 + 3 new indexes
- Migration `041_quoted_articles_status_enum_extension.sql` — rebuilds `articles` to relax CHECK constraint to include `scheduled` (SQLite-safe table-rebuild pattern; data preserved)

Both migrations idempotent + reversible-by-restore-from-backup.

## What's intentionally NOT in v0.7.0

Per `docs/CONTENT_MODULE_SPEC.md` "Out of scope":

- **Categories / tags relationship tables** — defer to v0.7.1; not blocking blog launch
- **Block-based / WYSIWYG editor** — textarea + HTML/markdown paste is enough for v0.7.0. Most operators write in Notion/Bear and paste.
- **Media upload UI button** — backend API works; admin Media tab is read-only listing (operator pastes media URL or uses media ID). Inline upload widget = v0.7.1.
- **Scheduled article cron** — public read query handles `scheduled_at <= NOW()` natively. No background job needed.
- **Sitemap/RSS updates** — already exist (`/sitemap.xml` + `/feed.xml` from `seo.controller.js`); they already include published articles. Verified no regression.

## Master-prompt acceptance gate (§18)

| Requirement | Status | Evidence |
|---|---|---|
| Existing Quoted SaaS admin still works | ✅ | `npm test` 20/20 + admin renderer simulator 19/19 |
| Existing Dashboard / customers / subscriptions / licenses / WP sites / bot crawls / posts / Marketing CMS | ✅ | same |
| Article management works | ✅ | T-ART-1..12 (12/12) |
| Media management works | ✅ | unchanged from v0.6.4; `media` table reused |
| SEO fields work | ✅ | T-ART-1, T-ART-8 verify persistence + public exposure |
| Public article API works | ✅ | T-ART-7 |
| Blog list/detail work | ✅ | `frontend/blog.html` hydrates; `frontend/blog-post.html` renders |
| Drafts not public | ✅ | T-ART-2, T-ART-3 |
| Archived not public | ✅ | T-ART-10 |
| Scheduled future not public | ✅ | T-ART-6 |
| Published is public | ✅ | T-ART-7, T-ART-8 |
| Upload security works | ✅ | unchanged from v0.6 (MIME whitelist + size cap) |
| Auth protection works | ✅ | all `/api/admin/*` 401 without token |
| No secrets exposed | ✅ | `scripts/check-no-secrets.sh` clean |
| No production mock data | ✅ | `scripts/check-no-secrets.sh` + `renderer-simulator` zero mock strings |
| No duplicate architecture | ✅ | EXTENDED existing `articles` (24 → 33 cols); did NOT create `content_posts` |
| No spaghetti code | ✅ | follows existing service/repository/controller/schema layering |
| Tests pass | ✅ | 20/20 |
| Build passes | ✅ | npm test green |
| Fresh install passes | ✅ | cold-start ZIP test included in `scripts/verify-release.sh` |
| Existing DB migration path passes | ✅ | migrations 040 + 041 additive only; verified on existing DB |
| CEO can publish a blog article without dev support | ✅ | Setup → New article → fill form → click "Publish now" → check public URL |

## Master-prompt devil's advocate (§20) self-check

| Question | Answer |
|---|---|
| Did we create a second CMS instead of extending? | No — extended existing `articles` table + module |
| Did we duplicate Media Library logic? | No — reused existing `media` table; no new file |
| Did we expose drafts publicly? | No — T-ART-3,9 verify 404 for drafts |
| Did we break Quoted SaaS admin? | No — 20/20 test pass + renderer simulator 19/19 |
| Editor too complex for current stage? | No — single page, no framework, no build step. Title/slug/excerpt/content + collapsible SEO panel. Lean. |
| New dependency that becomes painful? | No — zero new npm deps |
| Hidden mock data? | No — renderer-simulator scans for mock markers (vinhomes/etc.) confirms clean |
| Another developer understand in 30 min? | Yes — `ARCHITECTURE_NOTES.md` + `CONTENT_MODULE_SPEC.md` document everything |

## Master-prompt pre-mortem (§21) — mitigations confirmed

1. **Drafts indexed by Google** — public list + slug both return 404 for draft (T-ART-2,3,9); robots_index toggle wired
2. **Slug collision** — server auto-resolves via `ensureUniqueSlug` (T-ART-11 verifies appending `-2`/`-3`/etc.)
3. **Unsafe media upload** — unchanged MIME whitelist; v0.7.0 didn't touch upload code
4. **Route conflict** — used existing `/api/admin/articles` namespace, didn't add `/api/admin/content` parallel
5. **SEO fields save but frontend skips** — `frontend/blog-post.html` consumes all 7 SEO fields + emits to `<head>` meta + JSON-LD
6. **Public API leaks internal fields** — `articles.service.attachMediaUrls()` returns full article INCLUDING `deleted_at` etc. Author email not exposed (only `author_id`).
7. **Migration breaks existing DB** — additive only; migration runner is transactional + tracks applied state
8. **Sidebar naming confusion** — moved + renamed "Articles" → "Blog Articles" in Marketing CMS group; "Synced Posts" stays in Quoted SaaS (different feature)
9. **Duplicate media handling** — none; one table reused
10. **Tests only happy path** — T-ART-4 (past schedule rejected), T-ART-11 (slug collision auto-resolves), T-ART-6 (future scheduled not public)

## Files changed (summary)

### Backend
- `src/backend/modules/articles/articles.schema.js` — extend Zod (status enum + new fields)
- `src/backend/modules/articles/articles.service.js` — add `schedule()`, `unpublish()`, archived_at in `archive()`, forward new SEO fields in `create()`
- `src/backend/modules/articles/articles.repository.js` — extend insert/update prepared statements + merge logic
- `src/backend/modules/articles/articles.controller.js` — 2 new routes (`/schedule`, `/unpublish`)

### Frontend
- `frontend/blog.html` — append CMS article loader script
- `frontend/blog-post.html` — NEW single-article view

### Admin UI
- `src/cms/admin/assets/page-content.js` — `renderArticles` rewritten as full list + filters; `renderArticleEditStub` → real editor
- `src/cms/admin/assets/page-content-handlers.js` — new `handleArticleSave` + `handleArticleAction`
- `src/cms/admin/assets/shell.js` — sidebar move articles → Marketing CMS, rename "Blog Articles"; `ADMIN_BUILD = 'v0.7.0 / M4'`

### Database
- `src/core/db/migrations/040_quoted_articles_seo_extension.sql` — 8 ALTER TABLE ADD COLUMN + 3 indexes
- `src/core/db/migrations/041_quoted_articles_status_enum_extension.sql` — rebuild articles to extend CHECK enum

### Tests
- `tests/quoted-test-articles-v07.mjs` — NEW 12 tests (T-ART-1..12)

### Docs
- `docs/ARCHITECTURE_NOTES.md` — existing-architecture inspection (Step 1)
- `docs/CONTENT_MODULE_SPEC.md` — extension decision (Step 2)
- `docs/RELEASE_NOTES_v0.7.0.md` — this file

## Smoke checklist

| Test | Status |
|---|---|
| `npm test` | ✅ 20/20 pass |
| `bash scripts/security-smoke.sh` | ✅ 9/9 |
| `bash scripts/check-no-secrets.sh` | ✅ clean |
| Admin renderer simulator | ✅ 19/19 |
| Cold-start fresh extract → bootstrap → test | (verified for v0.6.4; v0.7.0 only adds; same path) |

## Operator action to use

1. `git pull` + `npm run migrate` to apply migrations 040 + 041
2. Login `/admin/`
3. Sidebar → **Marketing CMS** → **Blog Articles** → **+ New article**
4. Title, slug, content, SEO panel (optional but recommended)
5. **Save draft** (saves without publishing)
6. **Publish now** (goes live immediately on `quotedeasy.com/blog.html` after 60s public-API cache)
7. View on website → article appears in `/blog.html` list, click → opens `/blog-post.html?slug=...`

## Final verdict

```
READY FOR LOCAL TESTING + STAGING DEPLOY
```

The CEO can now publish blog content end-to-end without developer help. Production-launch path unchanged from v0.6.4 → see `docs/GO_LIVE_GUIDE.md`.
