# OmniPlug CMS Core — License Operations Runbook (v1.4.4)

**Operator:** OmniPlug Engineering <licensing@omniplug.com>
**Last updated:** 2026-05-20
**Audience:** OmniPlug operations staff (you, in 6 months, panicking).

---

## §0 — TL;DR / what's where

| Need | Go to |
|---|---|
| First-time key setup | §4.1 |
| Customer activated successfully but doesn't see paid features | §4.6 |
| Customer wants to revoke an API key | §4.4 |
| Customer's deployment died, DB wiped | §4.3 |
| We need to revoke a customer's license urgently | §4.5 |
| New customer signed up, send them their license | §4.6 |
| YubiKey vs 1Password question | §4.7 |
| Telemetry: is it on? | §4.8 |
| Customer says "tôi không thấy lead nào" | §4.9 |

---

## §1 — Architecture in 60 seconds

```
┌──────────────────────┐                                  ┌──────────────────────┐
│  Operator (Quang)    │                                  │  Customer deployment │
│                      │  1. Sign JWT (op-license-sign)   │                      │
│  op-license.priv.pem │  ──────────────────────────────► │  keys/op-license-    │
│  (in 1Password or    │     license.jwt (≤8 KB)          │      pub.pem         │
│   YubiHSM 2 only)    │                                  │                      │
│                      │  2. Send via email + portal      │  verifyLicense()     │
│                      │                                  │  POST /activate      │
│  op-license.pub.pem  │  3. Mint API key                 │                      │
│  (commit to git)     │  (op-create-api-key)             │  apiKey middleware   │
│                      │  ──────────────────────────────► │                      │
│                      │     op_live_<8>_<32>             │  /api/v1/* gated     │
│                      │                                  │                      │
│                      │  4. Revoke if needed             │                      │
│                      │  (op-crl-sign → email customer) │  syncCrl()           │
│                      │  ──────────────────────────────► │                      │
└──────────────────────┘                                  └──────────────────────┘
```

Three secrets exist:

1. **`op-license.priv.pem`** — RSA-4096 private key, signs all JWTs and CRLs. **Single key for the entire OmniPlug fleet.** If this leaks, every license can be forged. Keep in 1Password OR YubiHSM 2. Never on shared infra, never on laptops in cleartext.
2. **`op-license-pub.pem`** — RSA-4096 public key, ships in every customer deployment (`keys/op-license-pub.pem`). Public, commit to git, distribute freely.
3. **API keys (`op_live_…`)** — per-customer, bcrypt-hashed at rest. Operator mints, customer pastes into SDK config.

---

## §2 — Plans & gating

| Plan | Price (VND) | Lead cap | API calls/day | PII masked | Soft-lock | Attribution | `/api/v1/*` |
|---|---|---|---|---|---|---|---|
| Community Free | 0 | 500 | 1,000 | ✅ yes | ✅ yes | L1 badge | ❌ refused |
| Lite | 12tr/year | 5,000 | 25,000 | ❌ no | ❌ no | L2 header | ✅ |
| Standard | 25tr/year | 50,000 | 100,000 | ❌ no | ❌ no | L3 footer | ✅ |
| Pro | 50tr/year | 200,000 | 500,000 | ❌ no | ❌ no | none | ✅ |
| Pro+ | 80-120tr/year | 1,000,000 | 2,000,000 | ❌ no | ❌ no | none | ✅ |

Enforcement modes (env `LICENSE_ENFORCEMENT`):

