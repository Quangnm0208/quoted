# 02 — Final CMS Model

> **Canonical design doc:** [`CMS-FRONTEND-INTEGRATION.md`](./CMS-FRONTEND-INTEGRATION.md) — has the full architecture, milestone roadmap, and rationale.
> This file is the model-status table only.

## Model status (v0.5.0)

The CMS reuses **OmniPlug CMS Core v1.4.4 models** (vendored) — no new tables were invented; only seed rows added.

| Model | OmniPlug table | Admin Editable | Public API | Front-end Used By | Status |
|---|---|---|---|---|---|
| **SiteSettings** | `site_config` (key/value/label/description per tenant) | Yes (M2 — `/admin/site.html` real PUT) | `GET /api/public/site` | Not yet wired to header/footer | ⏳ M5 wiring |
| **Page** | `page_sections` grouped by `page_key` | Yes (M2 — `/admin/pages.html`) | `GET /api/public/pages/:pageKey` | `frontend/index.html` (`quoted_home`) | ✅ |
| **Section** | `page_sections` row (key/type/title/subtitle/payload_json/sort_order/is_visible) | Yes (M2 — list + edit per page) | inline in `pages/:pageKey` response | hero + programs on home | ✅ for 2 sections; M3 for 8 more |
| **MediaAsset** | `media` table (filename/url/mime/size/alt/folder) | List only (read-only banner — M6 for upload UI) | `GET /uploads/*` (static) | Not used on marketing yet | ⏳ M6 |
| **NavigationItem** | not modelled | — | — | header/footer nav hardcoded | ⏳ M5 (will add `nav_items` migration) |
| **PricingPlan** | exists in `commerce/plans` module (provider variant IDs) | Read via `/api/products/plans`; edit via env (variant IDs) not CMS | `GET /api/products/plans` | pricing.html (static), success.html | ⏳ M3 — pricing.html still static |
| **FAQ** | not modelled separately (could reuse `page_sections` with `component_type='faq'`) | No dedicated UI yet | — | faq.html static | ⏳ M3 |
| **DocumentationCategory** + **DocumentationArticle** | `articles` table covers this | List read-only in `/admin/articles.html` | `GET /api/public/articles` | docs.html static (not consuming articles yet) | ⏳ M4 |
| **ChangelogEntry** | not modelled separately | No dedicated UI yet | — | changelog.html static | ⏳ M4 |
| **Testimonial** | could reuse `page_sections` items[] | No | — | static block on home | ⏳ M3 |
| **Lead** | `leads` table | Read-only with masking for community plan | `POST /api/public/leads` | not wired in marketing site yet | ⏳ when contact form added |
| **License** + **Entitlement** | `licenses` + `entitlements` (commerce module) | Read-only status panel | `GET /api/admin/license/status` | n/a (internal) | ✅ |
| **WebhookEvent** | `webhook_events` (commerce module) | Not visible in admin (audit log shows action) | n/a | n/a (internal) | ✅ |
| **AuditLog** | `audit_log` | Read-only viewer (M2) | n/a | n/a (internal) | ✅ |

## Section types supported (today)

The `page_sections.component_type` column accepts these per OmniPlug `pages.controller.js`:

```
hero_banner, rich_text, stat_grid, cta_block, gallery_block, feature_list, project_card_list
```

Quoted-specific section types reusing these:
- Hero → `hero_banner`
- Programs header → `rich_text` (with `payload.items[]` for the 6 cards)

If a richer model is needed (e.g. `pricing_plans_grid` as a first-class type), add to `COMPONENT_TYPES` array in `pages.controller.js`. None needed for v0.5.0.

## Old-domain residue

Per [`01_MOCKUP_AUDIT.md`](./01_MOCKUP_AUDIT.md): zero real-estate residue in production routes / user-facing UI / database / API. The OmniPlug `industries/real-estate.js` library file is vendored upstream code, not referenced anywhere in Quoted.
