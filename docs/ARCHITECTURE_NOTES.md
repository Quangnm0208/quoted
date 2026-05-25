# Architecture Notes — Quoted v0.6.x → v0.7.0 inspection

> Per master prompt §16 Step 1: inspect before coding.

## Existing modules relevant to content management

| Concern | Already exists | File / location |
|---|---|---|
| **Articles table** | ✅ 24 columns | DB; defined in early OmniPlug migrations |
| **Articles controller** | ✅ Full CRUD + publish/archive/restore | `src/backend/modules/articles/articles.controller.js` |
| **Articles service** | ✅ business logic layer | `articles.service.js` |
| **Articles repository** | ✅ DB layer | `articles.repository.js` |
| **Articles schema (Zod)** | ✅ create/update/list validators | `articles.schema.js` — status enum: `draft \| published \| archived` |
| **Articles policy** | ✅ access control | `articles.policy.js` |
| **Media table** | ✅ 14 columns | DB; `id, filename, original_name, mime_type, size_bytes, width, height, alt, alt_status, alt_suggested, tenant_id, uploaded_by, created_at, deleted_at` |
| **Media admin API** | ✅ list/upload/patch/delete | `src/backend/modules/media/media.controller.js` |
| **Sitemap.xml** | ✅ at root | `seo.controller.js` line 78 |
| **Feed.xml (RSS)** | ✅ at root | `seo.controller.js` line 95 |
| **Audit log helper** | ✅ `recordAudit(req, action, opts)` | `core/lib/audit.js` |
| **Tenant resolution** | ✅ `resolveTenantFromAuth` / `resolveTenantFromHost` | `core/middleware/tenant.js` |
| **Auth middleware** | ✅ `requireAuth` | `core/middleware/auth.js` |
| **Public ↔ admin separation** | ✅ established pattern | `server.js` line 347+ |

## Articles table column map (24 cols)

```
id, tenant_id, slug, title, excerpt, content_html, cover_media_id, status,
published_at, meta_title, meta_description, meta_og_image, author_id,
deleted_at, created_at, updated_at, seo_title, seo_description,
focus_keyword, secondary_keywords, canonical_url, robots_directive,
meta_keywords, og_image_id, seo_score
```

**Already covers 80% of master prompt §1 article fields + SEO panel.**

## Existing routes

- `GET  /api/public/articles` — list (status=published, paginated)
- `GET  /api/public/articles/:slug` — detail
- `POST /api/admin/articles` — create
- `GET  /api/admin/articles` — list (status filter + search)
- `GET  /api/admin/articles/:id` — detail
- `PATCH /api/admin/articles/:id` — update
- `PUT  /api/admin/articles/:id` — update (alias)
- `POST /api/admin/articles/:id/publish`
- `POST /api/admin/articles/:id/archive`
- `POST /api/admin/articles/:id/restore`
- `DELETE /api/admin/articles/:id`

**Missing per master prompt §5:**
- `POST /api/admin/articles/:id/schedule` (with `scheduled_at` body)
- `POST /api/admin/articles/:id/unpublish` (revert to draft)

## Missing article fields per master prompt §1+2

| Master prompt requires | Already in DB | Action |
|---|---|---|
| `scheduled_at` | ❌ | Add |
| `og_title` | ❌ (only `meta_title` exists) | Add |
| `og_description` | ❌ | Add |
| `robots_index` (boolean) | partial (`robots_directive` text) | Add bool + keep text for back-compat |
| `robots_follow` (boolean) | partial | Add bool |
| `schema_type` | ❌ | Add (enum: Article / BlogPosting / Product / FAQPage) |
| `archived_at` | ❌ (using `deleted_at` as archive) | Add separate `archived_at` for proper archive vs delete distinction |
| `content_type` | ❌ (single content type) | Add (enum: article / doc / changelog / faq / landing; default 'article') |
| Status `scheduled` | ❌ enum only has draft/published/archived | Extend status enum to include `scheduled` |

## Existing admin UI for articles

| File | Purpose | Status |
|---|---|---|
| `src/cms/admin/articles.html` | shell | exists, `data-page="articles"` |
| `src/cms/admin/article-edit.html` | shell | exists, `data-page="articleEdit"` |
| `src/cms/admin/assets/page-content.js::renderArticles()` | renderer | exists but minimal (just lists rows in read-only table per M2 rewrite) |
| `src/cms/admin/assets/page-content.js::renderArticleEditStub()` | renderer | currently a stub — "Article editor chưa được wire vào backend" — needs replacement |

**Per v0.7.0 master prompt requirement: replace the stub with a real article editor.**

## Existing admin sidebar placement

Today (per `shell.js`):
- `articles` is under **System** group, labeled "Articles (OmniPlug)"
- A separate "Synced Posts" lives under **Quoted SaaS** (different concept — WP plugin synced content)

Per master prompt §10 sidebar update:
- Move "Articles" from System → **Marketing CMS** group
- Rename to "Blog Articles" or "Website Articles" to disambiguate from System legacy
- "Synced Posts" (WP plugin content) stays in Quoted SaaS — different feature, different table

## Frontend website blog

- `frontend/blog.html` exists already (static, no CMS connection)
- `frontend/cms.js` exists (M1 hydration helper) — can extend for blog list

## Conclusions

1. **DO extend**, don't duplicate. The `articles` module is the single source of truth.
2. **Single migration** to add 9 missing fields + extend status enum.
3. **Schema enum extension** in `articles.schema.js` (driven by Zod).
4. **2 new endpoints** in `articles.controller.js`: `/schedule` + `/unpublish`.
5. **Replace `renderArticleEditStub`** with a real editor; replace `renderArticles` read-only table with an editor-linked list.
6. **Sidebar update** — move articles to Marketing CMS group, rename.
7. **Frontend `/blog` + `/blog/:slug`** — leverage existing cms.js for fetch + hydration.
8. **Sitemap/RSS**: existing `seo.controller.js` already emits them; just verify it includes new scheduled-but-past-published-at logic.

## Risks

| Risk | Mitigation |
|---|---|
| Renaming sidebar item from "Articles (OmniPlug)" → "Blog Articles" could confuse current operator | Keep both: rename top-level, add a separate "Articles (legacy)" line if needed; better: confirm with operator via docs |
| Migration adding columns to existing `articles` table | Additive only (`ALTER TABLE ADD COLUMN`); idempotent guard via schema_migrations |
| `articles.schema.js` extending status enum may break existing tests | Verify smoke + npm test after change |
| Scheduled article cron — when does it auto-publish? | Option A: no cron, expose `published_at` in public list with `WHERE published_at <= NOW()` so scheduled becomes visible automatically when time arrives. Option B: cron job. Recommend Option A (simpler, sufficient) |
| `archived_at` vs existing `deleted_at` | Keep both; `deleted_at` = soft-delete (restore-able), `archived_at` = "unpublished, kept visible in admin"; status=archived sets archived_at |
