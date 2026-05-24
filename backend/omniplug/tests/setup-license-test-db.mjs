/**
 * tests/setup-license-test-db.mjs
 *
 * Bootstraps a test environment for the red-team SEC suite. Generates
 * an RSA-4096 keypair in-memory (SEC-8 — NEVER writes private key to
 * disk), writes only the public key to a temp dir, then exposes both
 * via exports for tests to use.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let _cached = null;

/**
 * Generate a fresh keypair for tests. The private key is a KeyObject
 * (never PEM, never on disk). The public key IS written to a temp dir
 * so licenseKey.js can load it via LICENSE_PUBLIC_KEY_PATH.
 */
export function ensureTestKeys() {
  if (_cached) return _cached;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omniplug-sec-'));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
  });
  const pubPath = path.join(tmpDir, 'op-license-pub.pem');
  fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
  process.env.LICENSE_PUBLIC_KEY_PATH = pubPath;
  _cached = { publicKey, privateKey, pubPath, tmpDir };
  return _cached;
}

/**
 * Sign an arbitrary payload with the test keypair. Used to mint valid
 * test licenses + invalid ones (e.g. swap alg, mutate sig).
 */
export function signTestLicense(payload, privateKey, opts = {}) {
  const algName = opts.alg || 'RS256';
  const header = { alg: algName, typ: 'JWT' };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  if (algName === 'none') {
    return `${h}.${p}.`;
  }
  const sig = crypto.sign('sha256', Buffer.from(`${h}.${p}`), privateKey);
  return `${h}.${p}.${sig.toString('base64url')}`;
}

/**
 * Default valid-payload factory.
 */
export function defaultPayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    jti: `op-lic-test-${crypto.randomBytes(4).toString('hex')}`,
    iss: 'omniplug-operator',
    aud: 'omniplug-cms-core',
    iat: now,
    exp: now + 86400 * 30,
    plan: 'lite',
    signed_for: 'qa-test.local',
    customer_name: 'QA Test',
    customer_email: 'qa@example.com',
    ...overrides,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const k = ensureTestKeys();
  console.log(`[setup-license-test] public key at ${k.pubPath}`);
  console.log(`[setup-license-test] private key: in-memory only (SEC-8)`);
}
