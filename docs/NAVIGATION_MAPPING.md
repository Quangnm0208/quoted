# Navigation Mapping — v0.7.0 → v0.7.1

> Per master prompt §16 Step 2.
> Decision table BEFORE code edit.

## Master rule (master prompt §3 hard rules)

- Do not rewrite the whole admin
- Do not break existing routes
- Move labels/grouping only; keep routes unchanged
- No DB / API / page rewrites

## Group decisions (master prompt §6 IA rule)

| Question | New group |
|---|---|
| What content do we publish on the website? | **CMS** |
| How do we sell and position the product? | **Marketing Admin** |
| Who bought, who is active, how is product used? | **Quoted SaaS** |
| How is admin system configured? | **System** |

## Per-item migration table

| Current Label (v0.7.0) | Current Route | API Source | Old Group | New Group | New Label | Keep Route? | Alias Needed? | Risk |
|---|---|---|---|---|---|---|---|---|
| Quoted Dashboard | /admin/quoted-dashboard.html | /api/admin/quoted/dashboard | (top) | (top) | Quoted Dashboard | ✅ unchanged | — | none |
| Customers | /admin/customers.html | /api/admin/quoted/customers | Quoted SaaS | Quoted SaaS | Customers | ✅ unchanged | — | none |
| Subscriptions | /admin/subscriptions.html | /api/admin/quoted/subscriptions | Quoted SaaS | Quoted SaaS | Subscriptions | ✅ unchanged | — | none |
| Licenses | /admin/license.html | /api/admin/quoted/licenses | Quoted SaaS | Quoted SaaS | Licenses | ✅ unchanged | — | none |
| WP Sites | /admin/wp-sites.html | /api/admin/quoted/wp-sites | Quoted SaaS | Quoted SaaS | WP Sites | ✅ unchanged | — | none |
| Bot Crawls | /admin/bot-crawls.html | /api/admin/quoted/bot-crawls | Quoted SaaS | Quoted SaaS | Bot Crawls | ✅ unchanged | — | none |
| Synced Posts | /admin/posts.html | /api/admin/quoted/posts | Quoted SaaS | Quoted SaaS | Synced Posts | ✅ unchanged | — | none |
| Webhook Events | /admin/webhook-events.html | /api/admin/quoted/webhook-events | Quoted SaaS | Quoted SaaS | Webhook Events | ✅ unchanged | — | none |
| **Blog Articles** | /admin/articles.html | /api/admin/articles | Marketing CMS | **CMS** | **Posts / Articles** | ✅ unchanged | — | label change only |
| **Media Library** | /admin/media.html | /api/admin/media | Marketing CMS | **CMS** | **Media Library** | ✅ unchanged | — | group change only |
| Pages (hero, promos) | /admin/pages.html | /api/admin/pages | Marketing CMS | **Marketing Admin** | **Product Pages** | ✅ unchanged | — | label + group change |
| Sections (flat) | /admin/sections.html | /api/admin/pages | Marketing CMS | **Marketing Admin** | **Landing Sections** | ✅ unchanged | — | label + group change |
| Leads | /admin/leads.html | /api/admin/leads | Marketing CMS | **Marketing Admin** | **Leads** | ✅ unchanged | — | group change only |
| Site Settings | /admin/site.html | /api/admin/site | Marketing CMS | **System** | **Settings** | ✅ unchanged | — | per master §5 sidebar spec, Settings → System |
| OmniPlug Dashboard | /admin/dashboard.html | /api/admin/* aggregate | System | System | OmniPlug Dashboard | ✅ unchanged | — | none |
| Admin Users | /admin/users.html | /api/admin/users | System | System | Admin Users | ✅ unchanged | — | none |
| Tenants | /admin/tenants.html | /api/admin/tenants | System | System | Tenants | ✅ unchanged | — | none |
| Audit Log | /admin/audit.html | /api/admin/audit | System | System | Audit Log | ✅ unchanged | — | none |
| Projects (OmniPlug) | /admin/projects.html | /api/admin/projects | System | System | Projects (OmniPlug) | ✅ unchanged | — | none (legacy; unused in Quoted) |

## Items master-prompt requested but NOT implemented yet — strategy per §5

> Master prompt §5: "If the current system does not yet have all submodules, show only the modules that are already implemented and do not create blank broken pages."

| Master prompt item | Current state | Strategy |
|---|---|---|
| CMS → Categories | not implemented (no table) | **Hide** — defer to v0.7.2; don't add broken page |
| CMS → Tags | not implemented | **Hide** — same |
| CMS → SEO (dedicated page) | inline in article editor (v0.7.0) | **Hide as separate page** — already accessible from article editor SEO panel |
| CMS → Sitemap/RSS | `/sitemap.xml` + `/feed.xml` already public at root | **Hide as menu item** — direct URL accessible; not an editable page |
| CMS → Preview/Drafts | filterable in Articles list already | **Hide** — `/admin/articles.html?status=draft` does this |
| Marketing Admin → Pricing Plans | env-driven (LS variants) | **Hide** — operator changes via flyctl secrets per `GO_LIVE_GUIDE.md`; UI editor risky for billing |
| Marketing Admin → Promotion Cards | edited via Sections → `programs` payload `items[]` | **Hide as separate page** — covered by Landing Sections editor (Pages → quoted_home → programs) |
| Marketing Admin → Testimonials | static HTML on home today | **Hide** — defer to v0.7.2 when wired to CMS |
| Marketing Admin → FAQs | static HTML on faq.html today | **Hide** — defer |
| Marketing Admin → Changelog | docs/CHANGELOG.md (dev), changelog.html static | **Hide** — defer |
| Marketing Admin → Documentation | docs.html static | **Hide** — defer |
| Marketing Admin → Checkout Links | env-driven `LEMONSQUEEZY_CHECKOUT_*` | **Hide** — same reason as Pricing Plans |

## Final sidebar structure (v0.7.1)

```
(top — implicit group)
- Quoted Dashboard

Quoted SaaS                       ← unchanged
- Customers
- Subscriptions
- Licenses
- WP Sites
- Bot Crawls
- Synced Posts
- Webhook Events

CMS                               ← NEW group (split from Marketing CMS)
- Posts / Articles                  ← was "Blog Articles"
- Media Library                     ← was Marketing CMS → Media Library

Marketing Admin                   ← NEW group (split from Marketing CMS)
- Product Pages                     ← was "Pages (hero, promos)"
- Landing Sections                  ← was "Sections (flat)"
- Leads

System                            ← unchanged + Site Settings moved here
- OmniPlug Dashboard
- Settings                          ← was Marketing CMS → Site Settings
- Admin Users
- Tenants
- Audit Log
- Projects (OmniPlug)
```

## Routes unchanged

**Every route stays at the same URL.** No aliases needed. Bookmarks work. Old admin links work. The page-content.js renderer registration keys (`pages`, `sections`, `articles`, `media`, `site`, `leads`, `users`, etc.) all stay the same.

This is the lowest-risk implementation: zero route changes, zero API changes, zero DB changes — purely a label + group reshuffle in `shell.js::renderShell()`.

## Per-master-prompt §15 UX copy

| Old label | New label | Reason |
|---|---|---|
| "Blog Articles" | "Posts / Articles" | Matches master prompt §5 preferred label |
| "Pages (hero, promos)" | "Product Pages" | Master prompt §15 preferred label list |
| "Sections (flat)" | "Landing Sections" | Master prompt §15 preferred label list |
| "Site Settings" | "Settings" | Concise, matches master prompt §5 sidebar spec |

## Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Operator bookmarks old "Marketing CMS → Pages" sidebar position | Low | URL unchanged, just visual grouping moved |
| Active-route highlighting breaks | Low | Highlighting uses `id` field which is unchanged for all items |
| Renderer dispatch fails | None | `data-page` attributes unchanged on each HTML file |
| Test suite breaks | None | npm test asserts API behavior, not sidebar position |
| Cold-start ZIP fails | None | Only `shell.js` changes; no DB / migration / API touched |

## Implementation files

| File | Change scope | Risk |
|---|---|---|
| `backend/omniplug/src/cms/admin/assets/shell.js` | `navGroups` array reshuffled + relabeled | Low — only this file |
| (none other) | — | — |

Single file edit. ~30 lines changed.
