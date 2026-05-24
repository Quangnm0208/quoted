/**
 * core/lib/licenseKey.js — License JWT verification.
 *
 * v1.4.4 — see PROMPT v1.4.4 §3 SEC-4, SEC-10, SEC-11.
 *
 * Design:
 *   - Two algorithm options, both ≥ NIST 192-bit security:
 *       * RS256 with RSA ≥ 4096 bits   (~140-bit security)
 *       * ES384 with NIST P-384 curve  (~192-bit security; stronger than RSA-4096)
 *     HS256 / none / RS256 with weak RSA / ES256 (P-256) all refused.
 *   - Public key loaded once from LICENSE_PUBLIC_KEY_PATH (env).
 *   - The JWT header alg must match the loaded key type (RSA→RS256, EC→ES384);
 *     mismatch returns LICENSE_BAD_ALG to prevent confused-deputy attacks.
 *   - In-process LRU cache (max 1000 entries, TTL 60s) so /api/v1/* gating
 *     doesn't re-verify the same JWT on every request.
 *   - 8 KB hard cap on JWT length — anything bigger is refused before
 *     any crypto work (DoS).
 *
 * Why two algorithms:
 *   YubiHSM 2 supports RSA-4096 (use RS256). YubiKey 5 PIV does NOT support
 *   RSA-4096 (only RSA-2048, which fails our minimum), but YubiKey 5 DOES
 *   support ECDSA P-384 in PIV, which is cryptographically stronger than
 *   RSA-4096. ES384 lets operators use a $55 YubiKey 5 instead of a $650
 *   YubiHSM 2 without security regression.
 *
 * Public payload contract:
 *   {
 *     jti:           string,   // unique per license
 *     iss:           'omniplug-operator',
 *     aud:           'omniplug-cms-core',
 *     iat:           number,   // unix seconds
 *     exp:           number,   // unix seconds (optional, perpetual if absent)
 *     plan:          'community'|'lite'|'standard'|'pro'|'pro_plus',
 *     signed_for:    string,   // domain (verified against tenant at activate)
 *     customer_name: string,
 *     customer_email: string,
 *     features:      object    // optional feature flags
 *   }
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ----- Algorithm constants -----
const ALLOWED_ALGS = new Set(['RS256', 'ES384']);
const REQUIRED_ISS = 'omniplug-operator';
const REQUIRED_AUD = 'omniplug-cms-core';
const MIN_RSA_BITS = 4096;
const REQUIRED_EC_CURVE = 'secp384r1';   // NIST P-384, matches YubiKey 5 PIV
const JWT_MAX_BYTES = 8 * 1024;          // SEC-11 (DoS)
const CACHE_MAX = 1000;                  // SEC-4 (memory)
const CACHE_TTL_MS = 60 * 1000;

// ----- Public key (lazy-loaded, validated for strength) -----
let _publicKey = null;
let _publicKeyPath = null;
let _publicKeyAlg = null;   // 'RS256' or 'ES384' — derived from key type

/**
 * Resolve the public-key path. Default: <repo>/keys/op-license-pub.pem
 * Override via LICENSE_PUBLIC_KEY_PATH for tests.
 */
function resolveKeyPath() {
  return process.env.LICENSE_PUBLIC_KEY_PATH ||
    path.resolve(process.cwd(), 'keys', 'op-license-pub.pem');
}

/**
 * Load + cache the operator public key. SEC-10: refuse weak keys.
 * Accepted types:
 *   - RSA with modulusLength ≥ 4096
 *   - EC with namedCurve === 'secp384r1' (NIST P-384)
 * Throws if file missing, malformed, weak, or wrong-curve.
 */
