# OmniPlug CMS Core v1.4.4 — Master Index

**Status:** ✅ Production-ready, awaiting YubiKey hardware for operator key ceremony.
**Last verified:** 2026-05-20 (Fly.io acceptance + post-mortem patches)
**Operator:** OmniPlug Engineering
**Tests:** 81/81 (regression 36 + SEC 33 + login-isolation 5 + license E2E 7)

This document is the **entry point**. Everything else is referenced from here.
Read this first; the linked docs go deep on individual concerns.

---

## What's verified end-to-end

| Capability | Status | Evidence |
| --- | --- | --- |
| Boot on Fly.io shared-cpu-1x / 512 MB / `sin` | ✅ | `evidence/codex-v144-acceptance-20260520/fly-deploy-log.txt` |
| Seed 90 tenants × 270 users × 450 articles × 150K leads (~50 MB DB) | ✅ | `evidence/codex-v144-acceptance-20260520/seed-output.txt` |
| RAM ≤ 132 MB / 459 MB at peak load | ✅ | `evidence/codex-v144-acceptance-20260520/post-load-snapshot.txt` |
| Rate-limit (lead `20/hr/IP` + `/api/v1/*` `60/min/IP`) under burst | ✅ | Verified during run; classified as expected after harness fix |
| All 12 SEC findings (SEC-1 through SEC-12) | ✅ | `tests/sec-redteam.test.mjs` 33/33 |
| Both RSA-4096 (RS256) and EC P-384 (ES384) signing paths | ✅ | SEC-13 sub-suite 5/5 |
| Soft-lock + PII masking on Community plan | ✅ | `test-license-flow-e2e.mjs` 7/7 |
| Tenant isolation under wrong-domain login | ✅ | `tests/test-fix-login-isolation.mjs` 5/5 |
| TEMP B-TREE ORDER BY eliminated on article list | ✅ | Migration 021 + repo rewrite |

## What's not done yet (waiting on operator + hardware)

| Blocker | Owner | Notes |
| --- | --- | --- |
| Real RSA-4096 / EC P-384 keypair generation | Operator | After YubiKey arrives, run `npm run key:generate -- --ec` |
| Replace `keys/op-license-pub.pem` placeholder | Operator | Currently has `TODO_OPERATOR_PUBLIC_KEY_PEM` marker; server refuses to boot strict-mode with this present |
| First license JWT issued to a real customer | Operator | After key ceremony, see `docs/RUNBOOK.md` §2 |
| Flip `LICENSE_ENFORCEMENT=warn` → `strict` | Operator | After all paying customers activate |
| Telemetry endpoint provisioning | Operator | Optional; default stays `disabled` |

---

## Where to look for what

### "I need to..."

| ...understand what v1.4.4 ships | `CHANGELOG.md` |
| ...deploy to Fly the first time | `docs/DEPLOY_FLY.md` + `FLY-DEPLOY-CHECKLIST.md` |
| ...generate the operator keypair | `scripts/op-key-generate.js` + `docs/RUNBOOK.md` §1 |
| ...issue a license for a new customer | `docs/RUNBOOK.md` §2 |
| ...handle DR (lost DB, lost key, customer support) | `docs/RUNBOOK.md` §3–§4 |
| ...understand why YubiKey 5 is now viable | `docs/ADR-licensing-key-storage.md` Option D |
| ...prepare for the next Fly acceptance test | `docs/PROD-READINESS-NEXT-FLY-TEST.md` |
| ...understand what the first acceptance test found | `docs/POST-MORTEM-2026-05-20.md` |
| ...hand the next test off to Codex | `docs/CODEX-HANDOFF-v1.4.4.md` + `docs/OPERATOR-CODEX-WINDOW-CHECKLIST.md` |
| ...check pre-flight before strict mode | `npm run preflight` |
| ...verify the v1.4.4 spec was met | `FINAL-REPORT-1.4.4.md` |
| ...read the customer-facing FAQ | `docs/CUSTOMER-FAQ.md` |
| ...send a customer their license email | `docs/ONBOARDING.md` |
| ...migrate from v1.4.3 | `MIGRATION-NOTES-1.4.4.md` |

### Code surface map

| Path | What lives here |
| --- | --- |
| `src/backend/server.js` | Express bootstrap, middleware mount order, route registration |
| `src/backend/modules/*/` | Feature modules — controller / service / repository / schema / policy |
| `src/core/db/` | SQLite connection + migration runner |
| `src/core/db/migrations/` | 21 migrations (001–021), all idempotent |
| `src/core/lib/` | Cross-cutting libs — licenseKey, crl, apiKeyMint, rateLimiterIp, planQuotas, maskers, jwt |
| `src/core/middleware/` | Express middleware — auth, tenant, rbac, error, licenseGate, apiKey, attribution, softLock |
| `src/cms/admin/` | Static admin UI |
| `scripts/op-*.js` | Operator-only CLIs (license sign, revoke, CRL, key generate, API key mint) |
| `scripts/seed-load.mjs` | 30-business / 90-tenant / 150K-lead load fixture |
| `scripts/load-test.mjs` | HTTP load harness with 6 scenarios + overhead measurement |
| `scripts/preflight-strict.mjs` | 10-check pre-flight before flipping strict enforcement |
| `tests/sec-redteam.test.mjs` | 33 sub-assertions across SEC-1 → SEC-13 |
| `keys/op-license-pub.pem` | Placeholder — operator replaces with real key |

