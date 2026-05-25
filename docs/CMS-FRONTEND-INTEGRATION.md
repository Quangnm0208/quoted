# CMS-driven marketing site — integration plan

> **Status:** Milestone 1 landed. Hero section on `index.html` is CMS-editable end-to-end.
> Milestones 2–4 deferred (scope per session).

## Why this exists

`frontend/` is a static marketing site (`index.html`, `pricing.html`, `docs.html`,
`faq.html`, `blog.html`, `changelog.html`, `success.html`). Up to v0.4.0 the
content is hardcoded in HTML — only a developer can change it.

This document records the plan for making it CMS-editable so the operator/CEO
can update marketing copy from the OmniPlug admin without touching code.

## What was already there (no work needed)

The bundled OmniPlug CMS Core already ships a complete sections engine:

| Surface | Already exists |
|---|---|
| Data model | `page_sections` (tenant-scoped, sort_order, is_visible, `payload_json` flex field) |
| Public API | `GET /api/public/pages/:pageKey` → `{ page, sections: [{ key, type, title, subtitle, payload }] }` |
| Admin API | `GET/POST/PATCH/DELETE /api/admin/pages` (JWT-gated, audited) |
| Admin UI | `/admin/pages` + `/admin/sections` (page-section editor with `payload_json` blob) |
| Media library | `/api/admin/media` + `/admin/media` |
| Site settings | `/api/admin/site` + `/admin/site` |
| Component types | `hero_banner`, `rich_text`, `stat_grid`, `cta_block`, `gallery_block`, `feature_list`, `project_card_list` |
| Cache headers | 60s `public, stale-while-revalidate=300` on the public endpoint |

→ No new content model, no new admin UI, no new endpoints. The marketing site
just needs to **call** these endpoints and **hydrate** the existing static
markup with the returned content.

## Architecture

```
quotedeasy.com (frontend/, static HTML on Cloudflare Pages)
        │
        │  on DOMContentLoaded, fetch:
        │    GET https://api.quotedeasy.com/api/public/pages/quoted_home
        │
        ▼
api.quotedeasy.com (backend/omniplug, Fly.io)
        │
        │  resolveTenantFromHost → tenant id
        │  pagesRepository.listByPagePublic(tenant_id, 'quoted_home')
        │
        ▼
SQLite `page_sections` rows  (tenant_id, page_key, section_key, payload_json, …)
```

Each marketing page maps to one `page_key`:

| HTML file | `page_key` | Sections (`section_key`) |
|---|---|---|
| `index.html` | `quoted_home` | `hero`, `the_shift`, `how_it_works`, `live_demo`, `product`, `compat`, `use_cases`, `pricing`, `programs`, `testimonials`, `faq`, `final_cta` |
| `pricing.html` | `quoted_pricing` | `hero`, `plans`, `faq`, `cta` |
| `docs.html` | `quoted_docs` | `hero`, `index` (article links rendered separately) |
| `faq.html` | `quoted_faq` | `hero`, `questions` |
| `blog.html` | `quoted_blog` | `hero` (post list rendered separately) |
| `changelog.html` | `quoted_changelog` | `hero` (entry list rendered separately) |
| `success.html` | `quoted_success` | `hero`, `next_steps` |

`docs`, `blog`, `changelog` lists eventually back onto the existing
`articles` module (also already shipped — `/api/public/articles`).

### Hydration rule

Static HTML is the **fallback**. Build-time copy stays in place so the page
renders correctly even when:

1. JS is disabled
2. CMS API is unreachable
3. CMS returns no section for that key
4. Browser blocks the cross-origin call

The JS hydration helper (`frontend/assets/cms.js`) only *replaces* the visible
copy when it has a valid CMS payload — never crashes the page.

Every CMS-driven node is marked with a `data-cms="<section_key>.<field>"`
attribute. The helper finds these nodes and patches `.textContent` (for text)
or specific safe attributes (`.href` on links via `data-cms-href`).

`innerHTML` is **never** used by the hydration helper — that would let a
compromised CMS row inject script into the marketing site. Rich formatting
needs to be added as a future controlled step (e.g. a whitelisted mini-markup).

### Tenant resolution

- **Dev:** `softResolveTenant` falls back to tenant id 1 when host is
  unknown (`localhost`, `127.0.0.1`). No change required.
- **Production:** `tenants` row with `domain = quotedeasy.com` must exist so
  `resolveTenantFromHost` resolves it. The Quoted backend is single-product;
  tenant 1 is repurposed for the marketing site itself. See
  `docs/DEPLOYMENT.md` for the one-time setup.

### CORS

The static site at `:5500` (dev) / `quotedeasy.com` (prod) calls the API at
`:4000` / `api.quotedeasy.com`. `CORS_ORIGIN` in `backend/omniplug/.env.example`
now includes the dev port `5500`. Production deploys must set
`CORS_ORIGIN=https://quotedeasy.com,https://www.quotedeasy.com`.

## Milestone status

| # | Slice | Status |
|---|---|---|
| 1 | Hero on `index.html` end-to-end + helper + seed + test + CEO guide | ✅ done |
| 2 | Remaining `index.html` sections (`the_shift`, `how_it_works`, `live_demo`, `product`, `pricing`, `programs`, `testimonials`, `faq`, `final_cta`) | ⏳ next |
| 3 | `pricing.html`, `faq.html`, `success.html` | ⏳ next |
| 4 | `docs.html`, `blog.html`, `changelog.html` (article-list rendering) | ⏳ next |
| 5 | Site settings (logo, footer, social links) wired into header/footer partials | ⏳ next |
| 6 | Media-library picker on the OmniPlug Pages editor + hero image swap on marketing | ⏳ next |
| 7 | Acceptance gate: full CEO walkthrough, ops doc, deployment update | ⏳ next |

## Risks / deferred items

- **Heading-with-inline-markup:** the hero `<h1>` has `<br>` + `<span class="accent">`.
  Milestone 1 hydrates the safe plain-text portions only; complex headings
  stay in HTML. Future: tiny whitelisted markdown renderer.
- **i18n:** sections are single-locale. Multi-locale needs a `locale` column on
  `page_sections` or a per-locale row.
- **Preview/draft:** the existing `is_visible` flag is binary. Real preview
  would need a draft flag + signed preview URL. Not blocking for v1.
- **Media picker integration:** the existing admin sections editor stores a
  raw `payload_json` blob. CEO-friendly would be a structured form per
  component_type. Deferred to milestone 6.
- **WP plugin marketing copy** (inside `wp-plugin/`) is also static and **not**
  in scope here — it ships with the plugin and is updated via plugin releases,
  not the marketing CMS.
