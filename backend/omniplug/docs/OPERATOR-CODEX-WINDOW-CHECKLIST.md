# Operator Checklist — Codex v1.4.4 Acceptance Window

**Operator:** OmniPlug Engineering
**Use this checklist:** flanking the 2-hour Codex access window.

This document is for **you** (the operator) to run. Codex follows the
parallel doc `CODEX-HANDOFF-v1.4.4.md`. Do not show this checklist to Codex.

---

## §A — Pre-flight (T minus ~10 minutes, you run)

### A.1 Verify your local Fly account state

```bash
flyctl auth whoami                                       # confirm you're logged in
flyctl orgs list                                         # confirm only YOUR personal org exists
flyctl apps list | grep -i omniplug                      # confirm omniplug-cms-prod present
flyctl volumes list -a omniplug-cms-prod                 # confirm cms_data volume exists
flyctl status -a omniplug-cms-prod                       # current machine state
```

Expected: 1 org (personal), 1 app (`omniplug-cms-prod`), 1 volume (`cms_data`).

If anything else exists in the org, **snapshot it** before issuing the token:
```bash
flyctl apps list                # list all
# For each app you care about:
flyctl volumes list -a <app>
flyctl volumes snapshots create <vol-id> -a <app>
```

### A.2 Existing-data safety snapshot