---

## Hardware path decision tree (read before buying)

```
Do you have a YubiKey 5 (any model) already?
├─ Yes → Generate EC P-384 keypair, import to PIV slot. Best value.
│        Command: npm run key:generate -- --ec
│
└─ No  → Will you buy hardware soon?
         ├─ Within 1 month → YubiKey 5C NFC (~$55) + ES384 path.
         │                   Cryptographically stronger than RSA-4096.
         │
         ├─ Will scale past 50 customers OR add 2nd operator
         │  before then → YubiHSM 2 ($650) + RSA-4096 path.
         │                Hardware ACLs, multi-operator ready.
         │
         └─ Not soon → 1Password Secure Note + tmpfs.
                       Free. Works today. Limited to solo operator.
                       Migrate to hardware later — pub key portable.
```

Full rationale: `docs/ADR-licensing-key-storage.md`.

---

## Quick smoke (locally, before any deploy)

```bash
# 1. Install
npm ci --no-audit --no-fund

# 2. Lint + tests
npm run lint
node tests/setup-test-db.mjs
LOAD_DB_PATH=$(pwd)/.test-data/load.db DB_PATH=$(pwd)/.test-data/load.db node tests/regression-test.mjs
LOAD_DB_PATH=$(pwd)/.test-data/load.db DB_PATH=$(pwd)/.test-data/load.db node tests/sec-redteam.test.mjs
node tests/test-fix-login-isolation.mjs
node tests/test-license-flow-e2e.mjs
# Expected: 36/36, 33/33, 5/5, 7/7

# 3. Boot in dev mode
JWT_SECRET="$(openssl rand -hex 32)" \
ADMIN_EMAIL=admin@local \
ADMIN_INITIAL_PASSWORD=ChangeMe123! \
LICENSE_ENFORCEMENT=warn \
TELEMETRY_URL=disabled \
npm run dev

# 4. In another terminal
curl http://localhost:4000/api/health         # 200 OK
curl http://localhost:4000/api/_perf-probe    # server_elapsed_us reading
```

---

## When YubiKey arrives — exact sequence

```bash
# 1. Generate keypair on a clean offline machine
npm run key:generate -- --ec --basename=op-license-yubi
#    Outputs: op-license-yubi.priv.pem (chmod 600) + op-license-yubi.pub.pem

# 2. Import private key into YubiKey PIV slot 9c
yubico-piv-tool -s 9c -a import-key -i op-license-yubi.priv.pem

# 3. Verify the slot has the matching public key
yubico-piv-tool -s 9c -a generate-public-key -o yubikey-pub-check.pem
diff yubikey-pub-check.pem op-license-yubi.pub.pem   # must be identical

# 4. Destroy the local private key copy
shred -uvz op-license-yubi.priv.pem

# 5. Commit the public key to the repo
cp op-license-yubi.pub.pem keys/op-license-pub.pem
git add keys/op-license-pub.pem
git commit -m "ops(license): install operator P-384 public key"

# 6. Deploy
fly deploy -a omniplug-cms-prod

# 7. Verify boot is clean (NO "TODO_OPERATOR_PUBLIC_KEY_PEM" error in logs)
fly logs -a omniplug-cms-prod | grep -i license

# 8. Run pre-flight (will pass once a license is issued)
npm run preflight

# 9. Issue first customer license (per docs/RUNBOOK.md §2)
```

PKCS#11 wiring to sign directly via YubiKey (without exporting priv key
through tmpfs) is a v1.5.0 add. For v1.4.4, the flow above is the path.

---

## Production-readiness state at hand-off

- [x] Code: 21 migrations applied, 81/81 tests, no warnings on boot
- [x] Security: 13 SEC findings hardened with red-team coverage
- [x] Perf: shared-cpu-1x verified at 90-tenant scale (post-mortem patches applied)
- [x] Docs: 5 runbook docs, customer FAQ, onboarding template, ADR
- [x] Tools: 9 operator CLIs, preflight check, load harness, seed fixture
- [x] Fly: deploy verified, RAM/CPU within budget, volume sized for 25+ years of leads
- [ ] **Hardware: YubiKey 5 or YubiHSM 2 (operator action — pending arrival)**
- [ ] **Real key in `keys/op-license-pub.pem` (operator action — after hardware)**
- [ ] **First customer license issued (operator action — after key)**

---

*This is the entire close-out for the v1.4.4 chat session. Next time you
open the codebase, start here. Everything else is one click away.*
