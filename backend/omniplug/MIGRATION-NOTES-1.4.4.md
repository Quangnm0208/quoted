# Migration Notes — v1.4.4 (License Core + API Gating)

**Release date:** 2026-05-20
**Type:** Additive feature release on top of v1.4.3
**Breaking changes:** None
**Schema changes:** 5 new additive migrations (016–020). All idempotent
(`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN` with
existence checks). v1.4.3 → v1.4.4 needs no SQL writes besides these.
**New dependencies:** None — `jsonwebtoken`, `bcryptjs`, `zod` are already
declared in v1.4.3 `package.json`.

## What changed

Adds operator-signed license JWTs, API key authentication on `/api/v1/*`,
plan-based PII masking (soft-lock) for the free `community` tier, forced
attribution headers, and a CRL (Certificate Revocation List) sync path.

12 SEC findings hardened (SEC-1 through SEC-12). See `CHANGELOG.md` for the
per-finding fix matrix.

## Upgrade path

### From v1.4.3 (with deployed DB)

1. **Back up your database.**
   ```bash
   cp data/cms.db data/cms.db.v143.bak
   ```

2. Unzip v1.4.4 over your v1.4.3 source tree (or replace the entire
   source). No `package.json` changes vs v1.4.3 — no `npm install` needed.

3. **Provision the operator public key.** This is the one **mandatory**
   manual step for v1.4.4.
   - The repo ships with a placeholder at `keys/op-license-pub.pem`. The
     server will REFUSE to boot in strict enforcement mode with the
     placeholder present.
   - Replace it with the real RSA-4096 public key the operator (Quang)
     gives you. Verify the PEM header is `-----BEGIN PUBLIC KEY-----`
     and the key length is 4096 bits:
     ```bash
     openssl rsa -in keys/op-license-pub.pem -pubin -text -noout \
       | grep "Public-Key:"
     # Expected: "Public-Key: (4096 bit)"
     ```
   - On Fly.io deployments, the public key is committed to the repo and
     baked into the Docker image. Re-deploy after replacing it:
     ```bash
     fly deploy
     ```

4. **Set the enforcement mode.** Pick one and configure via env var
   `LICENSE_ENFORCEMENT`:

   | Mode | Behaviour | Use when |
   | --- | --- | --- |
   | `off` | License middleware bypassed entirely. | Dev/test only. |
   | `warn` *(recommended for v1.4.4 rollout)* | License checked; failures logged every 60s but `/api/v1/*` still passes through. | Initial v1.4.4 rollout — gives customers time to activate without breaking integrations. |
   | `strict` | License checked; failures return `402 PAYMENT_REQUIRED`. | Once all paying customers have activated. |

   On Fly.io, the default in `fly.toml` is `LICENSE_ENFORCEMENT='warn'`.
   Override per-deployment with:
   ```bash
   fly secrets set LICENSE_ENFORCEMENT=strict -a your-app
   ```

5. **Telemetry stays disabled.** v1.4.4 ships with `TELEMETRY_URL='disabled'`
   in `fly.toml`. UUIDs are still generated for audit; no network egress
   occurs. To enable, set `TELEMETRY_URL` to a real endpoint (see
   `docs/RUNBOOK.md` §5).

6. **Restart the service.**
   ```bash
   # Local
   pkill -f 'node src/backend/server.js' && npm start

   # Fly
   fly deploy
   ```

7. **Verify boot.** The startup log must include one of:
   ```
   [license] enforcement=warn   — public key loaded, RSA-4096+ verified
   [license] enforcement=strict — public key loaded, RSA-4096+ verified
   [license] enforcement=off
   ```
   If you see `[license] FATAL: keys/op-license-pub.pem missing or
   unreadable` or `[license] FATAL: public key still has placeholder
   marker`, fix per step 3 before continuing.

8. **Activate licenses for paying customers.** Each customer must paste
   their license JWT at `/admin/license.html` once. Until they do, they
   stay on `community` plan with PII masking active. See
   `docs/ONBOARDING.md` for the customer-facing template.

### From v1.4.2 or earlier

Run v1.4.3 migration first per `MIGRATION-NOTES-1.4.3.md`, then follow
the above. The migrations 015 (perf indexes) and 016–020 (license
schema) are independent; either order works, but going through v1.4.3
first means you can verify the regression suite passes at that level
before adding license complexity.

## New migrations (16–20)

All run automatically on next `node src/core/db/migrate.js` (which the
default `npm start` script invokes). Each is idempotent — re-running is a
no-op.

| ID | Adds | Purpose |
| --- | --- | --- |
| 016 | `licenses`, `license_revocations` | License JWT storage + CRL ledger |
| 017 | `tenants.license_id`, `tenants.plan_cached`, `tenants.plan_checked_at` | Foreign key tenant→license + cached plan for hot path |
| 018 | `api_keys` (bcrypt hashes, indexed `key_prefix`) | API key store for `/api/v1/*` gating |
| 019 | `api_usage` (daily counter) | Quota enforcement + observability |
| 020 | `license_activations` (jti + tenant_id timestamps) | SEC-7 replay detection ledger |

