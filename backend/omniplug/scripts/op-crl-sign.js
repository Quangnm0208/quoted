#!/usr/bin/env node
/**
 * scripts/op-crl-sign.js — Produce a signed CRL JSON envelope.
 *
 * The signed envelope is what customers POST to their server's
 * /api/admin/license/sync-crl. Server verifies the signature against
 * the operator public key (SEC-2), then writes the revocations.
 *
 * Usage (single):
 *   node scripts/op-crl-sign.js \
 *     --priv=op-license.priv.pem \
 *     --jti=op-lic-abc123 \
 *     --revoked-at=2026-05-19 \
 *     --reason=terms_violation \
 *     --out=crl-2026-05-19.json
 *
 * Usage (bulk — read from local DB):
 *   node scripts/op-crl-sign.js --priv=op-license.priv.pem --all --out=crl-all.json
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { signCrl } from '../src/core/lib/crl.js';
import db from '../src/core/db/connection.js';

const MIN_RSA_BITS = 4096;
const REQUIRED_EC_CURVE = 'secp384r1';

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith('--')) out[a.slice(2)] = true;
  }
  return out;
}

function loadPrivateKey(privPath) {
  if (!fs.existsSync(privPath)) {
    console.error(`✗ Private key not found: ${privPath}`);
    process.exit(2);
  }
  // Warn on loose perms
  try {
    const mode = fs.statSync(privPath).mode & 0o777;
    if (mode & 0o077) {
      console.warn(`⚠ Private key ${privPath} has loose permissions (${mode.toString(8)}). ` +
                   `Run: chmod 600 ${privPath}`);
    }
  } catch {}
  const pem = fs.readFileSync(privPath, 'utf8');
  const keyObj = crypto.createPrivateKey(pem);
  const details = keyObj.asymmetricKeyDetails || {};
  const keyType = keyObj.asymmetricKeyType;

  if (keyType === 'rsa' || keyType === 'rsa-pss') {
    if (!details.modulusLength || details.modulusLength < MIN_RSA_BITS) {
      console.error(`✗ REFUSE: RSA strength ${details.modulusLength || '?'} bits. Need RSA-${MIN_RSA_BITS}+ or EC P-384.`);
      process.exit(2);
    }
    return { keyObj, description: `RSA-${details.modulusLength}` };
  } else if (keyType === 'ec') {
    if (details.namedCurve !== REQUIRED_EC_CURVE) {
      console.error(`✗ REFUSE: EC curve ${details.namedCurve}. Need P-384 (${REQUIRED_EC_CURVE}).`);
      process.exit(2);
    }
    return { keyObj, description: 'EC P-384 (ES384)' };
  } else {
    console.error(`✗ REFUSE: unsupported key type ${keyType}. Need RSA-4096+ or EC P-384.`);
    process.exit(2);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.priv) {
    console.error('Usage: op-crl-sign.js --priv=<key.pem> ( --jti=<jti> --revoked-at=<iso> [--reason=<r>] | --all ) --out=<file.json>');
    process.exit(2);
  }
  const out = args.out || `crl-${Date.now()}.json`;
  const { keyObj: privKey, description: keyDesc } = loadPrivateKey(path.resolve(args.priv));

  let crlArray;
  if (args.all) {
    crlArray = db.prepare(`
      SELECT jti, revoked_at, reason FROM license_revocations ORDER BY revoked_at ASC
    `).all().map(r => ({ jti: r.jti, revoked_at: r.revoked_at, reason: r.reason || '' }));
    console.log(`▸ Found ${crlArray.length} revocation(s) in local DB`);
  } else if (args.jti) {
    crlArray = [{
      jti: args.jti,
      revoked_at: args['revoked-at'] || new Date().toISOString(),
      reason: args.reason || 'operator_revoke',
    }];
  } else {
    console.error('Either --all or --jti=<jti> is required');
    process.exit(2);
  }

  if (crlArray.length === 0) {
    console.warn('▸ CRL is empty — nothing to sign. Aborting.');
    process.exit(0);
  }

  const envelope = signCrl(crlArray, privKey);
  fs.writeFileSync(out, JSON.stringify(envelope, null, 2) + '\n');
  console.log(`✓ CRL signed with ${keyDesc} → ${out}`);
  console.log(`  entries:        ${crlArray.length}`);
  console.log(`  payload_hash:   ${envelope.crl_payload_hash}`);
  console.log(`  signature len:  ${envelope.crl_signature.length} chars`);
  console.log('');
  console.log('To distribute:');
  console.log('  1. Email this JSON to affected customers, OR');
  console.log('  2. Customer pastes content into /admin/license.html → "Sync CRL", OR');
  console.log('  3. curl -X POST https://<customer>/api/admin/license/sync-crl \\');
  console.log('       -H "Authorization: Bearer <admin-jwt>" \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log(`       --data @${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
