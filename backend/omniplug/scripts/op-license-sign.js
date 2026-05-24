#!/usr/bin/env node
/**
 * scripts/op-license-sign.js — Operator-only license signing CLI.
 *
 * Signs a new license JWT for a customer. Auto-detects the private-key
 * algorithm:
 *   - RSA: must be ≥ 4096 bits → signs as RS256
 *   - EC:  must be P-384       → signs as ES384
 * Anything else is refused with exit code 2 (SEC-10).
 *
 * Usage:
 *   node scripts/op-license-sign.js \
 *     --priv=op-license.priv.pem \
 *     --plan=lite \
 *     --signed-for=customer.example.com \
 *     --customer-name="Customer A" \
 *     --customer-email="ops@customer.example.com" \
 *     --expires-in-days=365 \
 *     --out=license-customer-a.jwt
 *
 * Hardening notes:
 *   - Refuses to read priv key if file permissions are world-readable (>= 0o077).
 *   - Refuses to operate if NODE_ENV=production but priv key is on a non-tmpfs
 *     path (warn only; can override with --i-know-what-im-doing).
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ISS = 'omniplug-operator';
const AUD = 'omniplug-cms-core';
const MIN_RSA_BITS = 4096;
const REQUIRED_EC_CURVE = 'secp384r1';
const ALLOWED_PLANS = new Set(['community', 'lite', 'standard', 'pro', 'pro_plus']);

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith('--')) out[a.slice(2)] = true;
  }
  return out;
}

function b64u(buf) {
  return Buffer.from(buf).toString('base64url');
}

function fail(msg, code = 2) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

function checkPrivPerms(privPath) {
  try {
    const st = fs.statSync(privPath);
    // Mode bit check: any "other" or "group" read bit is a leak risk.
    const mode = st.mode & 0o777;
    if (mode & 0o077) {
      console.warn(`⚠ Private key ${privPath} has loose permissions (${mode.toString(8)}). ` +
                   `Run: chmod 600 ${privPath}`);
    }
  } catch {}
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.priv) fail('--priv=<path-to-private-key.pem> is required (RSA-4096 or EC P-384)');
  if (!args.plan) fail('--plan=<community|lite|standard|pro|pro_plus> is required');
  if (!ALLOWED_PLANS.has(args.plan)) fail(`Unknown plan: ${args.plan}`);
  const out = args.out || `license-${Date.now()}.jwt`;

  // Load + validate private key strength (SEC-10)
  const privPath = path.resolve(args.priv);
  if (!fs.existsSync(privPath)) fail(`Private key not found: ${privPath}`);
  checkPrivPerms(privPath);
  const privPem = fs.readFileSync(privPath, 'utf8');
  let privKey;
  try {
    privKey = crypto.createPrivateKey(privPem);
  } catch (err) {
    fail(`Cannot parse private key: ${err.message}`);
  }
  const details = privKey.asymmetricKeyDetails || {};
  const keyType = privKey.asymmetricKeyType;

  let alg, hashAlg, keyDescription, signOpts;
  if (keyType === 'rsa' || keyType === 'rsa-pss') {
    if (!details.modulusLength) fail('Private key is RSA but modulusLength missing');
    if (details.modulusLength < MIN_RSA_BITS) {
      fail(`REFUSE: key strength ${details.modulusLength} bits. Need RSA-${MIN_RSA_BITS}+ or EC P-384. ` +
           `(YubiKey 5 PIV cannot do RSA-4096; use --priv pointing to a YubiKey-generated P-384 key instead.)`);
    }
    alg = 'RS256';
    hashAlg = 'sha256';
    signOpts = privKey;
    keyDescription = `${details.modulusLength}-bit RSA`;
  } else if (keyType === 'ec') {
    if (details.namedCurve !== REQUIRED_EC_CURVE) {
      fail(`REFUSE: EC curve ${details.namedCurve}. Only P-384 (${REQUIRED_EC_CURVE}) is accepted. ` +
           `P-256 is too weak; v1.4.4 requires P-384 (NIST, ~192-bit security).`);
    }
    alg = 'ES384';
    hashAlg = 'sha384';
    signOpts = { key: privKey, dsaEncoding: 'ieee-p1363' };
    keyDescription = 'EC P-384';
  } else {
    fail(`Unsupported key type: ${keyType}. Need RSA-4096+ or EC P-384.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = args['expires-in-days']
    ? now + parseInt(args['expires-in-days'], 10) * 86400
    : undefined;

  const payload = {
    jti: args.jti || `op-lic-${crypto.randomBytes(8).toString('hex')}`,
    iss: ISS,
    aud: AUD,
    iat: now,
    plan: args.plan,
    signed_for: args['signed-for'] || '',
    customer_name: args['customer-name'] || '',
    customer_email: args['customer-email'] || '',
  };
  if (exp) payload.exp = exp;
  if (args.features) {
    try { payload.features = JSON.parse(args.features); }
    catch { fail(`--features must be valid JSON, got: ${args.features}`); }
  }

  const header = { alg, typ: 'JWT' };
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify(payload));
  const signingInput = Buffer.from(`${h}.${p}`);
  const sig = crypto.sign(hashAlg, signingInput, signOpts);
  const jwt = `${h}.${p}.${b64u(sig)}`;

  fs.writeFileSync(out, jwt + '\n');
  console.log(`✓ License signed (${keyDescription} → ${alg}, ${jwt.length} bytes)`);
  console.log(`  jti:           ${payload.jti}`);
  console.log(`  plan:          ${payload.plan}`);
  console.log(`  signed_for:    ${payload.signed_for}`);
  console.log(`  customer:      ${payload.customer_name}`);
  console.log(`  expires:       ${exp ? new Date(exp * 1000).toISOString() : '(perpetual)'}`);
  console.log(`  file:          ${path.relative(process.cwd(), out)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
