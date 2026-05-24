# ADR: License Signing Key Storage

**Status:** Proposed (awaiting operator decision)
**Date:** 2026-05-20
**Owner:** OmniPlug Engineering <licensing@omniplug.com>
**Context version:** OmniPlug CMS Core v1.4.4

## Context

v1.4.4 introduces operator-signed license JWTs (RS256 over RSA-4096). The
**public** key ships in every customer deployment at
`keys/op-license-pub.pem` — it's safe to commit to git. The **private**
key signs new licenses and CRL bundles; if it leaks, every customer must
be re-issued and the disclosure is reputationally catastrophic.

We need to decide where the private key lives.

### Constraints

- **Key strength:** RSA-4096 minimum (SEC-10 enforces this at sign-script
  and verify-library level). Anything weaker is rejected with exit code 2.
- **Single operator (today):** Quang is the only person who signs
  licenses. There's no rotation pressure from departing employees.
- **Customer base:** small (low double-digits) at v1.4.4 ship. Growth
  trajectory is uncertain.
- **Compliance:** no PCI, SOC 2, or ISO 27001 audit on the horizon. Vietnam
  PDPA-equivalent (no formal cryptographic key storage mandate) applies.
- **Budget:** founder cash. Hardware spend has to demonstrably pay back.
- **Operational cadence:** signing happens on customer onboarding (manual,
  3 min per customer) and quarterly key rotation drills. Not a hot path.

### Options considered

#### A. Plaintext file on operator laptop (`~/op-license.priv.pem`)

| Aspect | Verdict |
| --- | --- |
| Setup cost | Zero |
| Operational cost | Zero |
| Key compromise blast radius | Laptop theft / malware / cloud sync to iCloud or Dropbox by accident → **total compromise** |
| Audit trail | None |
| Rotation cost | Trivial (overwrite file) |

**Rejected.** The blast radius is unacceptable. macOS Spotlight, Time
Machine backups, and accidental `git add .` all leak the key over time.

#### B. 1Password Secure Note + tmpfs ephemeral copy ✅ **CURRENT RECOMMENDATION**

The private key lives in a 1Password Secure Note. When signing, the
operator pulls it via `op` CLI to a `/dev/shm` (RAM-backed) directory,
runs the sign script, then `shred -uvz`s the file.

| Aspect | Verdict |
| --- | --- |
| Setup cost | One 1Password vault + CLI install (~10 min) |
| Operational cost | One extra command per signing session |
| Key compromise blast radius | 1Password master password + 2FA must both be compromised. Local machine compromise is mitigated by tmpfs (key never touches disk). |
| Audit trail | 1Password access log per session |
| Rotation cost | Trivial (paste new key into note) |
| Cost | $0 (existing 1Password subscription) |

**Strengths:**
- No new hardware purchase.
- Mature threat model — 1Password has been audited multiple times.
- Quang already uses 1Password for credentials.
- Aligns with the "always suggest the free / no-extra-tools-needed
  option first" rule in user prefs.

**Weaknesses:**
- 1Password as a service is a SaaS dependency. If 1Password is
  compromised at the org level, the key is compromised.
- Operator discipline required (the `shred` step). One sloppy session
  can leak the key to `~/Downloads`.
- Doesn't scale to "we now have 3 operators" — would need to share
  vault access, increasing the attack surface linearly.

#### C. YubiHSM 2 hardware module

A YubiHSM 2 is a tamper-resistant USB key that stores RSA-4096 keys
internally and exposes signing via PKCS#11. The key never exits the
device, even during a sign operation.

