# Content Module Spec — v0.7.0 extension decision

> Per master prompt §16 Step 2.

## Extension decision

| Question | Decision | Reason |
|---|---|---|
| Article storage | **Extend existing `articles` table** (NOT create `content_posts`) | 24 of 33 fields already exist; renaming/duplicating risks data loss + breaks 18 OmniPlug Smoke tests |
| Media storage | **Reuse existing `media` table** (NOT create `media_assets`) | Already has 14 cols including width/height/alt/tenant scoping; already wired into admin API + 1y-cache static serve |
| Route namespace | **Keep existing `/api/admin/articles` + `/api/public/articles`** (NOT add `/api/admin/content/*`) | Backwards compat with shipping admin UI + smoke tests + SDK clients |
| UI sidebar placement | Move from "System" → "Marketing CMS", rename "Blog Articles" | Per master prompt §10 — disambiguate from Quoted Synced Posts |
| Risk | Migration additive only; no destructive ops; status enum extension backward-compatible | All existing tests must pass after migration |

## What migration 040 adds

```sql
ALTER TABLE articles ADD COLUMN scheduled_at  TEXT;
ALTER TABLE articles ADD COLUMN archived_at   TEXT;
ALTER TABLE articles ADD COLUMN og_title      TEXT;
ALTER TABLE articles ADD COLUMN og_description TEXT;
ALTER TABLE articles ADD COLUMN robots_index  INTEGER NOT NULL DEFAULT 1;  -- 1=index, 0=noindex
ALTER TABLE articles ADD COLUMN robots_follow INTEGER NOT NULL DEFAULT 1;  -- 1=follow, 0=nofollow
ALTER TABLE articles ADD COLUMN schema_type   TEXT NOT NULL DEFAULT 'Article'; -- Article|BlogPosting|Product|FAQPage
ALTER TABLE articles ADD COLUMN content_type  TEXT NOT NULL DEFAULT 'article'; -- article|doc|changelog|faq|landing

CREATE INDEX IF NOT EXISTS idx_articles_scheduled_at ON articles(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type);
```

## Status workflow

```
draft ──publish──> published
  │
  └──schedule──> scheduled ──(when scheduled_at <= now)──> published
  │
  └──archive──> archived
                   │
                   └──restore──> draft
```

Public visibility rules:
- `status = 'published'` AND `published_at <= NOW()` → public
- `status = 'scheduled'` AND `scheduled_at <= NOW()` → effectively public (read query treats them as published)
- All else → admin-only

## Sidebar rename plan

| Before (v0.6.4) | After (v0.7.0) |
|---|---|
| System → Articles (OmniPlug) | Marketing CMS → **Blog Articles** |
| System → Projects (OmniPlug) | System → Projects (OmniPlug) — unchanged, unused by Quoted |
| Quoted SaaS → Synced Posts | Quoted SaaS → Synced Posts — unchanged, different concept |

## Admin endpoints — what's new in v0.7.0

| Method | Path | New? | Description |
|---|---|---|---|
| `GET /api/admin/articles` | existing | — | list with status + search + new content_type filter |
| `GET /api/admin/articles/:id` | existing | — | detail (returns new SEO fields) |
| `POST /api/admin/articles` | existing | — | create (accepts new SEO fields) |
| `PATCH /api/admin/articles/:id` | existing | — | update |
| `POST /api/admin/articles/:id/publish` | existing | — | sets status=published + published_at=NOW() |
| `POST /api/admin/articles/:id/schedule` | **new** | adds | sets status=scheduled + scheduled_at=body |
| `POST /api/admin/articles/:id/unpublish` | **new** | adds | reverts published → draft |
| `POST /api/admin/articles/:id/archive` | existing | — | sets status=archived + archived_at=NOW() |
| `POST /api/admin/articles/:id/restore` | existing | — | restores deleted → draft |

## Public endpoints — what's new

| Method | Path | New? | Description |
|---|---|---|---|
| `GET /api/public/articles` | existing | — | list. Now: includes new SEO fields in response |
| `GET /api/public/articles/:slug` | existing | — | detail. Now: includes og_title, og_description, schema_type, robots_index, robots_follow |
| `/sitemap.xml` | existing | — | already emits articles per `seo.service.js`. No change. |
| `/feed.xml` | existing | — | already emits articles per `seo.service.js`. No change. |

## Admin UI new components

