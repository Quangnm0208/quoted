# OmniPlug CMS Core v1.4

OmniPlug CMS Core is a lightweight multi-tenant CMS/API engine for teams that want a stable backend core and freedom to build any frontend on top of it.

Official product name: **OmniPlug CMS Core v1.4.4**.

## Requirements

- **Node.js 22** (required — `>=22 <24`). Lower versions will fail `npm ci`
  due to engine constraints; Node 24+ has incompatible API changes.
  The repo ships `.nvmrc`, `.node-version`, and a `Dockerfile` that all
  pin Node 22.
- SQLite 3 (bundled via `better-sqlite3` native module — needs build tools
  on first install: `python3`, `make`, `g++`. Standard on Ubuntu/Debian
  via `apt install build-essential python3`. Docker image has these.)
- ~80 MB disk for `node_modules`, ~30 MB for runtime.

## Quick Start

```bash
# 1. Verify Node version
node --version          # must be v22.x
# If wrong: nvm use 22  (or fnm/volta/nodenv depending on tool)

# 2. Install dependencies
npm ci                  # respects package-lock.json exactly

# 3. Configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET, ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD,
#            CORS_ORIGIN (production-only), and optionally
#            TENANT_DEFAULT_DOMAIN

# 4. Run migrations + verify schema + start server
npm start
# Boots on :4000 by default. Override with PORT=8080.

# 5. (Optional) Run smoke test in another terminal
npm run test:smoke
```

## What Is Included

- Express API server with SQLite storage.
- Multi-tenant shared-schema model.
- Admin authentication, users, RBAC, audit log and tenant resolution.
- Public content APIs for site config, pages, articles, projects and leads.
- Media upload and usage tracking.
- Migration, schema verification, backup and restore scripts.
- Fly.io production packaging with Docker, `fly.toml` and runbooks.

## v1.4 Non-Goals

OmniPlug CMS Core v1.4.4 is intentionally small. It does not include
PostgreSQL, Redis, paid object storage, queues, billing, a visual page builder,
marketplace, workflow automation, AI agents or paid monitoring. SQLite remains
the default database for this release.

## Public API Surface

Frontend teams only need the API base URL, tenant host and media URL. They do not need internal database or schema knowledge.

```text
GET  /api/public/site
GET  /api/public/pages/:slug
GET  /api/public/articles
GET  /api/public/articles/:slug
GET  /api/public/projects
GET  /api/public/projects/:slug
POST /api/public/leads
GET  /api/health
```

Admin API:

```text
POST /api/auth/login
GET  /api/auth/me
GET/POST/PUT/PATCH/DELETE /api/admin/*
```

## Local Start

```bash
npm install
cp .env.example .env
npm start
```

`npm start` runs migrations, schema verification and then the server.

Health response:

```json
{
  "status": "ok",
  "version": "1.4.0",
  "product": "OmniPlug CMS Core",
  "vendor": "OmniPlug",
  "license": "PolyForm Noncommercial 1.0.0",
  "homepage": "https://omniplug.com"
}
```

## Production Start Contract

Docker and Fly.io use `scripts/start.sh`:

```sh
node src/core/db/migrate.js
node scripts/verify-schema.js
node src/backend/server.js
```

The server is not the migration owner. Production startup must complete migrations and schema verification before listening for traffic.

## Required Environment

Use `.env.example` as the base contract. Production secrets must be set outside source control:

```bash
flyctl secrets set JWT_SECRET=...
flyctl secrets set ADMIN_EMAIL=...
flyctl secrets set ADMIN_INITIAL_PASSWORD=...
```

## License

OmniPlug CMS Core is source-available under PolyForm Noncommercial 1.0.0.

- Free for: evaluation, education, internal experimentation, non-commercial use
- Commercial use requires a license — contact licensing@omniplug.com
- See LICENSE.txt for full terms
- See NOTICE.txt for attribution requirements

Removing copyright notices, attribution footers, or telemetry identification
violates the license.

## Telemetry

OmniPlug CMS Core sends an anonymous heartbeat to OmniPlug every 24 hours.
This helps us understand deployment patterns and prioritize fixes.

What is sent:
- Random instance UUID (generated on first boot, no PII)
- Version, Node.js version, NODE_ENV
- Active tenant count
- Default domain (TENANT_DEFAULT_DOMAIN or Fly app hostname)
- Timestamp

What is NOT sent:
- Customer or tenant content
- User accounts, emails, IPs
- Tenant slugs or names
- Any data from the application database beyond the counts above

Opt-out: set `TELEMETRY_ENABLED=false` in environment.

Failure mode: best-effort. Network failures are silent in production and
never affect application behavior.

## Documentation

- [Fly.io deploy guide](docs/DEPLOY_FLY.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [Runbook](docs/RUNBOOK.md)
- [Module packaging](docs/MODULE_PACKAGING.md)
- [SDK plan](docs/SDK-PLAN.md)
- [API contract](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Telemetry](docs/TELEMETRY.md)
- [Phase 2 roadmap boundaries](docs/phase-2-roadmap.md)
