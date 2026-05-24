# Codex Handoff — OmniPlug v1.4.4 Fly.io Live Test

**Hand-off from:** OmniPlug Engineering
**Target executor:** Codex (or any agent with `flyctl` access)
**Access window:** 2 hours (timeboxed)
**Server budget:** `shared-cpu-1x` / 512 MB / 3 GB volume — current `fly.toml`

This document is the entire script Codex needs to execute the v1.4.4 acceptance
on a real Fly machine. Read top to bottom; do not skip sections.

---

## §0. Prerequisites the operator (Quang) provides at hand-off time

1. **`FLY_API_TOKEN`** — Fly.io **org-level** access token, valid for 2 hours
   from issuance. Operator generates with:
   ```bash
   flyctl tokens create org --expiry 2h --name "codex-v144-test-$(date +%Y%m%d)"
   ```
   Org-level token has full access (apps, volumes, secrets, billing). Operator
   commits to **manual revoke at end of window** regardless of whether Codex
   thinks it has finished:
   ```bash
   # Operator runs at T+2h:
   flyctl tokens list
   flyctl tokens revoke <token-id>
   ```

2. **`FLY_APP_NAME`** — the v1.4.4 app name. Default per `fly.toml`:
   `omniplug-cms-prod`. If a fresh app is needed, Codex creates one in §1.

3. **`OMNIPLUG_ZIP`** — `omniplug-cms-core-v1.4.4.zip` extracted to Codex's
   working directory.

### Hard scope rules (org-token amplifies blast radius — DO NOT violate)

Because the token is org-level, Codex MUST NOT:

- ❌ Create or scale any app OTHER than `$FLY_APP_NAME`
- ❌ Modify any volume OTHER than `cms_data`
- ❌ Set secrets on any app other than `$FLY_APP_NAME`
- ❌ Run `flyctl scale vm` to a paid tier (stay on `shared-cpu-1x` only)
- ❌ Add a payment method, change org billing, or invite users
- ❌ Touch `flyctl orgs ...` commands at all
- ❌ Use the token from any machine other than Codex's sandbox during the
      acceptance run
- ❌ Persist the token to disk anywhere (use it via `export FLY_API_TOKEN=...`
      in-process only)

Codex MAY:

- ✓ Deploy `$FLY_APP_NAME` (§1d)
- ✓ SSH into `$FLY_APP_NAME` machines (§2, §4, §5)
- ✓ Set secrets `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` on
      `$FLY_APP_NAME` (§1c)
- ✓ Read `flyctl status`, `flyctl machine list`, `flyctl logs`,
      `flyctl volumes list` on `$FLY_APP_NAME`
- ✓ Snapshot the `cms_data` volume in case of emergency (§7)
- ✓ Stop or destroy machines belonging to `$FLY_APP_NAME` if test data
      becomes corrupted

If any operation outside this list is required to complete the acceptance,
**STOP, write a justification to the log, and notify the operator before
proceeding.**

---

## §1. Bring up the Fly machine

### 1a. Authenticate
```bash
export FLY_API_TOKEN="<token-from-operator>"
flyctl auth whoami                          # confirm token works
flyctl apps list                            # confirm FLY_APP_NAME exists
```

If the app does not exist:
```bash
cd <unzipped-omniplug-cms-core-v1.4.4>
flyctl apps create omniplug-cms-prod --org personal
flyctl volumes create cms_data --size 3 --region sin
```

### 1b. Verify config
```bash
# fly.toml ships with LICENSE_ENFORCEMENT='warn' (correct for first deploy)
grep -E "LICENSE_ENFORCEMENT|TELEMETRY_URL|memory" fly.toml
# Expected:
#   LICENSE_ENFORCEMENT = 'warn'
#   TELEMETRY_URL = 'disabled'
#   memory = '512mb'
```

### 1c. Set deploy-time secrets

These are required by the production migrate script and admin bootstrap.
**CORS_ORIGIN is mandatory in production** (`env.js` calls `required()` when
`NODE_ENV=production`) — without it the server refuses to boot with
`Missing required env: CORS_ORIGIN`.

