# Backup Restore

Backups use the SQLite CLI inside the production container.

## Backup

```bash
npm run backup
```

On Fly.io:

```bash
flyctl ssh console --app omniplug-cms-prod -C "/app/scripts/backup.sh"
```

Backups are written to `BACKUP_DIR`, which defaults to `./backups` locally and `/app/backups` in Docker.

## Restore

```bash
npm run restore -- ./backups/<backup-file>
```

On Fly.io:

```bash
flyctl ssh console --app omniplug-cms-prod -C "/app/scripts/restore.sh /app/backups/<backup-file>"
```

After restore:

```bash
node src/core/db/migrate.js
node scripts/verify-schema.js
```
