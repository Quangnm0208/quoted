# 04 — CMS Admin Handoff

> **Canonical operator guide:** [`CMS-CEO-GUIDE.md`](./CMS-CEO-GUIDE.md).
> This file is the admin-functionality status matrix only.

## Per-page admin status (v0.5.0)

All entries verified by `/tmp/admin-render-test.mjs` simulator (13/13 pass) + manual edit-and-verify loops.

| Admin Area | URL | Real Save? | Front-end Updates? | Status | Notes |
|---|---|---|---|---|---|
| Dashboard | `/admin/dashboard.html` | n/a | n/a | ✅ live counts | Users/Tenants/Sections/Audit/Leads/Site/License real numbers from DB |
| Pages | `/admin/pages.html` | ✅ PATCH `/api/admin/pages/sections/:id` | ✅ verified live | ✅ M2 | Edit Title/Subtitle/Payload JSON/Visible toggle per section |
| Sections | `/admin/sections.html` | ✅ same handler | ✅ verified live | ✅ M2 | Flat view across all `page_key`s |
| Site Settings | `/admin/site.html` | ✅ PUT `/api/admin/site/:key` | ⏳ not wired into header/footer | ✅ save works, ⏳ M5 for frontend wiring | Edit value per config key |
| Media | `/admin/media.html` | ❌ list only | n/a | ⏳ M6 | Upload via API works (curl `POST /api/admin/media` multipart) but UI is read-only with banner |
| Leads | `/admin/leads.html` | ❌ read-only | n/a | ✅ display only | Mask applied for Community plan per license tier |
| Articles | `/admin/articles.html` | ❌ list only | n/a | ⏳ M4 | WP plugin syncs articles via SDK; CMS just shows them |
| Projects | `/admin/projects.html` | ❌ list only | n/a | n/a Quoted not using | OmniPlug vertical feature; empty for Quoted |
| Users | `/admin/users.html` | ❌ read-only | n/a | ⏳ M7 | API supports POST/PATCH; UI is M7 |
| Tenants | `/admin/tenants.html` | ❌ read-only | n/a | ⏳ M7 | Single tenant for Quoted today |
| Audit Log | `/admin/audit.html` | n/a | n/a | ✅ live | Every save/login/webhook recorded with timestamp + user + IP |
| License | `/admin/license.html` | ❌ status only | n/a | ⏳ activate via API | Shows current plan; activate via `POST /api/admin/license/activate` (operator action, rare) |

## Admin UX guarantees (delivered in M2 / M2.1)

| Guarantee | Implementation |
|---|---|
| Business-friendly labels | All renderers use Vietnamese/English labels (no `field_name_lowercase` jargon shown to operator) |
| Real save (no fake controls) | Every visible Save button calls a real endpoint; bad JSON rejected client-side BEFORE hitting API |
| Success/failure toast | `shell.js::toast()` for global feedback + inline `[data-save-msg]` per row |
| Draft/published status | `is_visible` toggle on sections; published status visible as badge |
| Preview link | Each `quoted_home` section can be previewed by hard-refreshing `/` (60s cache header) |
| Clear validation | JSON parse errors shown inline with red text + global toast |
| Advanced/system area separation | System pages (Users/Tenants/Audit/License) grouped in sidebar; read-only banners flag deferred write UI |
| No fake controls | Articles/Projects/Media/Users/Tenants/Audit/License all show real DB data; write UI marked "M3+" via banner |
| Visible build stamp | Sidebar footer shows `vX.Y.Z · admin build M2.1` from `/api/health` |
| Cache-busted | `/admin/*` static sends `Cache-Control: no-cache, must-revalidate` |

## CEO daily-task map

| Task | Where | Click path |
|---|---|---|
| Edit homepage hero copy | Pages | Login → Pages → `quoted_home` → expand `hero` card → edit Subtitle / Payload JSON → Save |
| Edit promotion card headline | Pages | same → expand `programs` → in Payload JSON find `items[N].title` → edit → Save |
| Toggle a section off temporarily | Pages | uncheck Visible → Save → refresh website (60s cache) |
| Add a new homepage section | curl/SQL today | `POST /api/admin/pages/quoted_home/sections` — admin form for this is M3 |
| Change site contact email | Site Settings | find `contact.email` row → edit Value → Save |
| Replace logo | n/a | Static asset today — M5 will move to Site Settings + media picker |
| See who changed what | Audit Log | scroll list, filter by action prefix (`page.section.update`, `site.config.update`, `auth.login.success`) |
| Activate a backend license | `POST /api/admin/license/activate` body `{license_jwt:"..."}` | Issued by OmniPlug Engineering; rare |

## What CEO must NOT touch

Documented in [`CMS-CEO-GUIDE.md`](./CMS-CEO-GUIDE.md) "What to never touch" section:
1. `component_type` of an existing section (frontend binds to type-specific structure)
2. `section_key` after first publish (frontend binds via `data-cms="<key>.<field>"`)
3. Tenant settings (multi-tenant plumbing)
4. License / API keys / payment settings (production billing depends on these)