- **`strict`** (prod target): refuses /api/v1/* without active license. Boot fails fast if `keys/op-license-pub.pem` missing or weak.
- **`warn`** (default in v1.4.4 rollout): pass-through. Logs `[license] WARNING: enforcement=warn ...` every 60s in production so we never forget to switch.
- **`off`** (dev only): completely disabled.

---

## §3 — Onboarding a new customer (happy path)

After payment confirms (Stripe webhook, manual bank transfer, doesn't matter):

```bash
# 1. Sign the license JWT (locally, on a clean machine, with priv key in scope)
node scripts/op-license-sign.js \
  --priv=~/Secure/op-license.priv.pem \
  --plan=lite \
  --signed-for=customer.example.com \
  --customer-name="Customer A Co. Ltd." \
  --customer-email="ops@customer.example.com" \
  --expires-in-days=365 \
  --out=licenses/customer-a-2026-05-20.jwt

# 2. Mint a fresh API key for that customer
#    (Skip this if the customer doesn't need /api/v1/* — just for SDK integrators.)
node scripts/op-create-api-key.js \
  --tenant=12 \
  --license-id=5 \
  --name="customer-a initial key" \
  --scope=sdk
# → outputs: op_live_AbCdEf12_<32-char-secret> (SHOWN ONCE, COPY NOW)

# 3. Send to customer via 1Password share or signed email:
#    - The JWT file (the customer pastes into /admin/license.html)
#    - The API key (only if they need SDK/CRM access)
#    - Link to https://omniplug.com/docs/api-v1-migration
```

Customer then:
1. Logs into their /admin/license.html
2. Pastes JWT, clicks "Kích hoạt"
3. Sees celebration 🎉, plan changes from Community Free → Lite

If activation fails:
- `LICENSE_DOMAIN_MISMATCH`: their tenant.domain doesn't match `signed_for`. Verify spelling, re-sign if needed.
- `LICENSE_BAD_SIG`: their `op-license-pub.pem` is wrong. See §4.2.
- `LICENSE_TOO_LARGE`: someone tried to abuse the activation endpoint. Investigate IP.

---

## §4 — Procedures

### 4.1 — First-time key bootstrap

**You only do this ONCE. EVER. For the entire OmniPlug fleet.**

On a clean machine (ideally an air-gapped VM or a freshly-booted laptop that you'll wipe afterwards):

```bash
# Generate the keypair
openssl genrsa -out op-license.priv.pem 4096
openssl rsa -in op-license.priv.pem -pubout -out op-license-pub.pem

# Verify strength
openssl rsa -in op-license.priv.pem -text -noout | head -1
# Expected: Private-Key: (4096 bit, 2 primes)
```

Then **immediately**:

1. **Public key** → commit to git at `keys/op-license-pub.pem`. Deploy to every customer.
2. **Private key** → choose ONE storage strategy:
   - **1Password vault** (recommended for v1.4.x): create a vault `omniplug-operator`, add the .pem as a secure note. Share only with yourself. Backup the vault recovery code in two physical locations.
   - **YubiHSM 2** (v1.5.0+ target): a hardware HSM that holds RSA-4096 and signs externally. ~$700 USD. See §4.7 for the YubiKey-vs-YubiHSM rationale.

3. **Delete the working files** on the build machine:
   ```bash
   shred -u op-license.priv.pem
   shred -u op-license-pub.pem      # already in git, regenerate from priv if needed
   ```

4. **Test**: re-export the private key from 1Password, sign a throwaway license, verify it activates on a test deployment. Then revoke the test license.

### 4.2 — DR: customer's public key file lost/corrupted

Symptom: customer reports `LICENSE_KEY_NOT_READY` or `LICENSE_BAD_SIG` on every activation attempt, even with a previously-working JWT.

Fix:

```bash
# On customer's deployment server
cd /app
git pull                                  # pulls latest keys/op-license-pub.pem
# OR if running on Fly:
flyctl deploy                              # redeploy includes the key file

# Verify the file has real content (not the TODO_OPERATOR_PUBLIC_KEY_PEM marker)
head -2 keys/op-license-pub.pem
# Expected: -----BEGIN PUBLIC KEY-----
#           MII... (long base64 line)
```

If the file IS correct but activation still fails, the customer's `op-license-pub.pem` may be from an old key generation. Check that the hash matches the current operator key:

```bash
openssl rsa -in keys/op-license-pub.pem -pubin -outform DER | sha256sum
# Compare against operator's record
```

If hashes differ → operator key was rotated. Re-issue all customer licenses with the new key.

### 4.3 — DR: customer DB lost (licenses table empty)

Symptom: customer's licenses table empty, all tenants reset to community. Plan: re-import the JWT(s) you previously signed.

```bash
# 1. Find all JWTs you signed for this customer (from your operator records / git)
ls licenses/customer-a-*.jwt
# customer-a-2026-05-20.jwt

# 2. Concatenate them into one file, one per line
cat licenses/customer-a-*.jwt > /tmp/customer-a-all-jwts.txt

# 3. Send the file to the customer (or run on their server if you have access)
node scripts/op-license-reimport.js --jwt-file=/tmp/customer-a-all-jwts.txt
```

The script verifies each JWT (signature, expiry) and re-inserts into `licenses` + relinks tenants by matching `signed_for` to `tenant.domain`.

If a tenant's domain has changed since the JWT was signed, you'll need to either:
1. Re-sign the JWT with the new domain (preferred), or
2. Manually `UPDATE licenses SET tenant_id = ?` after the import.

### 4.4 — Customer lost their API key

Customer says: "I lost my `op_live_…` key" or "the key may have been compromised."

```bash
# 1. Revoke the old key (does NOT affect license — just kills the API key)
node scripts/op-revoke-api-key.js \
  --prefix=AbCdEf12 \
  --reason="key compromised on 2026-05-20"

# 2. Mint a fresh one
node scripts/op-create-api-key.js \
  --tenant=12 \
  --license-id=5 \
  --name="customer-a key (rotation after leak 2026-05-20)" \
  --scope=sdk
# → op_live_NewPrefix_NewSecret (SHOWN ONCE)

# 3. Send to customer via secure channel (1Password share, NOT email/chat).
```

The customer must update their SDK config to use the new key. Old key is hard-revoked — no transition window — so coordinate.

### 4.5 — Manual revocation (CRL flow)

Use case: customer breached terms / chargeback / fraud. License must stop working everywhere.

```bash
# 1. Revoke locally (on operator machine)
node scripts/op-license-revoke.js \
  --jti=op-lic-abc123 \
  --reason="terms_violation_2026-05-20"

# 2. Generate a signed CRL bundle to distribute
node scripts/op-crl-sign.js \
  --priv=~/Secure/op-license.priv.pem \
  --all \
  --out=crl-2026-05-20.json

# 3. Distribute. Until Bridge (v1.5.0), the customer must apply this manually:
#    Option A: email the JSON, ask customer to paste into /admin/license.html → Sync CRL
#    Option B: ssh + curl (only if you have access):
curl -X POST https://customer.example.com/api/admin/license/sync-crl \
  -H "Authorization: Bearer <customer-admin-jwt>" \
  -H "Content-Type: application/json" \
  --data @crl-2026-05-20.json
```

After sync, the customer's `licenseGate` middleware will refuse `/api/v1/*` with `LICENSE_REVOKED` on the very next request (no cache — the CRL check is direct).

### 4.6 — Onboarding 4-step quick reference

(See §3 for the verbose version.)

1. **Receive payment** → check Stripe/bank.
2. **Sign JWT** → `op-license-sign.js` with plan + signed_for.
3. **Mint API key** → `op-create-api-key.js` (if customer wants SDK).
4. **Customer activates** → /admin/license.html, paste JWT.

Estimated time per customer: 5–10 min if scripts already configured, 20–30 min for a fresh setup.

### 4.7 — Key storage: YubiKey vs YubiHSM vs 1Password

| Option | RSA-4096 supported? | Cost | Recommendation |
|---|---|---|---|
| **YubiKey 5 NFC** (PIV) | ❌ NO — only RSA-2048 in PIV slot | ~$50 | **Do not use for license signing.** Would force us to drop to RSA-2048, which our own `op-license-sign.js` refuses (SEC-10). |
| **YubiKey 5C with PGP** | ✅ Yes via OpenPGP applet (RSA-4096) | ~$50 | Workable but PGP signing is operationally awkward. Better than 1Password for hardware-attestation but worse than YubiHSM for automation. |
| **YubiHSM 2** | ✅ Yes natively | ~$700 USD | **Best for v1.5.0+** when we automate signing via a small operator service. Hardware-backed, supports RSA-4096, has unboxing/audit logs. |
| **1Password Secure Note** | N/A (software storage) | $8/mo | **What we use in v1.4.x.** PEM stored encrypted-at-rest; signing runs on operator's laptop. Lowest friction; sufficient for current scale (≤100 customers). |

**Decision tracking:**
- v1.4.x: 1Password vault, manual `op-license-sign.js` from operator laptop.
- v1.5.0: revisit. If customer count > 50, move to YubiHSM 2 + a sign-only microservice on a separate Fly app with `ALLOWED_OPERATORS=licensing@omniplug.com`.

**Action item for Quang:** decide before v1.5.0 planning. For now, set up the 1Password vault per §4.1.

### 4.8 — Telemetry: where is it?

**Default in v1.4.4: DISABLED.** `fly.toml` sets `TELEMETRY_URL = 'disabled'`. The `startTelemetry()` function returns early without scheduling heartbeats.

To enable later:
```toml
# fly.toml
TELEMETRY_URL = 'https://telemetry.omniplug.com/v1/heartbeat'
```

What it sends (no PII):
- `instance_uuid` (random, generated on first boot)
- version, node_env, tenant_count, domain, node_version, timestamp

The Bridge server (v1.5.0+) will receive these and use them to push CRL updates automatically. Until then, telemetry is purely opt-in and provides no operator value, so we keep it off.

### 4.9 — Customer FAQ: "tôi không thấy thông tin liên hệ trong leads"

This is the soft-lock for Community Free. Phone shows as `091•••5678`, email as `a•••@example.com`, name as `Nguyễn V•••`.

**The data is NOT deleted.** Every lead row is intact in the DB, encrypted at rest by SQLite. When the customer upgrades and re-activates with a paid JWT, the masking middleware turns off and they see everything historical.

Tell the customer:
> Gói Community Free giới hạn ở 500 lead với thông tin liên hệ được che. Dữ liệu của bạn vẫn được lưu đầy đủ — sau khi nâng cấp Lite (12tr/năm) hoặc Standard, tất cả lead cũ sẽ tự động unmask. Liên hệ ops@omniplug.com để mua hoặc dùng thử 14 ngày.

See `docs/CUSTOMER-FAQ.md` for more boilerplate.

---

## §5 — Common errors and what they mean

| Error code | Where | Customer-visible message | Operator action |
|---|---|---|---|
| `LICENSE_REQUIRED` | `/api/v1/*`, strict mode | "Endpoint này yêu cầu gói trả phí" | Check tenant plan; sign JWT if paid |
| `LICENSE_REVOKED` | activate or gate | "License đã bị thu hồi" | Was this intentional? Check `license_revocations` |
| `LICENSE_EXPIRED` | activate or gate | "License đã hết hạn" | Renew + re-sign with new exp |
| `LICENSE_DOMAIN_MISMATCH` | activate | "License is bound to domain X but tenant is Y" | Re-sign with correct signed_for |
| `LICENSE_BAD_SIG` | activate | "License JWT signature did not verify" | Customer's pub key is wrong/old — §4.2 |
| `LICENSE_TOO_LARGE` | activate | (HTTP 413/400) | Investigate IP; possible abuse |
| `API_KEY_INVALID` | `/api/v1/*` | "API key is missing or invalid" | Re-mint per §4.4 |
| `API_KEY_BURST` | `/api/v1/*` | "Too many requests for this API key" | Customer is hitting 5 req/s ceiling; advise queue or upgrade |
| `IP_RATE_LIMITED` | `/api/v1/*` | "Too many requests from this IP" | 60/min hit; possibly an attack or a misconfigured CDN |

---

## §6 — Smoke checks (post-deploy)

After every deploy:

```bash
# 1. Boot logs should show one of:
#    [license] enforcement=strict — public key loaded, RSA-4096+ verified
#    [license] enforcement=warn ... WARNING: ... (every 60s in prod)
#    [license] enforcement=off

# 2. Public key file is correct
flyctl ssh console -a omniplug-cms-prod -C "head -1 /app/keys/op-license-pub.pem"
# Expected: -----BEGIN PUBLIC KEY-----  (NOT "TODO_OPERATOR_PUBLIC_KEY_PEM...")

# 3. Migrations are at 020+
flyctl ssh console -a omniplug-cms-prod -C "sqlite3 /app/data/cms.db 'SELECT MAX(id) FROM schema_migrations'"
# Expected: 20 or higher

# 4. /api/admin/license/status returns shape
curl https://omniplug-cms-prod.fly.dev/api/admin/license/status \
  -H "Authorization: Bearer <admin-jwt>"
# Expected: {"plan":"community", "license":null} or activated plan
```

---

## §7 — When in doubt

- **Customer reports a problem you don't recognize**: check `audit` table for `license.*` events on their tenant. The full activation trail is there.
- **You think you've leaked the private key**: rotate immediately. Generate a new keypair (§4.1), re-deploy public key to all customers (`flyctl deploy` per customer), re-sign all active licenses with new key, distribute new JWTs. Old licenses don't auto-revoke — they just can't be re-activated. Add the old private-key fingerprint to an incident log.
- **You can't reach the customer to send a CRL**: their next deployment will re-fetch the public key (which hasn't changed), but their license stays active until they manually sync the CRL. Bridge (v1.5.0) will fix this.

---

**End of runbook.** Cross-references:
- `docs/ONBOARDING.md` — customer-facing onboarding script
- `docs/CUSTOMER-FAQ.md` — boilerplate for support replies
- PROMPT v1.4.4 — full spec including the 12 SEC findings