export function loadPublicKey() {
  if (_publicKey) return _publicKey;
  const keyPath = resolveKeyPath();
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `License public key not found at ${keyPath}. ` +
      `Set LICENSE_PUBLIC_KEY_PATH or place an RSA-4096 / P-384 PEM at keys/op-license-pub.pem. ` +
      `See docs/RUNBOOK.md §4.1.`
    );
  }
  const pem = fs.readFileSync(keyPath, 'utf8');
  if (/TODO_OPERATOR_PUBLIC_KEY_PEM/i.test(pem)) {
    throw new Error(
      `License public key at ${keyPath} still contains TODO_OPERATOR_PUBLIC_KEY_PEM marker. ` +
      `Operator must provision the real key before strict enforcement.`
    );
  }
  let keyObj;
  try {
    keyObj = crypto.createPublicKey(pem);
  } catch (err) {
    throw new Error(`License public key at ${keyPath} is malformed: ${err.message}`);
  }
  const details = keyObj.asymmetricKeyDetails || {};
  const keyType = keyObj.asymmetricKeyType;

  if (keyType === 'rsa' || keyType === 'rsa-pss') {
    if (!details.modulusLength) {
      throw new Error(`License public key at ${keyPath}: RSA modulusLength missing`);
    }
    if (details.modulusLength < MIN_RSA_BITS) {
      throw new Error(
        `License public key too weak (${details.modulusLength} bits, need >= ${MIN_RSA_BITS}). ` +
        `See docs/RUNBOOK.md §4.7 for key strength policy.`
      );
    }
    _publicKeyAlg = 'RS256';
  } else if (keyType === 'ec') {
    if (details.namedCurve !== REQUIRED_EC_CURVE) {
      throw new Error(
        `License public key uses wrong EC curve (${details.namedCurve || 'unknown'}, need ${REQUIRED_EC_CURVE}). ` +
        `P-256 is too weak; v1.4.4 requires P-384 (NIST). ` +
        `See docs/RUNBOOK.md §4.7.`
      );
    }
    _publicKeyAlg = 'ES384';
  } else {
    throw new Error(
      `License public key at ${keyPath} is not RSA or EC (got ${keyType || 'unknown'}). ` +
      `Allowed: RSA-4096+ or EC P-384.`
    );
  }

  _publicKey = keyObj;
  _publicKeyPath = keyPath;
  return _publicKey;
}

/**
 * Returns the algorithm the loaded public key is bound to ('RS256' or 'ES384').
 * Useful for boot logs and operator scripts.
 */
export function getPublicKeyAlg() {
  if (!_publicKey) loadPublicKey();
  return _publicKeyAlg;
}

/**
 * For tests: reset the cached public key so a re-call of loadPublicKey
 * re-reads from disk. Production code should never call this.
 */
export function _resetPublicKeyCacheForTests() {
  _publicKey = null;
  _publicKeyPath = null;
  _publicKeyAlg = null;
}

// ----- LRU verification cache (SEC-4) -----
const _cache = new Map();   // insertion-ordered → use ordering for LRU eviction

function cacheGet(token) {
  const entry = _cache.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    _cache.delete(token);
    return null;
  }
  // refresh LRU position
  _cache.delete(token);
  _cache.set(token, entry);
  return entry.payload;
}