```bash
flyctl secrets set \
  JWT_SECRET="$(openssl rand -hex 48)" \
  ADMIN_EMAIL="codex-test@omniplug.local" \
  ADMIN_INITIAL_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 16)Aa1!" \
  CORS_ORIGIN="https://omniplug-cms-prod.fly.dev,https://*.fly.dev" \
  -a "$FLY_APP_NAME"
```

For a more locked-down CORS, list each tenant test domain explicitly instead
of using a wildcard. For pure load-testing with no browser involvement, you
can pass `CORS_ORIGIN="*"` — only do this for the acceptance window, never
for a real customer deployment.

Save the printed `ADMIN_INITIAL_PASSWORD` — Codex needs it for the admin
login scenario in §3.

### 1d. Deploy

```bash
flyctl deploy --remote-only -a "$FLY_APP_NAME"
# Expect 2-4 min build + push.
# Boot log MUST contain:
#   "OmniPlug CMS Core v1.4.4"
#   "[license] enforcement=warn"
#   "[telemetry] disabled"
```

If the boot crashes with `License public key at keys/op-license-pub.pem still
contains TODO_OPERATOR_PUBLIC_KEY_PEM marker`, the operator has not provisioned the real
public key yet. **This is expected for this acceptance pass** because
LICENSE_ENFORCEMENT=warn tolerates a missing pub key in dev mode but production
boot strictly refuses it. Two options:

