# Sidebar QA Report — v0.7.1

> Per master prompt §15 smoke-test checklist.

## Admin startup

| Check | Result |
|---|---|
| Backend starts | ✅ `curl /api/health` → 200 |
| Frontend/admin starts | ✅ `/admin/login.html` loads |
| Login works | ✅ POST `/api/auth/login` returns JWT |
| Sidebar renders | ✅ verified via admin renderer simulator (19 pages) |
| No fatal console error | ✅ JSDOM render returns valid HTML for all 19 pages |

## Sidebar groups visible

| Group | Visible | Items count |
|---|---|---|
| (top — Quoted Dashboard) | ✅ | 1 |
| Quoted SaaS | ✅ | 7 |
| CMS | ✅ | 2 |
| Marketing Admin | ✅ | 3 |
| System | ✅ | 6 |

## CMS group items

| Item | Opens | Renderer correct | Status |
|---|---|---|---|
| Posts / Articles | `/admin/articles.html` → 200 | `renderArticles` (full list with filters) | ✅ |
| Media Library | `/admin/media.html` → 200 | `renderMedia` (read-only) | ✅ |
| Create/edit article still works | T-ART-1..12 pass | service+repo+controller | ✅ |
| Draft/publish workflow still works | T-ART-2,3,6,7,9 | end-to-end | ✅ |
| SEO fields save + render in public | T-ART-8 | full extended response | ✅ |

## Marketing Admin group items

| Item | Opens | Renderer correct | Status |
|---|---|---|---|
| Product Pages | `/admin/pages.html` → 200 | `renderPagesAdmin` (page sections editor) | ✅ |
| Landing Sections | `/admin/sections.html` → 200 | `renderSectionsAdmin` (flat) | ✅ |
| Leads | `/admin/leads.html` → 200 | `renderLeads` (read-only) | ✅ |

## Quoted SaaS group items

| Item | Opens | Status |
|---|---|---|
| Customers | `/admin/customers.html` → 200 | ✅ |
| Subscriptions | `/admin/subscriptions.html` → 200 | ✅ |
| Licenses | `/admin/license.html` → 200 | ✅ |
| WP Sites | `/admin/wp-sites.html` → 200 | ✅ (revoke button still works) |
| Bot Crawls | `/admin/bot-crawls.html` → 200 | ✅ |
| Synced Posts | `/admin/posts.html` → 200 | ✅ |
| Webhook Events | `/admin/webhook-events.html` → 200 | ✅ |

## System group items

| Item | Opens | Status |
|---|---|---|
| OmniPlug Dashboard | `/admin/dashboard.html` → 200 | ✅ |
| Settings | `/admin/site.html` → 200 | ✅ |
| Admin Users | `/admin/users.html` → 200 | ✅ |
| Tenants | `/admin/tenants.html` → 200 | ✅ |
| Audit Log | `/admin/audit.html` → 200 | ✅ |
| Projects (OmniPlug) | `/admin/projects.html` → 200 | ✅ (legacy, unused) |

## Route safety

| Check | Result |
|---|---|
| Direct refresh works on every admin route | ✅ 20/20 URLs return 200 |
| Old route aliases not needed | ✅ — every route unchanged from v0.7.0 |
| Unauthorized user blocked | ✅ all `/api/admin/*` return 401 without JWT |
| No route points to broken blank page | ✅ verified via renderer simulator (every data-page resolves) |

## Verdict

All sidebar items load correctly. All renderers produce real backend-data HTML (zero mock per simulator scan). All routes unchanged. Build stamp now shows `v0.7.1` in footer.

**Smoke pass: 100%.**