To rollback (if you absolutely must — note: re-applying loses the data):
```sql
DROP TABLE IF EXISTS license_activations;
DROP TABLE IF EXISTS api_usage;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS license_revocations;
DROP TABLE IF EXISTS licenses;
ALTER TABLE tenants DROP COLUMN plan_checked_at;
ALTER TABLE tenants DROP COLUMN plan_cached;
ALTER TABLE tenants DROP COLUMN license_id;
DELETE FROM _migrations WHERE id BETWEEN 16 AND 20;
```
There is **no `down` script** shipped — license data should be retained
across upgrades. If you need to rollback, do it manually with full
awareness.

## Behavioural changes vs v1.4.3

These changes are **not breaking** at the API contract level — every
v1.4.3 endpoint still returns the same shape — but the response payload
content differs for tenants on the `community` plan (which is the default
post-upgrade until activation).

### Lead listings (`/api/admin/leads`)

Before activation (tenant on `community` plan):
```json
{ "name": "N•••", "phone": "091•••5678", "email": "a•••@example.com", ... }
```

After activation (any paid plan):
```json
{ "name": "Nguyen Van A", "phone": "0912345678", "email": "a@example.com", ... }
```

Underlying database rows are **never destructively redacted**. Masking
is response-layer only. Activating later unmasks historical data with
zero data loss.

### New response headers (every response, regardless of plan)

- `X-Powered-By: OmniPlug CMS Core`
- `X-Attribution-Level: L1` (community / lite) | `L2` (standard / pro)
- For the `pro_plus` (white-label) plan, both headers are omitted.

If your customer integration parses response headers, account for these
additions. Most consumers won't notice.

### New endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/admin/license/activate` | Admin JWT | Paste a license JWT to activate |
| `POST` | `/api/admin/license/sync-crl` | Admin JWT | Apply a signed CRL bundle |
| `GET`  | `/api/admin/license/status` | Admin JWT | Current plan + license metadata |
| `*`    | `/api/v1/*` | API key (`op_live_...`) | Gated SDK/B2B surface |
| `GET`  | `/api/v1/health/legacy-traffic` | Admin JWT | Counter for SEC-12 sunset monitoring |

`/api/public/*` endpoints still work — they emit `Sunset` and `Deprecation`
response headers but no functional change. Migrate to `/api/v1/*` over
time.

## Verification checklist (post-deploy smoke)

Run these on every deployment after upgrading:

```bash
# 1. Server boots with license module loaded
curl -s http://localhost:4000/api/health \
  | jq '{status, version, product}'
# Expected: { "status": "ok", "version": "1.4.4", "product": "OmniPlug CMS Core" }

# 2. Migrations are at 020+
sqlite3 data/cms.db 'SELECT MAX(id) FROM _migrations'
# Expected: 20 (or higher)

# 3. License status endpoint responds
curl -s http://localhost:4000/api/admin/license/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '{plan, license}'
# Expected before activation: { "plan": "community", "license": null }

# 4. Attribution headers present
curl -sI http://localhost:4000/api/health | grep -i "x-attribution"
# Expected: X-Attribution-Level: L1 (or L2 for paid plans)

# 5. /api/v1 rejects without API key
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/v1/leads
# Expected: 401
```

All five must pass. Failures: see `docs/RUNBOOK.md` §6.

## Rolling back to v1.4.3

If something goes wrong and you need to roll back **before** any customer
has activated a license, the rollback is non-destructive:

```bash
# 1. Stop the v1.4.4 service
pkill -f 'node src/backend/server.js'

# 2. Restore v1.4.3 source tree
unzip omniplug-cms-core-v1.4.3.zip -d /app/

# 3. Restart — the new migrations 016-020 stay in the DB (harmless;
#    v1.4.3 ignores them), and tenants.license_id stays NULL (harmless;
#    v1.4.3 doesn't read it).
npm start
```

After customers have activated, rollback becomes lossy — see the manual
SQL block above. Don't roll back after customer activation unless you
genuinely have to.

## Operator action items (Quang)

Before flipping any deployment to `LICENSE_ENFORCEMENT=strict`:

- [ ] Generate the real RSA-4096 keypair (see `docs/RUNBOOK.md` §1.1).
- [ ] Replace placeholder `keys/op-license-pub.pem` in every deployment.
- [ ] Decide private-key storage: 1Password (now) or YubiHSM 2 (later).
      **YubiKey 5 NFC will NOT work** — its PIV slot only supports
      RSA-2048, and SEC-10 refuses anything weaker. See ADR
      `docs/ADR-licensing-key-storage.md` for full rationale.
- [ ] Build the customer ledger CSV (runbook §2.4).
- [ ] Issue licenses for every existing paying customer.
- [ ] Verify each has activated (their status endpoint shows their plan).
- [ ] Only then: `fly secrets set LICENSE_ENFORCEMENT=strict -a customer-app`.
