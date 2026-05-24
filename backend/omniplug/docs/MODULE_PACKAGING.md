# Module Packaging

OmniPlug CMS Core keeps operational modules in core and packages business capabilities around stable API boundaries.

## Core Modules

Core modules are always on:

```text
Auth
Tenancy
Users
RBAC
Audit
Site Config
Health
Migration
Backup/Restore
```

## Business Modules

Business modules can be packaged by market need while still running in the same core:

```text
Content Module: articles, pages, page sections, SEO fields
Project Module: projects, milestones, gallery
Lead Module: lead forms, lead inbox
Media Module: upload, image processing, usage tracking
```

## Future Extension Modules

The roadmap below tracks future modules. Status as of v1.4.4:

- **API keys** — IMPLEMENTED in v1.4.4 (`/api/v1/*` gating, see
  `src/core/middleware/apiKey.js` and `scripts/op-create-api-key.js`).
- **Webhooks** — placeholder, not implemented.
- **CRM sync** — placeholder, not implemented.
- **Email delivery** — placeholder, not implemented.

Placeholders are tracked in `docs/phase-2-roadmap.md` and remain unable to
affect startup:

```text
Integration Module (post-v1.4.4): webhooks, CRM sync, email delivery
SDK Module: public API client wrapper (separate repo)
```

## Business Packages

| Package | Includes | Target |
|---|---|---|
| Core CMS | Auth, Tenant, Admin, Site Config | internal base |
| Landing Pack | Pages, Leads, Media | landing pages |
| Real Estate Pack | Projects, Milestones, Gallery, Leads | real estate sites |
| Content Pack | Articles, SEO, Pages | blogs/content sites |
| Integration Pack | API keys, webhooks, CRM sync | Phase 2 candidate |
| SDK Pack | public API wrapper | Phase 2 candidate |

## Toggle Contract

```env
FEATURE_ARTICLES=true
FEATURE_PROJECTS=true
FEATURE_LEADS=true
FEATURE_MEDIA=true
FEATURE_SDK=false
FEATURE_WEBHOOKS=false
FEATURE_API_KEYS=false
FEATURE_CRM=false
```

Core modules default on. Future modules default off. Experimental modules must not affect startup.

## Module Pattern

New business modules follow this structure:

```text
modules/<module>/
  <module>.routes.js
  <module>.controller.js
  <module>.service.js
  <module>.repository.js
  <module>.schema.js
  <module>.policy.js
  README.md
```

Controllers parse requests, call services and return responses. Repositories own SQL and tenant-scoped data mapping. Services own business workflow and audit/event decisions.

The `kb/` directory is documentation for maintainers, not a runtime business
module. It must not add a vector store, agent process or extra infrastructure
to v1.4.4.
