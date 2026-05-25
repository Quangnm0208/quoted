# CMS User Guide

> **Canonical Vietnamese walkthrough:** [`CMS-CEO-GUIDE.md`](./CMS-CEO-GUIDE.md).
> This file is the English summary required by the master-prompt taxonomy.

## Login

| Step | Detail |
|---|---|
| URL | `<admin URL>/admin/` (dev: <http://127.0.0.1:4000/admin/>) |
| Email | `admin@<your-domain>` (set via `ADMIN_EMAIL` env) |
| Password | Set via `ADMIN_INITIAL_PASSWORD` env — **rotate after first login** |

The sidebar footer shows e.g. `v1.4.4 · admin build M2.1` — that's the version + admin UI build. If it doesn't match what your developer just deployed, hard-refresh (Cmd-Shift-R) to clear cached JS.

## Editing a section (hero, programs, ...)

1. Sidebar → **Pages** → click `quoted_home`
2. Expand the section card (hero, programs, etc.)
3. Edit **Title**, **Subtitle**, or the **Payload** JSON
4. Toggle **Visible** off if you want to hide the section without deleting
5. Click **Save**
6. Toast appears: "Section đã lưu" → ✅ saved
7. Visit the website → hard-refresh (Cmd-Shift-R) → see new content

> The website caches the section data for 60 seconds. After save, your first refresh may still show the old copy for up to 60s. Cloudflare may cache longer in production.

## Payload JSON examples

### Hero payload
```json
{
  "eyebrow": "New · live on WordPress.org",
  "cta_primary_label": "Install free plugin",
  "cta_primary_url": "https://wordpress.org/plugins/quoted/",
  "cta_secondary_label": "See it in action",
  "cta_secondary_url": "#live-demo"
}
```

### Programs payload (note `items[]`)
```json
{
  "eyebrow": "Programs",
  "items": [
    { "pill": "Early bird", "title": "30% off Pro …", "body": "…", "code": "EARLYBIRD30", "cta_label": "Claim my spot →", "cta_url": "pricing.html", "meta": "17 / 100 claimed", "is_feature": true },
    { "pill": "Guarantee",  "title": "30-day money-back guarantee.", "body": "…", "code": "", "cta_label": "How it works →", "cta_url": "faq.html#pricing", "meta": "Auto via Lemon Squeezy", "is_feature": false },
    …
  ]
}
```

Keep the JSON valid:
- Every key in double quotes
- Every value (except numbers/booleans/null) in double quotes
- Commas between items, but not after the last
- If the admin save fails with "Payload không phải JSON hợp lệ" → check for a missing or extra comma

## Site settings

Sidebar → **Site Settings** → each row is a key/value pair. Click into the Value cell, type, click Save. The change is recorded in the audit log.

| Key example | What it controls |
|---|---|
| `contact.address` | Postal address in JSON-LD + footer (when wired) |
| `contact.phone` | Phone number |
| `seo.default_title` | Title tag fallback |
| `seo.default_description` | Meta description fallback |

(In v0.5.0, header/footer don't yet read from site_config — that's M5. The values are stored correctly; M5 will wire them onto the frontend.)

## Common tasks

| Task | How |
|---|---|
| Make a section invisible temporarily | Pages → expand section → uncheck Visible → Save |
| Restore a section after hiding | same → check Visible → Save |
| Edit the launch promo code | Pages → programs → in `items[0]` change `code` value → Save |
| Update the CTA URL on a promo card | same → change `cta_url` → Save |
| Confirm the live website matches the CMS | Open `<website URL>/` in a new tab → DevTools → Network → reload → look at the `/api/public/pages/quoted_home` request body — that's exactly what the page is rendering |
| Find out who changed what | Sidebar → Audit Log → look for `page.section.update` or `site.config.update` actions |

## When to ask the developer

| Situation | Tell the developer |
|---|---|
| You want to edit a section that's not in CMS yet | Which page + section. They'll either add the binding (~30 min) or schedule it into the next milestone |
| The save button fails consistently | Send screenshot of toast + DevTools Network panel showing the failed request |
| The website doesn't match the CMS after 5 min | Send page URL + screenshot of admin showing the new content + screenshot of website showing the old |
| You want to add a new homepage section | Send the desired layout sketch. They'll add to the database + wire the front-end |

## Things you should never touch

See [`CEO_HANDOFF.md`](./CEO_HANDOFF.md) → "Do not touch" table.

## Reset to defaults

If you've made a series of edits and want to restore the seeded copy:

1. Open admin Pages → expand section
2. Look at `docs/CMS_USER_GUIDE.md` (this file) for the seed payload
3. Paste the original JSON back into the Payload box → Save

The original seed is in:
- `backend/omniplug/src/core/db/migrations/037_quoted_marketing_pages.sql` (hero)
- `backend/omniplug/src/core/db/migrations/038_quoted_marketing_programs.sql` (programs header)
- `backend/omniplug/src/core/db/migrations/039_quoted_marketing_programs_items.sql` (6 promo cards)