- **Option A — Run in warn mode with a dummy P-384 pub key** (recommended for
  load testing without burning the real key):
  ```bash
  # On Codex local machine:
  cd /tmp && node -e "
    const c = require('crypto'), fs = require('fs');
    const { publicKey, privateKey } = c.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    fs.writeFileSync('dummy-pub.pem', publicKey.export({ type: 'spki', format: 'pem' }));
    fs.writeFileSync('dummy-priv.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }));
    console.log('Dummy P-384 keypair written to /tmp');
  "
  # Inject the dummy pub into the Fly image:
  flyctl ssh sftp shell -a "$FLY_APP_NAME"
  sftp> put /tmp/dummy-pub.pem /app/keys/op-license-pub.pem
  sftp> exit
  flyctl machine restart -a "$FLY_APP_NAME"
  ```
  This dummy key is **acceptable** for load testing — it lets the server boot
  in warn mode and exercise the /api/v1/* gating logic. No real licenses can
  be activated against this key.

- **Option B — Hold off until operator provisions the real key**. If §1d fails,
  STOP and notify the operator. Do not proceed with §2.

---

## §2. Seed the load fixture

Once the app is up:

### 2a. Run the seed script via SSH

```bash
flyctl ssh console -a "$FLY_APP_NAME" -C 'sh -c "cd /app && \
  SCALE_FACTOR=full \
  DAYS=1 \
  SEED_PASSWORD=OmniPlugTest2026! \
  DB_PATH=/app/data/cms.db \
  node scripts/seed-load.mjs"'
```

Expected output tail:
```
═══ Summary ═══
  tenants    90
  users      270
  articles   450
  leads      150,000
  media      90
  db_file    48.x MB
```

Expected duration on `shared-cpu-1x`: **60-120 seconds**. If it runs past
180s, something is wrong — `flyctl machine status` and check for OOM.

### 2b. Verify

```bash
flyctl ssh console -a "$FLY_APP_NAME" -C 'sh -c "cd /app && \
  echo \"Tenants:\" && node -e \"const db = require(\\\"better-sqlite3\\\")(\\\"/app/data/cms.db\\\"); console.log(db.prepare(\\\"SELECT COUNT(*) AS c FROM tenants\\\").get())\" && \
  echo \"Leads:\" && node -e \"const db = require(\\\"better-sqlite3\\\")(\\\"/app/data/cms.db\\\"); console.log(db.prepare(\\\"SELECT COUNT(*) AS c FROM leads\\\").get())\""'
```

---

## §3. Run the load harness from Codex's local machine

### 3a. Pick a target URL — proxy vs public edge

There are two ways to reach the app, with different latency profiles:

**Option A — Fly public HTTPS edge (recommended for real-world SLO)**
```bash
export BASE_URL="https://${FLY_APP_NAME}.fly.dev"
```
Pros: tests the full stack the customer will see (TLS termination, Fly proxy,
hallpass, app). p95 numbers are directly comparable to customer experience.
Cons: tenant Host header on `*.fly.dev` won't route to a real tenant — the
test will fall back to TENANT_NOT_FOUND in production mode. Either:
- Add the test tenant domains to the `omniplug-cms-prod.fly.dev` certificate
  (Fly does this automatically for `*.fly.dev`), then use those as Host
  headers, OR
- Add the tenant domains to your local `/etc/hosts` pointing at the
  Fly-assigned IP, then use HTTP — bypasses TLS but tests routing.

**Option B — flyctl proxy to localhost (what the first acceptance run used)**
```bash
flyctl proxy 4001:4000 -a "$FLY_APP_NAME" &      # background
export BASE_URL="http://127.0.0.1:4001"
```
Pros: tenant Host headers work because there's no Fly edge between Codex and
the app — the request hits hallpass directly. Cons: adds 100-200ms Wireguard
RTT to every request that the customer would NOT see in production. The
2026-05-20 run measured `health p50=270ms` this way; app-only health is ~5ms.

**The harness now measures proxy/network overhead automatically** via
`/api/_perf-probe` and emits `p95-ovh` (overhead-corrected p95) in the
aggregate report. SLOs are evaluated against `p95-ovh`, not raw `p95`.

### 3b. Run the harness

```bash
cd <local-omniplug-cms-core>

# Pick BASE_URL per §3a
export BASE_URL="https://${FLY_APP_NAME}.fly.dev"   # or http://127.0.0.1:4001 via proxy
export FLY_APP="$FLY_APP_NAME"
export CONCURRENCY=20
export SAMPLE_INTERVAL=5

node scripts/load-test.mjs 2>&1 | tee load-test-report.txt
```

Expected duration: **~8 minutes** (includes two 65s sleeps between IP-rate-
limit scenarios so the token bucket can refill — without this the v1-unauth
scenarios contaminate each other).

The harness now runs **6 scenarios** in order:

| # | Scenario | Accepted statuses | Why this composition |
| --- | --- | --- | --- |
| 1 | health | 200 only | event-loop + DB SELECT 1 floor |
| 2 | article list | 200 only | full read path with index walk |
| 3a | lead-capture (budget) | 201 only | write path with spoofed IPs to bypass rate limit |
| 3b | lead-capture (saturated) | 201 + 429 | verifies rate-limiter under load |
| 4 | v1-unauth | 401 + 429 | SEC-3 (60/min/IP) + SEC-1 (bcrypt + DUMMY_HASH) |
| 4b | v1-unauth-spread | 401 only | spreads IPs to isolate SEC-1 timing-pad cost |

**Key change from the first acceptance pass**: scenarios 3b and 4 EXPECT 429s
— they're verifying SEC-3 works, not measuring write latency. Scenarios 3a
and 4b were added to measure write/auth latency cleanly by spreading load
across spoofed IP addresses (only effective behind a trusted proxy — works
on Fly because `TRUST_PROXY=true` in `fly.toml`).

### Acceptance thresholds (overhead-corrected, app-only latency):

| Scenario | p95-ovh | Throughput | Notes |
| --- | ---: | ---: | --- |
| health | ≤ 150 ms | ≥ 100 rps | minus proxy overhead |
| articles | ≤ 600 ms | ≥ 30 rps | covered by `idx_articles_tenant_status_published` (migration 021) |
| lead-capture (budget) | ≤ 800 ms | ≥ 25 rps | spoofed IPs, all 201 |
| lead-capture (saturated) | — | — | success when 429 dominates after first ~20 per (tenant, IP) |
| v1-unauth | — | — | success when 401 ≤ 60 then 429 |
| v1-unauth-spread | ≤ 300 ms | — | 401 with intentional SEC-1 ≥80ms timing pad |

**RAM ceiling:** sustained RAM use must stay under **400 MB** on the 512 MB
machine (headroom for SQLite WAL + 16 MB page cache + 64 MB mmap window).
Brief peaks to 450 MB are acceptable during seed but should not happen
during load test. The first acceptance pass measured peak 132 MB — comfortably
under budget; v1.4.4 perf tuning adds ~80 MB worst-case mmap window so expect
~210 MB sustained.

**CPU ceiling:** load average should not exceed **2.0** sustained (note:
shared-cpu-1x is 1 vCPU; load > 1.0 means request queueing).

If thresholds are violated, capture the failing scenario logs verbatim and
hand back to operator. Do not retry without analysis.

---

## §4. Capture RAM/CPU snapshot at peak

The harness already samples during load. For a separate measurement after
the load test completes:

```bash
flyctl ssh console -a "$FLY_APP_NAME" -C 'sh -c "\
  echo === MEMORY === && \
  cat /proc/meminfo | head -5 && \
  echo && \
  echo === PROCESSES === && \
  ps aux --sort -%mem | head -10 && \
  echo && \
  echo === DB SIZE === && \
  ls -lh /app/data/ && \
  echo && \
  echo === DISK === && \
  df -h /app/data \
  "' 2>&1 | tee post-load-snapshot.txt
```

---

## §5. Stop the load + verify cleanup

```bash
# Tear down the seed data (optional — operator may want to keep for inspection)
flyctl ssh console -a "$FLY_APP_NAME" -C 'sh -c "cd /app && \
  node -e \"const db = require('better-sqlite3')('/app/data/cms.db'); \
    db.exec('DELETE FROM leads WHERE notes = '\\''load-test'\\''); \
    console.log('removed', db.prepare('SELECT changes() AS c').get())\""'

# Stop the machine to halt billing
flyctl scale count 0 -a "$FLY_APP_NAME"
```

When the 2h window is closing, the operator should rotate the token:
```bash
flyctl tokens revoke <token-id>     # operator runs this — Codex doesn't have permission
```

---

## §6. Deliverables for the operator

Codex MUST leave behind a single tarball with:

```
load-test-report.txt              # §3 harness output
post-load-snapshot.txt            # §4 RAM/CPU snapshot
fly-deploy-log.txt                # output of `flyctl deploy` (§1d)
seed-output.txt                   # output of `scripts/seed-load.mjs` (§2a)
fly-machine-status.txt            # `flyctl status -a $FLY_APP_NAME`
```

Bundle and hand back to operator:
```bash
tar czf codex-v144-acceptance-$(date +%Y%m%d-%H%M).tar.gz \
  load-test-report.txt post-load-snapshot.txt \
  fly-deploy-log.txt seed-output.txt fly-machine-status.txt
```

---

## §7. Rollback / kill switch (if something goes wrong)

If at any point the test breaks production data or the machine becomes
unresponsive:

```bash
# Get all machines
flyctl machine list -a "$FLY_APP_NAME"

# Stop the offending machine immediately
flyctl machine stop <id> -a "$FLY_APP_NAME"

# Snapshot the volume in case the operator wants to forensics
flyctl volumes snapshots create cms_data -a "$FLY_APP_NAME"

# Notify operator and STOP. Do not deploy further changes.
```

The operator (Quang) takes over from here.

---

## §8. Out of scope for this acceptance pass

These are NOT to be done by Codex during the 2h window. The operator will
handle them separately after reviewing the acceptance report:

- License JWT signing with the real RSA-4096/P-384 operator key
- API key minting for any real customer
- Flipping `LICENSE_ENFORCEMENT` from `warn` to `strict`
- Wiring the CRL distribution to customer deployments
- Telemetry endpoint provisioning

Codex's job is to **prove the v1.4.4 codebase boots, seeds, serves load,
and stays within budget on shared-cpu-1x / 512 MB**. Nothing more.

---

*End of handoff. The operator (Quang) is on standby for §7 escalation or
§8 follow-up after the acceptance report is reviewed.*
