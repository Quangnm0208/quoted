# Deploy Fly

## Create App

```bash
flyctl apps create omniplug-cms-prod --org personal
```

## Create Volume

```bash
flyctl volumes create cms_data --size 1 --region sin --app omniplug-cms-prod
```

The volume is mounted by `fly.toml`:

```toml
[mounts]
source = "cms_data"
destination = "/app/data"
```

## Set Secrets

```bash
flyctl secrets set JWT_SECRET=replace-with-32-plus-random-chars --app omniplug-cms-prod
flyctl secrets set ADMIN_EMAIL=admin@omniplug.local --app omniplug-cms-prod
flyctl secrets set ADMIN_INITIAL_PASSWORD=ChangeMe123! --app omniplug-cms-prod
```

Do not put secrets in `fly.toml`.

## Deploy

```bash
flyctl deploy --app omniplug-cms-prod --strategy bluegreen
```

## Verify

```bash
curl https://omniplug-cms-prod.fly.dev/api/health

flyctl ssh console --app omniplug-cms-prod -C "node /app/scripts/verify-schema.js"

flyctl ssh console --app omniplug-cms-prod -C "sqlite3 /app/data/cms.db 'SELECT filename FROM schema_migrations ORDER BY filename;'"
```

Expected:

```text
status ok
version 1.4.4
schema verification passed
migrations applied
tenant domain set
```

## Backup

```bash
flyctl ssh console --app omniplug-cms-prod -C "/app/scripts/backup.sh"
```

## Rollback

```bash
flyctl releases list --app omniplug-cms-prod
flyctl releases rollback <version> --app omniplug-cms-prod
```