| Aspect | Verdict |
| --- | --- |
| Setup cost | ~4–8 hours (PKCS#11 wiring, OpenSC config, Node binding) |
| Operational cost | One extra step: plug in YubiHSM before signing |
| Key compromise blast radius | Physical theft of the YubiHSM + PIN knowledge → compromise. Without physical possession, key is unrecoverable. |
| Audit trail | YubiHSM internal log |
| Rotation cost | Generate new key on device (one-time, ~5 min) |
| Cost | ~$650 USD per device |

**Strengths:**
- Best-in-class threat model. Even a fully-compromised laptop can't
  extract the key.
- Scales gracefully to a multi-operator team: each operator gets their
  own YubiHSM, ACLs are managed on-device.
- Suitable for SOC 2 / ISO 27001 if those become requirements.

**Weaknesses:**
- $650 capital outlay for the founder.
- Software wiring effort (one-time, but real).
- Adds a "where's my YubiHSM today?" mental load.
- Single point of failure if you drop / lose / damage it (need a backup
  device pre-configured).

#### D. YubiKey 5 PIV — ECDSA P-384 ✅ **NEW IN v1.4.4 — VIABLE**

v1.4.4 adds ES384 (ECDSA P-384) as a parallel signing algorithm. The YubiKey
5 PIV slot **does** support ECDSA P-384 (it does not support RSA-4096). This
opens a $55 hardware path that's cryptographically stronger than RSA-4096.

| Aspect | Verdict |
| --- | --- |
| Setup cost | ~30 min (`yubico-piv-tool` install + key import) |
| Operational cost | Plug YubiKey in before signing; touch confirm |
| Key compromise blast radius | Physical theft of YubiKey + PIN → compromise. Without physical possession, key is unrecoverable. |
| Audit trail | PIV counter (per-slot use count) — not as rich as YubiHSM but sufficient |
| Rotation cost | Generate new key on device (one PIV reset, ~2 min) |
| Cost | ~$55 USD per device (YubiKey 5C NFC / 5C / 5 NFC) |
| Cryptographic strength | NIST P-384 ≈ 192-bit security ≈ RSA-7680 — **stronger than RSA-4096** |

**Strengths:**
- 10× cheaper than YubiHSM 2 with equivalent security guarantee.
- Stronger cryptographic strength than RSA-4096.
- Touch-to-sign physical confirmation prevents background-process exfiltration.
- Familiar hardware (you may already own one for SSH / WebAuthn).

**Weaknesses:**
- ECDSA signing is more sensitive to RNG quality than RSA (use the YubiKey's
  internal TRNG, never inject external entropy).
- PIN brute-force protection: device locks after 3 wrong PINs and requires
  PUK to unblock. Lose the PUK and the slot is unrecoverable.
- Single point of failure if you drop / lose / damage it (need a backup
  device pre-configured — see runbook §1.5).

**Recommended for:** Solo operator who wants hardware-bound signing without
the $650 YubiHSM 2 capital outlay. **THIS IS NOW THE PREFERRED PHASE-2
OPTION** unless you specifically need RSA-4096 for compliance reasons.

To use:
```bash
node scripts/op-key-generate.js --ec --basename=op-license-yubi
yubico-piv-tool -s 9c -a import-key -i op-license-yubi.priv.pem
shred -uvz op-license-yubi.priv.pem
cp op-license-yubi.pub.pem keys/op-license-pub.pem
```

Signing then uses the YubiKey PKCS#11 path (not yet wired in v1.4.4 toolkit —
hand-export the priv key through tmpfs for now, or wait for v1.5 to add the
PKCS#11 binding directly to op-license-sign.js).

#### E. AWS KMS / GCP KMS / Cloudflare API Shield Keystore

| Aspect | Verdict |
| --- | --- |
| Setup cost | ~2 hours per cloud |
| Operational cost | Per-sign API call latency (~200ms) + cloud charges |
| Key compromise blast radius | Cloud provider account compromise = key compromise. Quang's IAM root account + 2FA must hold. |
| Audit trail | CloudTrail / Cloud Audit Logs (good) |
| Rotation cost | API-driven, low |
| Cost | $1–5/month per key |

**Rejected for v1.4.4.** Two reasons:
1. Operator preference for on-prem control over cloud keystores at this
   stage. Vietnamese customers are wary of US-cloud-hosted secrets.
2. Adds a runtime dependency on a cloud provider for signing operations
   that should work offline (e.g. on a plane, during a network outage).

Revisit at v1.6+ if cloud-based signing becomes operationally cheaper
than YubiHSM.

## Decision

**Phase 1 (v1.4.4 → first paying customer): Option B (1Password Secure Note
+ tmpfs).** Aligns with founder cash discipline, requires no new hardware,
documented end-to-end in `docs/RUNBOOK.md` §1.3. RSA-4096 + RS256
algorithm.

**Phase 2 (as soon as the operator has 1 paying customer + 30 minutes for
setup): Option D (YubiKey 5 + P-384 PIV).** $55 hardware that's stronger
than RSA-4096, with touch-to-sign physical confirmation. ECDSA via ES384.
Switch the deployment's public key from RSA-4096 to P-384 by re-running
`node scripts/op-key-generate.js --ec` and shipping the new pub key. The
v1.4.4 verifier already accepts both algorithms.

**Phase 3 (50+ customers OR second operator OR compliance audit on horizon):
Option C (YubiHSM 2 + RSA-4096).** $650 hardware, network-attached PKCS#11.
Allows multi-operator access via on-device ACLs.

**Forbidden permanently:** Option A (plaintext file) and YubiKey 5 PIV with
RSA-2048 (will be refused by SEC-10 — must use P-384 path instead).

**Resolved confusion (was a hard rejection in v1.4.3 ADR draft):** YubiKey
5 PIV can NOT do RSA-4096, so naive RSA-only signing rejected it. v1.4.4
adds ES384 + P-384 specifically to make YubiKey 5 viable. Strictly speaking
P-384 is *more* secure than RSA-4096 (192-bit vs ~140-bit), so this is a
security upgrade, not a workaround.

## Consequences

- The runbook (`docs/RUNBOOK.md` §1.3) describes Option B as
  the default. Update to Option C when migrating.
- The toolkit (`scripts/op-license-sign.js`) takes `--priv=<path>` and
  doesn't care whether the path is a tmpfs mount or a YubiHSM PKCS#11
  URI. The eventual YubiHSM migration is a Node binding change inside the
  script, not a workflow change for the operator.
- Customer-facing behaviour is identical across all storage options —
  customers see signed JWTs verified by an RSA-4096 public key.

## References

- `docs/RUNBOOK.md` §1 (bootstrap), §4.4 (private key
  compromise procedure)
- `src/core/lib/licenseKey.js` (SEC-10 enforcement)
- `scripts/op-license-sign.js` (SEC-10 enforcement at sign time, exit
  code 2)
- YubiHSM 2 spec: https://www.yubico.com/products/yubihsm/
- YubiKey 5 PIV limits: https://docs.yubico.com/yesdk/users-manual/application-piv/keys/rsa.html
