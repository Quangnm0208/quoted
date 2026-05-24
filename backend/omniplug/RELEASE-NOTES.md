# OmniPlug CMS Core v1.4.0 Release Notes

OmniPlug CMS Core v1.4.0 is a security hardening and RBAC foundation release.
It does not enable customer, vendor or partner portal behavior.

## Breaking Change

`CORS_ORIGIN` is now required when `NODE_ENV=production`. Set it before deploy:

```bash
flyctl secrets set CORS_ORIGIN=https://your-site.com,https://www.your-site.com
```

Development still defaults to localhost origins.

## Security Hardening

- GitHub audit gate now fails only high+ vulnerabilities.
- Fly VM memory moves from 256MB to 512MB.
- Upload pixel limit drops from 50MP to 25MP to reduce Sharp OOM risk.
- bcrypt default rounds move from 12 to 10 for shared-cpu responsiveness.
- audit_log prunes old rows on startup using AUDIT_LOG_RETENTION_DAYS.
- SDK `data-cms-html` strips scripts, risky embeds and event handlers before injection.

## RBAC Foundation

Migration 011 removes the DB CHECK constraint on `users.role`. Role validity now
lives in `src/core/lib/roles.js`.

Active login roles: `admin`, `editor`, `platform_admin`.

Reserved roles: `customer`, `vendor`, `b2b_partner`. Admins can create these
users, but login returns `403 ROLE_LOGIN_NOT_ENABLED` until v1.5 portal work.

Existing installs keep working. The old tenant-1 admin platform-admin pattern is
still accepted. Use `scripts/set-platform-admin.js` later when convenient.

## Deploy Checklist

- Set production CORS_ORIGIN before deploy.
- Let migration 011 auto-run during startup.
- Review AUDIT_LOG_RETENTION_DAYS if 180 days is not desired.
- Optional: upgrade an operator user with `node /app/scripts/set-platform-admin.js`.
