# Admin Structure Spec — v0.7.1

> Final group-by-group spec of the v0.7.1 sidebar after the v0.7.0 → v0.7.1 restructure.
> Per master prompt §6 (information architecture rule).

## 5 sidebar groups, one purpose each

```
┌──────────────────────────────────────────────────────────────┐
│  Sidebar group     │  Answers the question                   │
├──────────────────────────────────────────────────────────────┤
│  (top — implicit)  │  What's the operator's primary view?    │
│  Quoted SaaS       │  Who bought, who's active, how used?    │
│  CMS               │  What content do we publish?            │
│  Marketing Admin   │  How do we sell + position the product? │
│  System            │  How is the admin system configured?    │
└──────────────────────────────────────────────────────────────┘
```

## Group 1 — (top, no header)

| Item | Route | Backend | Renderer | Status |
|---|---|---|---|---|
| Quoted Dashboard | `/admin/quoted-dashboard.html` | `GET /api/admin/quoted/dashboard` | `renderQuotedDashboard` | ✅ live |

The first thing the operator sees on login. Real KPIs: MRR, ARR, total revenue, customer count, active subs, WP sites, bot crawls 7d.

## Group 2 — Quoted SaaS

> Operational view of the paying customer base + product usage.

| Item | Route | Backend | Renderer | Status |
|---|---|---|---|---|
| Customers | `/admin/customers.html` | `GET /api/admin/quoted/customers` | `renderCustomers` | ✅ |
| Subscriptions | `/admin/subscriptions.html` | `GET /api/admin/quoted/subscriptions` | `renderSubscriptions` | ✅ |
| Licenses | `/admin/license.html` | `GET /api/admin/license/status` | `renderLicense` | ✅ |
| WP Sites | `/admin/wp-sites.html` | `GET /api/admin/quoted/wp-sites` | `renderWpSites` | ✅ (+ revoke button per row) |
| Bot Crawls | `/admin/bot-crawls.html` | `GET /api/admin/quoted/bot-crawls` | `renderBotCrawls` | ✅ |
| Synced Posts | `/admin/posts.html` | `GET /api/admin/quoted/posts` | `renderQuotedPosts` | ✅ |
| Webhook Events | `/admin/webhook-events.html` | `GET /api/admin/quoted/webhook-events` | `renderWebhookEvents` | ✅ |

**Unchanged from v0.7.0.** No relabeling, no regrouping.

## Group 3 — CMS (NEW group split)

> Editorial / publishing surface for normal website content.

| Item | Route | Backend | Renderer | Status |
|---|---|---|---|---|
| Posts / Articles | `/admin/articles.html` | `GET /api/admin/articles` | `renderArticles` | ✅ v0.7.0 — full editor with SEO panel + schedule + draft/publish/archive |
| Media Library | `/admin/media.html` | `GET /api/admin/media` | `renderMedia` | ✅ read-only listing; upload UI = v0.7.1 (deferred to a separate PR) |

Items hidden until built (per master prompt §5 "do not create blank broken pages"): Categories, Tags, Authors, dedicated SEO page, Sitemap/RSS, dedicated Drafts page (filter on Posts works).

## Group 4 — Marketing Admin (NEW group split)

> Commercial / conversion surfaces — the product-selling side of the admin.

| Item | Route | Backend | Renderer | Status |
|---|---|---|---|---|
| Product Pages | `/admin/pages.html` | `GET /api/admin/pages` | `renderPagesAdmin` | ✅ (homepage `quoted_home` hero, programs section) |
| Landing Sections | `/admin/sections.html` | `GET /api/admin/pages` | `renderSectionsAdmin` | ✅ flat view of all sections across all pages |
| Leads | `/admin/leads.html` | `GET /api/admin/leads` | `renderLeads` | ✅ read-only with PII masking for community plan |

Items hidden until built: Pricing Plans (env-driven), Promotion Cards (covered by Landing Sections), Checkout Links (env-driven), Testimonials, FAQs, Changelog, Documentation, Campaigns, Announcement Bar.

## Group 5 — System

> Internal admin / infrastructure / legacy.

| Item | Route | Backend | Renderer | Status |
|---|---|---|---|---|
| OmniPlug Dashboard | `/admin/dashboard.html` | aggregated counts | `renderDashboard` | ✅ generic KPI view (vs Quoted-specific dashboard at top) |
| Settings | `/admin/site.html` | `GET/PUT /api/admin/site` | `renderSite` | ✅ key-value config editor |
| Admin Users | `/admin/users.html` | `GET /api/admin/users` | `renderUsers` | ✅ read-only listing |
| Tenants | `/admin/tenants.html` | `GET /api/admin/tenants` | `renderTenants` | ✅ single-tenant for Quoted |
| Audit Log | `/admin/audit.html` | `GET /api/admin/audit` | `renderAudit` | ✅ |
| Projects (OmniPlug) | `/admin/projects.html` | `GET /api/admin/projects` | `renderProjects` | ⚠️ legacy OmniPlug vertical feature; Quoted doesn't use; kept for upstream parity |

## Permissions per master prompt §13

Current system has admin-only access (no granular RBAC). Sidebar items are NOT permission-filtered for v0.7.1 — every logged-in admin sees the full sidebar. Per master prompt: "Do not introduce a full RBAC system in this release."

Tenant isolation IS enforced server-side: tenant admins (non-platform) get 403 on `/api/admin/quoted/*` per `requirePlatformAdmin` middleware shipped in v0.6.2.

## Route compatibility per master prompt §10

**All v0.7.0 routes unchanged.** Zero aliases needed. Bookmarks work. Direct refresh works. The only changes are:
- `navGroups[]` order in `shell.js` (visual sidebar order)
- `label` strings inside `navGroups[]` items (display text)

API routes, backend logic, database, page renderers, data-page attributes on HTML shells — all 100% unchanged.

## Label changes (display only)

| Old display | New display |
|---|---|
| Blog Articles | Posts / Articles |
| Pages (hero, promos) | Product Pages |
| Sections (flat) | Landing Sections |
| Site Settings | Settings |

Internal `id` (`articles`, `pages`, `sections`, `site`) unchanged so the active-route highlighting logic continues to work.
