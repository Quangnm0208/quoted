# Migration Playbook

1. Back up the database.
2. Run `node src/core/db/migrate.js`.
3. Run `node scripts/verify-schema.js`.
4. Check `/api/health`.
5. Keep rollback path available through the latest backup and Fly.io release.