function cacheSet(token, payload) {
  if (_cache.size >= CACHE_MAX) {
    const oldestKey = _cache.keys().next().value;
    _cache.delete(oldestKey);
  }
  _cache.set(token, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function _cacheSizeForTests() {
  return _cache.size;
}

export function _clearCacheForTests() {
  _cache.clear();
}

// ----- Base64url helpers -----
function b64uDecode(str) {
  return Buffer.from(str, 'base64url');
}

// ----- Verify -----

/**
 * Verify a license JWT. Returns the decoded payload on success.
 * Throws an Error with `.code` set on failure.
 *
 * Throwable codes:
 *   LICENSE_TOO_LARGE      — > 8KB
 *   LICENSE_MALFORMED      — not three b64url-encoded segments
 *   LICENSE_BAD_ALG        — header alg !== RS256
 *   LICENSE_BAD_ISS        — iss !== omniplug-operator
 *   LICENSE_BAD_AUD        — aud !== omniplug-cms-core
 *   LICENSE_BAD_SIG        — signature did not verify
 *   LICENSE_EXPIRED        — exp < now
 *   LICENSE_BAD_PLAN       — plan not in allowed set
 *   LICENSE_KEY_NOT_READY  — public key not provisioned (boot will refuse)
 */
const ALLOWED_PLANS = new Set(['community', 'lite', 'standard', 'pro', 'pro_plus']);

export function verifyLicense(jwt) {
  if (typeof jwt !== 'string' || jwt.length === 0) {
    const e = new Error('License JWT must be a non-empty string');
    e.code = 'LICENSE_MALFORMED';
    throw e;
  }
  if (Buffer.byteLength(jwt, 'utf8') > JWT_MAX_BYTES) {
    const e = new Error(`License JWT exceeds ${JWT_MAX_BYTES} bytes`);
    e.code = 'LICENSE_TOO_LARGE';
    throw e;
  }

  // Cache hit?
  const cached = cacheGet(jwt);
  if (cached) {
    // Re-check exp on cache hit — TTL is shorter than typical license life
    // so this rarely matters, but defensive.
    if (cached.exp && cached.exp * 1000 < Date.now()) {
      const e = new Error('License expired');
      e.code = 'LICENSE_EXPIRED';
      throw e;
    }
    return cached;
  }

  const parts = jwt.split('.');
  if (parts.length !== 3) {
    const e = new Error('License JWT must have three segments');
    e.code = 'LICENSE_MALFORMED';
    throw e;
  }
  const [h, p, s] = parts;

  let header, payload;
  try {
    header = JSON.parse(b64uDecode(h).toString('utf8'));
    payload = JSON.parse(b64uDecode(p).toString('utf8'));
  } catch (err) {
    const e = new Error('License JWT header/payload not valid JSON');
    e.code = 'LICENSE_MALFORMED';
    throw e;
  }

  if (!ALLOWED_ALGS.has(header.alg)) {
    const e = new Error(`License JWT alg must be RS256 or ES384, got ${header.alg}`);
    e.code = 'LICENSE_BAD_ALG';
    throw e;
  }

  const pubKey = loadPublicKey();
  // Defense in depth: JWT alg must match the loaded key type. Prevents an
  // attacker from passing an ES384-shaped JWT when the deployment runs RSA
  // (or vice versa).
  if (header.alg !== _publicKeyAlg) {
    const e = new Error(`License JWT alg ${header.alg} does not match deployment key algorithm ${_publicKeyAlg}`);
    e.code = 'LICENSE_BAD_ALG';
    throw e;
  }

  const signingInput = Buffer.from(`${h}.${p}`);
  let signature;
  try {
    signature = b64uDecode(s);
  } catch {
    const e = new Error('License JWT signature not base64url');
    e.code = 'LICENSE_MALFORMED';
    throw e;
  }

  // ES384 in JWT uses raw r||s concat (96 bytes for P-384). Node's crypto.verify
  // expects ASN.1 DER for EC by default; pass dsaEncoding: 'ieee-p1363' to use
  // the raw r||s format directly (Node 16+).
  let valid;
  try {
    if (header.alg === 'RS256') {
      valid = crypto.verify('sha256', signingInput, pubKey, signature);
    } else {
      // ES384
      if (signature.length !== 96) {
        const e = new Error(`ES384 signature must be 96 bytes, got ${signature.length}`);
        e.code = 'LICENSE_BAD_SIG';
        throw e;
      }
      valid = crypto.verify(
        'sha384',
        signingInput,
        { key: pubKey, dsaEncoding: 'ieee-p1363' },
        signature
      );
    }
  } catch (err) {
    if (err.code === 'LICENSE_BAD_SIG') throw err;
    const e = new Error(`License JWT signature verification failed: ${err.message}`);
    e.code = 'LICENSE_BAD_SIG';
    throw e;
  }
  if (!valid) {
    const e = new Error('License JWT signature did not verify');
    e.code = 'LICENSE_BAD_SIG';
    throw e;
  }

  // Claim checks
  if (payload.iss !== REQUIRED_ISS) {
    const e = new Error(`License JWT iss must be ${REQUIRED_ISS}, got ${payload.iss}`);
    e.code = 'LICENSE_BAD_ISS';
    throw e;
  }
  if (payload.aud !== REQUIRED_AUD) {
    const e = new Error(`License JWT aud must be ${REQUIRED_AUD}, got ${payload.aud}`);
    e.code = 'LICENSE_BAD_AUD';
    throw e;
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    const e = new Error('License expired');
    e.code = 'LICENSE_EXPIRED';
    throw e;
  }
  if (!payload.plan || !ALLOWED_PLANS.has(payload.plan)) {
    const e = new Error(`License plan invalid: ${payload.plan}`);
    e.code = 'LICENSE_BAD_PLAN';
    throw e;
  }
  if (!payload.jti) {
    const e = new Error('License JWT missing jti');
    e.code = 'LICENSE_MALFORMED';
    throw e;
  }

  cacheSet(jwt, payload);
  return payload;
}
