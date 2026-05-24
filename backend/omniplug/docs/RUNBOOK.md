# Runbook

## Health

```bash
curl https://omniplug-cms-prod.fly.dev/api/health
```

Expected product response:

```json
{"status":"ok","version":"1.4.4","product":"OmniPlug CMS Core"}
```

## Startup Failure

1. Check logs:

```bash
flyctl logs --app omniplug-cms-prod
```

2. Run schema verification:

```bash
flyctl ssh console --app omniplug-cms-prod -C "node /app/scripts/verify-schema.js"
```

3. Confirm migrations:

```bash
flyctl ssh console --app omniplug-cms-prod -C "sqlite3 /app/data/cms.db 'SELECT filename FROM schema_migrations ORDER BY filename;'"
```

## Tenant Domain

Production tenant resolution is strict. Unknown hosts return tenant not found. Set the default tenant domain through:

```env
TENANT_DEFAULT_DOMAIN=omniplug-cms-prod.fly.dev
```

Bootstrap priority:

```text
TENANT_DEFAULT_DOMAIN
BACKEND_PUBLIC_DOMAIN
PUBLIC_BACKEND_DOMAIN
FLY_APP_NAME -> <app>.fly.dev
localhost only in development/test
```

## Recovery

- If migrations fail, do not start the server.
- If schema verification fails, inspect the failed check and restore from the latest backup if needed.
- If a deploy breaks runtime behavior, roll back the Fly release and keep the volume intact.

## Platform Admin (v1.4+)

v1.4 them role `platform_admin` thay the pattern cu (admin@tenant-id-1).
Backward compat: installs cu chay binh thuong. Migrate khi tien:

```bash
flyctl ssh console --app omniplug-cms-prod -C \
  "node /app/scripts/set-platform-admin.js --email=your@admin.com"
```

## RBAC Roles (v1.4)

Active (login enabled): `admin`, `editor`, `platform_admin`

Reserved (login blocked den v1.5):
  `customer`, `vendor`, `b2b_partner`

Admin co the tao user voi reserved role. User ton tai trong DB nhung
login tra `403 ROLE_LOGIN_NOT_ENABLED` cho den khi v1.5 enable portal.

De tat role: bo khoi LOGIN_ENABLED_ROLES trong roles.js.
KHONG bo khoi ALL_ROLES - co the mat data.
