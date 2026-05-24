# Phase 2 Roadmap Boundaries

OmniPlug CMS Core v1.4.4 is the current stable line — a lightweight SQLite CMS/API
core with operator-signed license JWTs, API-key gating, plan-based soft-lock,
and forced attribution. This document records future candidates so they do not
leak into the v1.4.4 runtime.

## v1.4.4 Freeze

v1.4.4 must stay on:

```text
SQLite
Fly.io persistent volume
Docker
Local backup/restore
Public CMS APIs
Admin APIs
No paid infrastructure requirement
```

## Deferred Candidates

These items require a separate product decision, cost check and test plan before
implementation:

```text
PostgreSQL migration
Public SDK package
API keys
Webhooks
CRM sync
Email provider integration
Module marketplace
Advanced search or vector retrieval
Workflow automation
Billing
Enterprise RBAC
```

## PostgreSQL Trigger

Do not add a PostgreSQL driver in v1.4.4. Revisit only when one of these is true:

```text
SQLite lock contention is observed in production.
The product needs cross-region writes.
The app needs reporting queries that hurt request latency.
Operational backups require managed point-in-time restore.
```

Until then, SQLite plus verified backups is the operating model.

## Cost Rule

Phase 2 work must preserve a free or low-cost default path. Paid services may be
documented as optional upgrades, never as a requirement for the core package.
