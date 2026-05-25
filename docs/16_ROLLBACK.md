# 16 — Rollback

> Procedure for safely backing out a bad deploy.

## Decision tree — when to roll back

```
Deploy went out
  ↓
Smoke test passes?
  ├── YES → stay live; monitor 24h
  └── NO
       ├── Bug visible to customers? (P0/P1)
       │    ├── YES → ROLL BACK IMMEDIATELY (no investigation first)
       │    └── NO  → fix forward (hotfix deploy) if quick
       └── Customer data at risk?
            └── YES → ROLL BACK
```

**Rule:** rollback is cheap; debugging a broken production is expensive. Roll back first, investigate after.

## Backend rollback (Fly.io)

```bash
# Step 1 — list recent releases
flyctl releases -a quoted-api
# Output: v123 (2 min ago), v122 (yesterday), v121 (last week), ...

# Step 2 — pick last-known-good release ID
# Note the IMAGE_REF from `flyctl releases --json -a quoted-api | jq '.[0].ImageRef'`
flyctl deploy --image registry.fly.io/quoted-api:deployment-<OLD_RELEASE_ID> -a quoted-api

# Wait ~1-2 min, verify
curl https://api.quotedeasy.com/api/health
```

Fly keeps machine images for ~24 hours by default; older releases may not be redeployable. For longer retention, configure `[deploy.image_retention]` in `fly.toml`.

## Frontend rollback (Cloudflare Pages)

UI-driven:
1. Cloudflare dashboard → Pages → `quoted-marketing` → Deployments tab
2. Find the last working deployment (sorted by date)
3. Three-dot menu → **Rollback to this deployment**
4. Confirm

CLI-driven (optional, via Wrangler):
```bash
wrangler pages deployment list --project-name=quoted-marketing
wrangler pages deployment tail --project-name=quoted-marketing --deployment-id=<ID>
# rollback by re-uploading old build via wrangler pages publish
```

## Database rollback

**SQLite + Litestream** is configured for streaming replication; restore from a snapshot:

```bash
flyctl ssh console -a quoted-api
litestream restore -o /tmp/restored.db /app/data/cms.db
# inspect, then atomically swap
mv /app/data/cms.db /app/data/cms.db.broken
mv /tmp/restored.db /app/data/cms.db
exit
flyctl apps restart quoted-api
```

⚠️ Restoring DB rolls back **all data** since the snapshot point — orders, customers, license activations, etc. Only do this if the DB is corrupted or compromised. For simple "the schema changed and broke things" cases, prefer fixing forward via a new migration.

## Migration rollback

OmniPlug migrations are NOT auto-reversible (no `down.sql`). To "roll back" a migration:

1. Don't delete the row from `schema_migrations` — that would make the migrator re-apply on next boot.
2. Write a NEW migration `040_revert_039.sql` that does the inverse (e.g. `UPDATE page_sections SET payload_json = json_remove(payload_json, '$.items') WHERE …`)
3. Deploy the new migration normally.

For this product, migrations 037-039 are idempotent and additive — no realistic need to "roll back" them.

## Lemon Squeezy webhook rollback

Webhooks have **no rollback** — they're append-only events from LS. If a buggy handler caused incorrect entitlements:

1. Fix the handler code; deploy backend
2. Replay the bad webhooks via LS dashboard → Webhooks → History → click event → "Resend"
3. The new handler will process correctly (idempotency via `webhook_events` table prevents double-processing if the original succeeded)

## DNS rollback

If you accidentally pointed DNS to the wrong place:

1. Cloudflare DNS → revert the record (edit value)
2. TTL is usually `Auto` (~5 min) — change propagates quickly
3. Pages/Fly customer domain bindings remain intact

## Communications

If rollback affects customers:
- **>15 min downtime:** send status page update + email customers
- **<15 min:** silent rollback usually fine
- **Data loss/corruption:** must email affected customers within 24h with explanation + remediation

## Drill schedule

Recommended once a quarter:
- Deploy a no-op release
- Practice rollback within 5 minutes
- Confirm health checks come back

Documents the muscle memory before a real incident.
