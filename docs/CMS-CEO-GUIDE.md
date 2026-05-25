# CMS — editing the marketing site

> **Status:** Milestone 1. Today you can edit the **home page hero** copy
> (eyebrow chip, lead paragraph, button labels, button URLs) without a
> developer. More sections are being wired in later milestones — see
> [CMS-FRONTEND-INTEGRATION.md](./CMS-FRONTEND-INTEGRATION.md) for the
> rollout plan.

## Quick login

| Surface | URL (dev) | URL (production) |
|---|---|---|
| Marketing site | <http://127.0.0.1:5500/> | <https://quotedeasy.com/> |
| CMS admin | <http://127.0.0.1:4000/admin/> | <https://api.quotedeasy.com/admin/> |
| Default credentials (dev) | `admin@quoted.local` / `ChangeMe123!` | set via env at deploy time |

> Production credentials are configured at deploy time via `ADMIN_EMAIL` +
> `ADMIN_INITIAL_PASSWORD`. Change the password immediately after first login.

## Editing the home hero

1. Open the CMS admin and log in.
2. From the sidebar, click **Pages**.
3. Find the row with **page_key = `quoted_home`** and click in to its sections.
4. Open the section with **section_key = `hero`** (type: `hero_banner`).
5. Edit the fields, save.
6. Refresh <http://127.0.0.1:5500/> (dev) or <https://quotedeasy.com/> (prod).

You should see the new copy on the page. If you don't, hard-refresh
(Cmd-Shift-R / Ctrl-Shift-R) — the API returns a 60-second cache header,
and Cloudflare may cache for longer in production.

### What each field maps to on the page

| Admin field | What it changes on the home page |
|---|---|
| **Title** | (Not used in milestone 1 — the styled headline stays as-is. Will be editable in a later milestone.) |
| **Subtitle** | The grey lead paragraph under the headline |
| **Payload → `eyebrow`** | The pill text above the headline ("New · live on WordPress.org") |
| **Payload → `cta_primary_label`** | The text on the blue primary button ("Install free plugin") |
| **Payload → `cta_primary_url`** | Where the blue primary button links to |
| **Payload → `cta_secondary_label`** | The text on the outline secondary button ("See it in action") |
| **Payload → `cta_secondary_url`** | Where the secondary button links to |

`Payload` is a JSON box in the admin. It looks like:

```json
{
  "eyebrow": "New · live on WordPress.org",
  "cta_primary_label": "Install free plugin",
  "cta_primary_url": "https://wordpress.org/plugins/quoted/",
  "cta_secondary_label": "See it in action",
  "cta_secondary_url": "#live-demo"
}
```

Keep the JSON valid — every key must be in double quotes, every line except
the last inside `{ }` ends in a comma, and the value side stays in double
quotes. If the JSON is broken, the admin will show a save error and the
old copy will keep showing on the site (no harm done).

## What is *not* editable in milestone 1 (yet)

| Surface | Status | When |
|---|---|---|
| Home page sections after the hero (the shift demo, how-it-works, pricing cards, FAQ, etc.) | Static HTML | Milestone 2 |
| `/pricing`, `/faq`, `/success` pages | Static HTML | Milestone 3 |
| `/docs`, `/blog`, `/changelog` lists | Static HTML | Milestone 4 |
| Header logo, footer text, social links | Static HTML | Milestone 5 |
| Hero image / replacing the 3D illustration | Static asset | Milestone 6 (media-library picker) |
| WordPress plugin's own settings page text | Ships with the plugin | Plugin release, not CMS |

Until those land, ask the developer to update them in the HTML. The
hero is the **proof** that the CEO ↔ CMS ↔ site loop is wired correctly —
once we extend the same `data-cms` pattern to the other sections, you'll
edit them the same way.

## Common operations

| Task | Where in the admin |
|---|---|
| Edit homepage hero copy | **Pages** → `quoted_home` → `hero` |
| Hide a section temporarily | Open the section → toggle `is_visible` off → save. Refresh site — section disappears, fallback HTML still rendered if any. |
| See who changed what | **Audit log** — every section edit is recorded |
| Upload an image to use later | **Media library** — for milestone 1 the upload works; wiring it onto the hero is milestone 6 |

## When something looks wrong

1. **Edit saved but site still shows old copy.** Hard-refresh
   (Cmd-Shift-R / Ctrl-Shift-R). The API caches for 60s and Cloudflare can
   cache longer; wait a minute and try again before escalating.
2. **Edit broke the page layout.** The hero stays in its original markup
   even if hydration fails — you can't break the layout from the CMS, only
   the copy. If copy looks empty, check whether the field you edited is the
   right one (the payload JSON is case-sensitive).
3. **Cannot log in.** Try password reset; if that's not wired yet, ask
   the developer to reset via the database (see `docs/DEBUGGING.md`).
4. **API returned an error in the admin save panel.** Take a screenshot
   of the error code + payload, send to the developer. The error code
   identifies the cause exactly.

## What to never touch

| Field | Why |
|---|---|
| `component_type` on an existing section | The frontend expects a fixed shape per type — changing it will silently break hydration. |
| `section_key` after first publish | The page HTML binds to `section_key` (`data-cms="hero.title"`). Renaming a key breaks the binding until the HTML is updated. |
| Tenant settings | Multi-tenant DB plumbing — out of scope for marketing operators. |
| License / API keys / payment settings | Production billing depends on these — only the developer/admin should touch them. |

## Where this lives in the codebase (for the developer)

- Seed migration: `backend/omniplug/src/core/db/migrations/037_quoted_marketing_pages.sql`
- Public API: `backend/omniplug/src/backend/modules/pages/pages.controller.js`
  → `GET /api/public/pages/:pageKey`
- Hydration helper: `frontend/assets/cms.js`
- Wired sections: search for `data-cms=` in `frontend/index.html`
- Smoke test: `backend/omniplug/tests/quoted-test-cms-frontend.mjs`
- Design plan: `docs/CMS-FRONTEND-INTEGRATION.md`
