/**
 * core/lib/crl.js — Local CRL cache + signed-CRL ingest.
 *
 * v1.4.4 — see PROMPT v1.4.4 §3 SEC-2.
 *
 * The CRL is a list of {jti, revoked_at, reason} entries signed by the
 * same RSA-4096 operator key as licenses. Server REFUSES to apply an
 * unsigned or tampered CRL. Failure mode: silent — log and return 0
 * inserted. Never throws, never auto-bricks deployments on bad input.
 *
 * Sync transport in v1.4.4 = manual `POST /api/admin/license/sync-crl`
 * with an op-license-pub.pem-signed payload. Bridge server (v1.5.0)
 * will replace this with pull from telemetry.omniplug.com.
 */

import crypto from 'node:crypto';
import db from '../db/connection.js';
import { loadPublicKey } from './licenseKey.js';

/**
 * Canonical JSON representation of the CRL array. We hash this string,
 * sign it, and verify against that hash. Stable ordering matters or
 * the hash will differ between operator and customer.
 *
 * Note: we use plain JSON.stringify with no extra options. Both
 * operator (op-crl-sign.js) and customer (here) MUST use the same
 * serialization. If we ever change this, version the CRL envelope.
 */
function canonicalize(crlArray) {
  return JSON.stringify(crlArray);
}

/**
 * Verify and apply a signed CRL response. Returns the number of
 * revocations actually written (changes), or 0 on any validation
 * failure. Never throws.
 *
 * Expected shape:
 *   {
 *     crl: [{ jti, revoked_at, reason }, ...],
 *     crl_payload_hash: "sha256:<hex>",
 *     crl_signature:    "<base64url>"
 *   }
 */
export function syncCrl(response) {
  if (!response || !Array.isArray(response.crl)) {
    console.warn('[crl] response missing crl array, refusing to sync');
    return 0;
  }
  if (!response.crl_signature || !response.crl_payload_hash) {
    console.warn('[crl] response missing signature/payload_hash, refusing to sync');
    return 0;
  }

  // Verify payload_hash matches canonical(crl)
  const canonical = canonicalize(response.crl);
  const actualHash = 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
  if (actualHash !== response.crl_payload_hash) {
    console.warn(`[crl] payload_hash mismatch (got ${response.crl_payload_hash}, computed ${actualHash}), refusing to sync`);
    return 0;
  }

  // Verify signature over the payload_hash bytes
  let pubKey;
  try {
    pubKey = loadPublicKey();
  } catch (err) {
    console.warn(`[crl] cannot load public key for verification: ${err.message}`);
    return 0;
  }

  let sigBuf;
  try {
    sigBuf = Buffer.from(response.crl_signature, 'base64url');
  } catch {
    console.warn('[crl] signature not base64url, refusing to sync');
    return 0;
  }

  let valid = false;
  try {
    // Detect algorithm from the loaded public key
    const keyType = pubKey.asymmetricKeyType;
    const details = pubKey.asymmetricKeyDetails || {};
    if (keyType === 'rsa' || keyType === 'rsa-pss') {
      valid = crypto.verify('sha256', Buffer.from(response.crl_payload_hash), pubKey, sigBuf);
    } else if (keyType === 'ec' && details.namedCurve === 'secp384r1') {
      // ES384 over the payload-hash string. Raw r||s = 96 bytes for P-384.
      if (sigBuf.length !== 96) {
        console.warn(`[crl] ES384 signature must be 96 bytes (got ${sigBuf.length}), refusing to sync`);
        return 0;
      }
      valid = crypto.verify(
        'sha384',
        Buffer.from(response.crl_payload_hash),
        { key: pubKey, dsaEncoding: 'ieee-p1363' },
        sigBuf
      );
    } else {
      console.warn(`[crl] unsupported key type ${keyType} for CRL verify, refusing to sync`);
      return 0;
    }
  } catch (err) {
    console.warn(`[crl] signature verify threw: ${err.message}`);
    return 0;
  }
  if (!valid) {
    console.warn('[crl] signature invalid, refusing to sync');
    return 0;
  }

  // Safe to write. Idempotent UPSERT — re-syncing the same CRL is OK.
  const stmt = db.prepare(`
    INSERT INTO license_revocations (jti, revoked_at, reason, synced_at)
    VALUES (@jti, @revoked_at, @reason, datetime('now'))
    ON CONFLICT(jti) DO UPDATE SET
      revoked_at = excluded.revoked_at,
      reason     = excluded.reason,
      synced_at  = excluded.synced_at
  `);
  const markLicenseRevoked = db.prepare(`
    UPDATE licenses SET status = 'revoked', updated_at = datetime('now') WHERE jti = ?
  `);

  let changes = 0;
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      if (!row.jti) continue;
      stmt.run({
        jti: String(row.jti),
        revoked_at: String(row.revoked_at || new Date().toISOString()),
        reason: String(row.reason || ''),
      });
      markLicenseRevoked.run(String(row.jti));
      changes++;
    }
  });
  tx(response.crl);
  console.log(`[crl] applied ${changes} revocation(s) from signed CRL`);
  return changes;
}

/**
 * Is a given jti currently revoked?
 * Cheap O(1) PK lookup. Called from license middleware on every gate.
 */
const _isRevokedStmt = (() => {
  let s = null;
  return () => {
    if (!s) s = db.prepare('SELECT 1 FROM license_revocations WHERE jti = ? LIMIT 1');
    return s;
  };
})();

export function isRevoked(jti) {
  if (!jti) return false;
  return Boolean(_isRevokedStmt().get(String(jti)));
}

/**
 * For operator CLI: sign a CRL array with a private key. Returns the
 * wire-format envelope ready to POST to /api/admin/license/sync-crl.
 *
 * Auto-detects the private key algorithm:
 *   - RSA: signs with RS256 (sha256), DER signature
 *   - EC P-384: signs with ES384 (sha384), raw r||s 96-byte signature
 *
 * This is used by scripts/op-crl-sign.js — NOT by the runtime server.
 * Re-exported here so the operator script and the server share the
 * canonicalization function (no drift).
 */
export function signCrl(crlArray, privateKey) {
  if (!Array.isArray(crlArray)) {
    throw new Error('signCrl: crlArray must be array');
  }
  const canonical = canonicalize(crlArray);
  const payloadHash = 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');

  const keyObj = privateKey instanceof crypto.KeyObject
    ? privateKey
    : crypto.createPrivateKey(privateKey);
  const keyType = keyObj.asymmetricKeyType;
  const details = keyObj.asymmetricKeyDetails || {};

  let sig;
  if (keyType === 'rsa' || keyType === 'rsa-pss') {
    sig = crypto.sign('sha256', Buffer.from(payloadHash), keyObj);
  } else if (keyType === 'ec' && details.namedCurve === 'secp384r1') {
    sig = crypto.sign(
      'sha384',
      Buffer.from(payloadHash),
      { key: keyObj, dsaEncoding: 'ieee-p1363' }
    );
  } else {
    throw new Error(`signCrl: unsupported key type ${keyType} (curve=${details.namedCurve}). Need RSA or EC P-384.`);
  }

  return {
    crl: crlArray,
    crl_payload_hash: payloadHash,
    crl_signature: sig.toString('base64url'),
  };
}
