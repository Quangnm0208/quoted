# Spaghetti Audit

## Release Status

The v1.2.0 audit removed SQL access from previously high-risk controllers and
routed it through repository modules. OmniPlug CMS Core v1.4.4 preserves these
boundaries; no new direct SQL access has been introduced in the v1.3.x or
v1.4.x releases.

## Guardrails

- `npm run lint` blocks SQL double-quoted string literals.
- `npm run lint` blocks unsafe top-level prepared statement patterns.
- `scripts/verify-schema.js` blocks foreign key drift and missing tenant/admin bootstrap.
- New modules must follow the controller/service/repository/schema/policy pattern documented in `docs/MODULE_PACKAGING.md`.

## Deferred Debt

Validation and some audit orchestration still live in older controllers. This does not block the current release (v1.4.4) because tenant scoping, startup safety and repository boundaries are in place. Future refactors should move those workflows into service modules one module at a time.