If `omniplug-cms-prod` has real customer data (it shouldn't yet, since v1.4.4
hasn't shipped to a paying customer), back it up first:

```bash
flyctl ssh sftp shell -a omniplug-cms-prod <<'EOF'
get /app/data/cms.db /tmp/cms-backup-pre-codex-$(date +%Y%m%d-%H%M).db
exit
EOF
```

Verify file exists and size > 0:
```bash
ls -lh /tmp/cms-backup-pre-codex-*.db
```

If this is a fresh deployment with only your seed admin, you can skip this.

### A.3 Issue the org token

```bash
# Generate token, scoped to your personal org, expires in 2 hours
TOKEN_NAME="codex-v144-test-$(date +%Y%m%d-%H%M)"
flyctl tokens create org --expiry 2h --name "$TOKEN_NAME"
```

Output looks like `FlyV1 fm2_lJPECAAAAAAAcgi...`. Copy the **entire** string
including the `FlyV1 ` prefix. Save it somewhere you can retrieve in 10
seconds (1Password Secure Note titled `codex-v144-token-YYYYMMDD-HHMM`).

### A.4 Verify the token works (smoke test before handing to Codex)

```bash
# Open a new terminal, do NOT inherit your existing FLY_API_TOKEN
FLY_API_TOKEN="<paste-the-codex-token>" flyctl status -a omniplug-cms-prod
# Should print machine status. If this fails, the token is bad — re-issue.
```

### A.5 Record the token ID for revocation

```bash
flyctl tokens list | grep "$TOKEN_NAME"
# Copy the token ID (the leftmost UUID column). You will need this at §C.
```

Save it in the same 1Password note as the token itself.

---

## §B — During the Codex window (T+0 to T+2h, you mostly wait)

### B.1 Hand Codex what it needs

Send Codex (via secure channel — Signal / 1Password share / encrypted email):

1. The token string from §A.3
2. `omniplug-cms-core-v1.4.4.zip` (the deliverable from this thread)
3. `CODEX-HANDOFF-v1.4.4.md` (the parallel doc; included in the zip at `docs/`)

Tell Codex: **"Token expires in 2 hours. Follow CODEX-HANDOFF-v1.4.4.md
exactly. Return the tarball at §6. Do not exceed scope."**

### B.2 Monitor (light touch — you have other things to do)

Open one terminal with `flyctl logs -a omniplug-cms-prod` running. Sanity
checks every 20 minutes:

```bash
# Confirm only YOUR app sees traffic
flyctl apps list

# Confirm no other secrets were set
flyctl secrets list -a omniplug-cms-prod

# Confirm no other machines were spawned
flyctl machine list -a omniplug-cms-prod
```

If you see anything you didn't approve in `CODEX-HANDOFF-v1.4.4.md`, stop
the window early (skip to §C).

### B.3 Expected timeline

| T+ | What Codex should be doing |
| --- | --- |
| 0-5min | Authenticating, verifying config |
| 5-10min | `flyctl deploy` (build + push) |
| 10-12min | Seed-load runs (60-120s on shared-cpu-1x) |
| 12-18min | Load harness runs (~6 min including warm-up + 4 scenarios) |
| 18-20min | RAM/CPU snapshot, optional cleanup |
| 20-25min | Tarball delivery |
| 25min-2h | (Cushion) — if Codex needs more, it has it |

If Codex hasn't sent the tarball by T+90 minutes, something is stuck.
Check logs and consider §C early.

---

## §C — Post-flight (T+2h, you run)

### C.1 Revoke the token IMMEDIATELY

Do this **first**, before any other cleanup:

```bash
# Use the token ID from §A.5
flyctl tokens revoke <token-id>

# Verify
flyctl tokens list | grep "$TOKEN_NAME"
# Should be empty or show "revoked"
```

If you can't find the token ID, list all and revoke by name match:
```bash
flyctl tokens list
# Find the row, revoke it
flyctl tokens revoke <token-id>
```

If you're paranoid (recommended): rotate your own primary login too:
```bash
flyctl auth logout
flyctl auth login    # re-authenticate from your machine
```

### C.2 Review Codex's deliverable

Codex should hand back `codex-v144-acceptance-YYYYMMDD-HHMM.tar.gz`
containing:

- `load-test-report.txt` — read first; this is the actual SLO outcome
- `post-load-snapshot.txt` — RAM/CPU at peak
- `fly-deploy-log.txt` — deployment trace
- `seed-output.txt` — seed-load.mjs output
- `fly-machine-status.txt` — final machine state

Verify the SLO thresholds in `load-test-report.txt`:

| Scenario | p50 | p95 | Throughput | Pass? |
| --- | ---: | ---: | ---: | --- |
| health | ≤ 50ms | ≤ 150ms | ≥ 100 rps | |
| article list | ≤ 200ms | ≤ 600ms | ≥ 30 rps | |
| lead capture (POST) | ≤ 300ms | ≤ 800ms | ≥ 25 rps | |
| /api/v1/* unauth | ≤ 100ms | ≤ 300ms | n/a | |

And the resource ceilings in `post-load-snapshot.txt`:

- [ ] RAM sustained < 400 MB on 512 MB machine
- [ ] Peak RAM ≤ 450 MB
- [ ] Load average < 2.0 sustained
- [ ] DB file ~50 MB (matches expected from 150K leads)

### C.3 Decide next step based on results

**All thresholds PASS:**
- v1.4.4 is ready for the next milestone (real-key provisioning).
- File the tarball as `evidence/v1.4.4-acceptance-YYYYMMDD/`.
- Next action item: §1.1 of `docs/RUNBOOK.md` (generate the real
  RSA-4096 or P-384 operator keypair).

**Any threshold FAIL:**
- Do NOT proceed to strict enforcement.
- Diagnose: was it Fly machine saturation, SQLite contention, or app logic?
- Common fixes for `shared-cpu-1x`:
  - Bump to `performance-1x` ($14/mo) — gives dedicated 1 vCPU + 2 GB RAM
  - Lower the seed scale to `SCALE_FACTOR=medium` (45K leads) and re-run
  - Profile the slowest scenario with `node --inspect` locally

### C.4 Tear down the test fixture

Optional — if you don't want 150K leads sitting in the prod DB:

```bash
flyctl ssh console -a omniplug-cms-prod -C 'sh -c "cd /app && \
  node -e \"
    const db = require('better-sqlite3')('/app/data/cms.db');
    db.exec('PRAGMA foreign_keys=OFF');
    const removed = {
      leads: db.prepare('DELETE FROM leads WHERE id IN (SELECT l.id FROM leads l JOIN tenants t ON l.tenant_id=t.id WHERE t.settings_json LIKE '\\''%seeded_by\\\":\\\"load-seed%'\\'')').run().changes,
      articles: db.prepare('DELETE FROM articles WHERE tenant_id IN (SELECT id FROM tenants WHERE settings_json LIKE '\\''%seeded_by\\\":\\\"load-seed%'\\'')').run().changes,
      users: db.prepare('DELETE FROM users WHERE email LIKE '\\''%@omniplug.test'\\''').run().changes,
      media: db.prepare('DELETE FROM media WHERE tenant_id IN (SELECT id FROM tenants WHERE settings_json LIKE '\\''%seeded_by\\\":\\\"load-seed%'\\'')').run().changes,
      tenants: db.prepare('DELETE FROM tenants WHERE settings_json LIKE '\\''%seeded_by\\\":\\\"load-seed%'\\'').run().changes,
    };
    console.log('Removed:', removed);
    db.exec('VACUUM');
  \""'
```

This is fully scoped to seeded data (matched by the `"seeded_by":"load-seed"`
marker in `tenants.settings_json`). Your real admin and any future paying
customer data is untouched.

### C.5 Restore from snapshot if needed

If Codex broke something and the volume snapshot from §A.2 needs to be
restored:

```bash
# List snapshots
flyctl volumes snapshots list -a omniplug-cms-prod cms_data

# Restore: create a new volume from snapshot, then swap it in
flyctl volumes create cms_data_restored \
  --snapshot-id <snap-id> \
  --region sin --size 3

# Stop the machine, swap volumes, restart
flyctl machine stop <machine-id> -a omniplug-cms-prod
# (manual: detach cms_data, attach cms_data_restored — see Fly docs)
flyctl machine start <machine-id> -a omniplug-cms-prod
```

This is the nuclear option. Should not normally be needed.

---

## §D — If you have to abort mid-window (T+anytime)

```bash
# 1. Revoke the token first
flyctl tokens revoke <token-id>

# 2. Stop all machines to halt activity
flyctl machine list -a omniplug-cms-prod
for id in <machine-ids>; do flyctl machine stop $id -a omniplug-cms-prod; done

# 3. Snapshot the volume for forensics
flyctl volumes snapshots create cms_data -a omniplug-cms-prod

# 4. (Optional) Pull the DB for offline inspection
flyctl ssh sftp shell -a omniplug-cms-prod
sftp> get /app/data/cms.db /tmp/cms-emergency-$(date +%Y%m%d-%H%M).db
sftp> exit
```

Notify Codex (if you can) that the window has closed.

---

## §E — Useful one-liners

```bash
# What is Codex doing right now?
flyctl logs -a omniplug-cms-prod | tail -20

# Is the machine swap-thrashing?
flyctl ssh console -a omniplug-cms-prod -C 'cat /proc/meminfo | head -5'

# How many tokens currently exist on the org?
flyctl tokens list

# What secrets are set?
flyctl secrets list -a omniplug-cms-prod
# Note: values are not shown, only names

# Force-restart the machine
flyctl machine restart $(flyctl machine list -a omniplug-cms-prod -j | jq -r '.[0].id') -a omniplug-cms-prod
```

---

*Keep this checklist offline. Print it if you want. Do not put it in the same
1Password vault as the token — separation of concerns.*
