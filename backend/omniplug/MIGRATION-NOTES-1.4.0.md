# Migration Notes 1.4.0

Upgrade path: OmniPlug CMS Core 1.3.x -> 1.4.0.

1. BREAKING: `CORS_ORIGIN` is required in production.
2. Set it before deploy:
   `CORS_ORIGIN=https://your-site.com,https://www.your-site.com`
3. Migration `011_platform_admin_role.sql` runs automatically on boot.
4. Migration 011 removes the DB CHECK constraint from `users.role`.
5. Role validation now lives in `src/core/lib/roles.js`.
6. Existing installs do not need to change users immediately.
7. Backward-compat remains: `admin` on tenant id 1 can manage tenants.
8. New role `platform_admin` is available for future operator accounts.
9. Optional upgrade:
   `node scripts/set-platform-admin.js --email=your@admin.com`
10. Reserved roles can be created: `customer`, `vendor`, `b2b_partner`.
11. Reserved roles cannot login yet.
12. Reserved role login returns `403 ROLE_LOGIN_NOT_ENABLED`.
13. Audit log pruning runs on startup.
14. Default retention is `AUDIT_LOG_RETENTION_DAYS=180`.
15. Uploads above 25MP are rejected.
16. No dependency upgrade is required.