1. **`renderArticlesAdmin`** (replaces existing minimal `renderArticles`) — search box, status filter dropdown, content_type filter dropdown, paginated table with "Edit"/"Publish"/"Archive" inline actions
2. **`renderArticleEditor`** (replaces `renderArticleEditStub`) — full editor:
   - Title (required, max 200)
   - Slug (required, unique per tenant, validate URL-safe)
   - Excerpt (max 500)
   - Content (textarea — markdown OR HTML; keep simple for v0.7.0)
   - Featured image picker (media library modal)
   - **SEO panel collapsible:**
     - SEO Title (placeholder = Title)
     - Meta Description (placeholder = Excerpt)
     - Canonical URL
     - OG Title / OG Description / OG Image
     - Robots index (toggle)
     - Robots follow (toggle)
     - Schema type (dropdown)
   - **Action bar:**
     - Save Draft
     - Schedule (datetime picker → POST /schedule)
     - Publish (POST /publish)
     - Unpublish (POST /unpublish, only if currently published)
     - Archive (POST /archive)
     - Preview link (opens public URL in new tab if published, else opens a preview-mode URL)

## Frontend website blog pages

| Path | New? | Renders |
|---|---|---|
| `/blog` or `/blog.html` | extend existing static `frontend/blog.html` | List of published articles fetched from `/api/public/articles` |
| `/blog/:slug` (or `/blog.html?slug=...`) | new | Article detail fetched from `/api/public/articles/:slug` |

To keep DX simple (no SPA framework, no build step):
- Use the existing `cms.js` hydration helper pattern
- Article detail page = single `frontend/blog-post.html` with `?slug=...` query parameter
- OR: dynamic route via Cloudflare Pages `_routes.json` to map `/blog/{slug}` → `blog-post.html?slug={slug}`

For v0.7.0 ship the simpler version (query param). Pretty URLs can be added in v0.7.1 via CF Pages config.

## Tests to add (per master prompt §13)

Backend:
- `quoted-test-articles.mjs` — create draft, publish, schedule, archive, slug uniqueness, status transitions, public lists exclude draft/archived/scheduled-future
- Extend existing OmniPlug articles smoke (already covers create/update/publish/delete)

Frontend / renderer:
- Update `/tmp/admin-render-test.mjs` simulator with `articles` page expecting real list + editor pages

## Files to be touched

| File | Type of change |
|---|---|
| `backend/omniplug/src/core/db/migrations/040_quoted_articles_seo_extension.sql` | NEW |
| `backend/omniplug/src/backend/modules/articles/articles.schema.js` | extend status enum + add new fields |
| `backend/omniplug/src/backend/modules/articles/articles.service.js` | add schedule + unpublish methods |
| `backend/omniplug/src/backend/modules/articles/articles.repository.js` | new repo methods if needed |
| `backend/omniplug/src/backend/modules/articles/articles.controller.js` | 2 new routes |
| `backend/omniplug/src/cms/admin/assets/page-content.js` | replace renderArticles + renderArticleEditStub |
| `backend/omniplug/src/cms/admin/assets/page-content-handlers.js` | new handlers for article save/publish/schedule/archive |
| `backend/omniplug/src/cms/admin/assets/shell.js` | sidebar move + rename |
| `backend/omniplug/src/cms/admin/article-edit.html` | already exists, no change |
| `backend/omniplug/tests/quoted-test-articles.mjs` | NEW |
| `frontend/blog.html` | wire to public articles API |
| `frontend/blog-post.html` | NEW (single-article view) |
| `docs/MIGRATION_NOTES.md` | NEW |
| `docs/API_CONTRACT_CONTENT.md` | NEW |
| `docs/CONTENT_MODULE_SPEC.md` | this file |
| `docs/CONTENT_QA_REPORT.md` | NEW (after tests) |
| `docs/RELEASE_NOTES_v0.7.0.md` | NEW |
| `package.json` | version 0.6.4 → 0.7.0 |
| `CHANGELOG.md` | new entry |

## Out of scope for v0.7.0

Honest deferred items:
- Block-based / WYSIWYG editor — sticks with textarea for content body; markdown/HTML pasted directly. Most blog teams write in their own editor (Notion, Bear) and paste markdown anyway.
- Categories / tags — defer to v0.7.1; spec'd in §6 but adds 2 more tables + many-to-many. Not blocking for blog launch.
- Image upload UI button — backend API already works; admin Media tab is read-only listing per v0.6 deferred-to-M6. Media picker for featured-image will be inline (paste URL or use existing media). Full upload UI = v0.7.1.
- Cron job for scheduled articles — public read query handles `published_at <= NOW()` naturally; no separate cron needed.
- Categories / tags relationship tables — deferred.
- RSS endpoint — already exists, no change.

These deferrals are stated, not hidden. CEO can ship v0.7.0 blog publishing successfully without them.
