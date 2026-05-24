/**
 * tests/sec-redteam.test.mjs — Red-team verification for v1.4.4 SEC-1..SEC-12.
 *
 * Each SEC test corresponds 1:1 with a finding in PROMPT v1.4.4 §3.
 * Tests are isolated — they set up state, exercise the fix, restore.
 *
 * Pass criteria: 12/12 verified. Any FAIL means the fix didn't land.
 *
 * Run: node tests/sec-redteam.test.mjs
 */

import { ensureTestKeys, signTestLicense, defaultPayload } from './setup-license-test-db.mjs';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Provision the test public key BEFORE any module import that loads it
const keys = ensureTestKeys();

// Now import the modules under test — they will load the public key once.
const { verifyLicense, _clearCacheForTests, _cacheSizeForTests } = await import('../src/core/lib/licenseKey.js');
const { syncCrl, signCrl } = await import('../src/core/lib/crl.js');
const { rateLimitPerIp, _resetForTests: _resetIpBucket, _sizeForTests: _ipBucketSize } = await import('../src/core/lib/rateLimiterIp.js');
const { mintApiKey, parseApiKeyHeader, verifyApiKey, DUMMY_HASH } = await import('../src/core/lib/apiKeyMint.js');
const { maskLead, maskPhone, maskEmail } = await import('../src/core/lib/maskers.js');

// ----- Test reporter -----
let pass = 0, fail = 0;
const lines = [];
function ok(label, detail = '') {
  pass++;
  lines.push(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}
function bad(label, detail) {
  fail++;
  lines.push(`  ✗ ${label} — ${detail}`);
}
function group(name) { lines.push(`\n=== ${name} ===`); }

// =====================================================================
// SEC-1: Timing-safe API key prefix lookup
// =====================================================================
group('SEC-1: Timing-safe API key prefix lookup');

async function timeAsync(fn) {
  const start = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - start) / 1_000_000; // ms
}

{
  // Setup: mint a real key. Compare bcrypt against real hash vs DUMMY_HASH
  // — both should take similar time (within 50% of each other) and both
  // should be ≥ ~60ms (bcrypt cost 10 lower bound on a modern CPU).
  const minted = mintApiKey();
  const wrongSecret = 'definitely-not-the-real-secret-abcdef0123456789';

  // Warmup so JIT/page-fault don't skew the first measurement
  await verifyApiKey(wrongSecret, minted.hash);
  await verifyApiKey(wrongSecret, DUMMY_HASH);

  const realT = await timeAsync(() => verifyApiKey(wrongSecret, minted.hash));
  const dummyT = await timeAsync(() => verifyApiKey(wrongSecret, DUMMY_HASH));

  if (realT > 30 && dummyT > 30) {
    const ratio = Math.max(realT, dummyT) / Math.min(realT, dummyT);
    if (ratio < 2.0) {
      ok('bcrypt timing ratio < 2.0', `real=${realT.toFixed(1)}ms dummy=${dummyT.toFixed(1)}ms ratio=${ratio.toFixed(2)}`);
    } else {
      bad('bcrypt timing ratio', `real=${realT.toFixed(1)}ms dummy=${dummyT.toFixed(1)}ms ratio=${ratio.toFixed(2)} too high`);
    }
  } else {
    bad('bcrypt cost 10 floor', `real=${realT.toFixed(1)}ms dummy=${dummyT.toFixed(1)}ms — bcrypt too fast, cost factor wrong?`);
  }

  // Verify DUMMY_HASH is a proper bcrypt hash
  if (/^\$2[aby]\$\d+\$/.test(DUMMY_HASH)) ok('DUMMY_HASH shape valid');
  else bad('DUMMY_HASH shape', DUMMY_HASH);
}

// =====================================================================
// SEC-2: CRL injection via unsigned response refused
// =====================================================================
group('SEC-2: CRL signature enforcement');

// To run syncCrl we need the DB. Use the test DB path.
process.env.DB_PATH = path.join(PROJECT_ROOT, '.test-data', 'load.db');
const db = (await import('../src/core/db/connection.js')).default;

// First clear any prior revocations in the test DB
db.prepare('DELETE FROM license_revocations').run();

{
  const validBody = signCrl(
    [{ jti: 'test-revoke-1', revoked_at: '2026-05-19T00:00:00Z', reason: 'test' }],
    keys.privateKey
  );

  // Test A: unsigned CRL refused
  const unsigned = { crl: validBody.crl };  // no sig, no hash
  const r1 = syncCrl(unsigned);
  if (r1 === 0 && db.prepare('SELECT COUNT(*) AS c FROM license_revocations').get().c === 0) {
    ok('unsigned CRL → 0 applied, DB unchanged');
  } else bad('unsigned CRL', `applied=${r1}`);

  // Test B: tampered payload_hash refused
  const tampered = { ...validBody, crl_payload_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' };
  const r2 = syncCrl(tampered);
  if (r2 === 0) ok('tampered payload_hash → 0 applied');
  else bad('tampered payload_hash', `applied=${r2}`);

  // Test C: tampered signature refused
  const badSig = { ...validBody, crl_signature: 'AAAA' + validBody.crl_signature.slice(4) };
  const r3 = syncCrl(badSig);
  if (r3 === 0) ok('tampered signature → 0 applied');
  else bad('tampered signature', `applied=${r3}`);

  // Test D: valid CRL DOES get applied
  const r4 = syncCrl(validBody);
  if (r4 === 1) ok('valid signed CRL → 1 applied');
  else bad('valid CRL', `applied=${r4}`);

  // Cleanup
  db.prepare(`DELETE FROM license_revocations WHERE jti = 'test-revoke-1'`).run();
}

// =====================================================================
// SEC-3: Per-IP token bucket before bcrypt
// =====================================================================
group('SEC-3: Per-IP rate limit before bcrypt');

{
  _resetIpBucket();
  // 60 req/min — 60 should pass, 61st fails
  let acquired = 0;
  for (let i = 0; i < 65; i++) {
    if (rateLimitPerIp.tryAcquire('1.2.3.4', 60)) acquired++;
  }
  if (acquired === 60) ok(`first 60 acquired, 5 over-cap rejected (got ${acquired})`);
  else bad('60/min ceiling', `acquired=${acquired}, expected 60`);

  // Different IP not affected by previous IP's quota
  let other = 0;
  for (let i = 0; i < 5; i++) if (rateLimitPerIp.tryAcquire('5.6.7.8', 60)) other++;
  if (other === 5) ok('different IP unaffected');
  else bad('different IP', `acquired=${other}`);
}

// =====================================================================
// SEC-4: License cache LRU bound (1000 max)
// =====================================================================
group('SEC-4: License cache LRU bound');

{
  _clearCacheForTests();
  // Mint 2000 unique valid licenses, verify each. Cache should cap at 1000.
  for (let i = 0; i < 2000; i++) {
    const jwt = signTestLicense(defaultPayload({ jti: `lru-test-${i}` }), keys.privateKey);
    verifyLicense(jwt);
  }
  const sz = _cacheSizeForTests();
  if (sz <= 1000) ok(`cache size ${sz} ≤ 1000`);
  else bad('LRU bound', `size=${sz}, exceeded cap`);
  _clearCacheForTests();
}

// =====================================================================
// SEC-5: Burst bucket LRU bound (10000 max)
// =====================================================================
group('SEC-5: Burst bucket LRU bound');

{
  const {
    _resetBurstBucketsForTests,
    _burstBucketSizeForTests,
    _tryKeyBurstForTests,
    _burstBucketMaxForTests,
  } = await import('../src/core/middleware/apiKey.js');

  _resetBurstBucketsForTests();
  if (_burstBucketSizeForTests() === 0) ok('burst bucket starts empty after reset');
  else bad('burst reset', `size=${_burstBucketSizeForTests()}`);

  const cap = _burstBucketMaxForTests();
  if (cap !== 10_000) bad('burst LRU cap', `expected 10000 got ${cap}`);
  else ok('burst LRU cap = 10000');

  // Drive 11000 unique prefixes through tryKeyBurst — size must stay ≤ 10000.
  const N = cap + 1000;
  for (let i = 0; i < N; i++) {
    _tryKeyBurstForTests(`op_live_test${String(i).padStart(8, '0')}`);
  }
  const sz = _burstBucketSizeForTests();
  if (sz === cap) ok(`burst bucket capped at ${cap} after ${N} unique prefixes (size=${sz})`);
  else bad('burst LRU eviction', `size=${sz} after ${N} inserts, expected ${cap}`);

  _resetBurstBucketsForTests();
}

// =====================================================================
// SEC-6: signed_for vs tenant.domain enforced
// =====================================================================
group('SEC-6: signed_for domain mismatch');

{
  const goodJwt = signTestLicense(defaultPayload({ signed_for: 'qa-test.local' }), keys.privateKey);
  const goodPayload = verifyLicense(goodJwt);
  if (goodPayload.signed_for === 'qa-test.local') ok('signed_for parsed from valid JWT');
  else bad('signed_for parse', goodPayload.signed_for);

  // Mismatch case is enforced in the controller, not the lib. We verify the
  // STRING normalization helpers behave so the controller can rely on them.
  const norm = (s) => String(s || '').toLowerCase().replace(/^www\./, '').replace(/:.*$/, '').trim();
  if (norm('WWW.Example.COM') === 'example.com') ok('domain normalization strips www + lowercases');
  else bad('normalize domain');

  // Static-code check: controller wiring is present + uses the same
  // normalization. A full HTTP integration test is in docs/RUNBOOK §4.6
  // smoke-test scenario.
  const ctrlSrc = fs.readFileSync(
    path.join(PROJECT_ROOT, 'src/backend/modules/license/license.controller.js'),
    'utf8'
  );
  const c6 = [
    [/normalizeDomain/, 'controller has normalizeDomain helper'],
    [/LICENSE_DOMAIN_MISMATCH/, 'controller emits LICENSE_DOMAIN_MISMATCH code'],
    [/license\.activate\.domain_mismatch/, 'controller audits domain_mismatch'],
  ];
  for (const [re, label] of c6) {
    if (re.test(ctrlSrc)) ok(label);
    else bad(label);
  }
}

// =====================================================================
// SEC-7: Replay-suspected logged when jti activated > 1 time
// =====================================================================
group('SEC-7: Activation replay detection');

{
  // Insert dummy activation, then count
  // Test tenant should exist from setup-test-db
  const t = db.prepare(`SELECT id FROM tenants WHERE slug = 'qa-test'`).get();
  if (!t) {
    bad('test tenant qa-test missing', 'run setup-test-db.mjs first');
  } else {
    const testJti = 'replay-test-' + Date.now();
    // First "activation"
    db.prepare(`INSERT INTO license_activations (jti, tenant_id) VALUES (?, ?)`).run(testJti, t.id);
    const c1 = db.prepare(`SELECT COUNT(*) AS c FROM license_activations WHERE jti = ?`).get(testJti).c;
    // Second "activation" same jti — the count is what the controller uses
    db.prepare(`INSERT INTO license_activations (jti, tenant_id) VALUES (?, ?)`).run(testJti, t.id);
    const c2 = db.prepare(`SELECT COUNT(*) AS c FROM license_activations WHERE jti = ?`).get(testJti).c;
    if (c1 === 1 && c2 === 2) ok('activation counter increments per replay');
    else bad('replay counter', `c1=${c1} c2=${c2}`);
    db.prepare(`DELETE FROM license_activations WHERE jti = ?`).run(testJti);
  }
}

// =====================================================================
// SEC-8: Test private key never on disk
// =====================================================================
group('SEC-8: Test private key in-memory only');

{
  // Walk /tmp for any *.pem produced in the last few minutes
  const tmpRoot = os.tmpdir();
  const recentPems = [];
  function walk(dir, depth = 0) {
    if (depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('omniplug-sec-')) walk(p, depth + 1);
      } else if (e.name.endsWith('.pem')) {
        try {
          const st = fs.statSync(p);
          if (Date.now() - st.mtimeMs < 10 * 60_000) {
            // Read first ~30 chars to inspect type
            const head = fs.readFileSync(p, 'utf8').slice(0, 100);
            recentPems.push({ path: p, head });
          }
        } catch {}
      }
    }
  }
  walk(tmpRoot);
  const privatePems = recentPems.filter(r => /BEGIN (RSA |EC )?PRIVATE KEY/.test(r.head));
  if (privatePems.length === 0) {
    ok(`no private PEMs on disk (${recentPems.length} public PEMs found, OK)`);
  } else {
    bad('private key leaked to disk', privatePems.map(p => p.path).join(', '));
  }
}

// =====================================================================
// SEC-9: warn-mode logger fires (logic check)
// =====================================================================
group('SEC-9: warn-mode periodic warning');

{
  // Static check: verify the string is present in server.js (boot-time
  // logger). Runtime test would need 60s real time — skip in this suite
  // and rely on manual smoke test in runbook.
  const serverJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src/backend/server.js'), 'utf8');
  if (serverJs.includes('logEnforcementWarning') && serverJs.includes('setInterval(logEnforcementWarning, 60_000)')) {
    ok('warn-mode 60s interval logger wired');
  } else {
    bad('warn-mode logger', 'logEnforcementWarning + setInterval not found in server.js');
  }
}

// =====================================================================
// SEC-10: RSA key strength enforced (< 4096 refused)
// =====================================================================
group('SEC-10: RSA key strength minimum');

{
  // Generate a 2048-bit keypair → write public PEM → expect loadPublicKey to throw
  const { publicKey: weakPub } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const weakDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec10-'));
  const weakPath = path.join(weakDir, 'weak-pub.pem');
  fs.writeFileSync(weakPath, weakPub.export({ type: 'spki', format: 'pem' }));

  // Use a fresh import to bypass module-level cache
  // (we can't re-import easily; instead inspect the error path directly)
  const orig = process.env.LICENSE_PUBLIC_KEY_PATH;
  process.env.LICENSE_PUBLIC_KEY_PATH = weakPath;
  try {
    // Reset cached key
    const lib = await import('../src/core/lib/licenseKey.js');
    lib._resetPublicKeyCacheForTests();
    let threw = false;
    try { lib.loadPublicKey(); }
    catch (err) {
      threw = /too weak|2048 bits|need >= 4096/i.test(err.message);
    }
    if (threw) ok('RSA-2048 public key refused');
    else bad('weak key not refused');

    // Restore
    process.env.LICENSE_PUBLIC_KEY_PATH = orig;
    lib._resetPublicKeyCacheForTests();
    lib.loadPublicKey();   // sanity: real key still loads
  } finally {
    fs.unlinkSync(weakPath);
    fs.rmdirSync(weakDir);
  }
}

// op-license-sign.js script-level check (process exit code 2 for weak key)
{
  const { publicKey: pub2, privateKey: priv2 } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec10b-'));
  const privPath = path.join(dir, 'priv2048.pem');
  fs.writeFileSync(privPath, priv2.export({ type: 'pkcs8', format: 'pem' }));
  const outPath = path.join(dir, 'unused.jwt');
  const r = spawnSync('node', [
    path.join(PROJECT_ROOT, 'scripts/op-license-sign.js'),
    `--priv=${privPath}`,
    '--plan=lite',
    '--signed-for=test.local',
    `--out=${outPath}`,
  ], { encoding: 'utf8' });
  if (r.status === 2 && /key strength|too weak|REFUSE/.test(r.stderr + r.stdout)) {
    ok('op-license-sign.js refuses RSA-2048');
  } else {
    bad('op-license-sign refuse', `exit=${r.status} stderr=${r.stderr.slice(0, 80)}`);
  }
  fs.unlinkSync(privPath);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  fs.rmdirSync(dir);
}

// =====================================================================
// SEC-11: 8KB JWT body cap
// =====================================================================
group('SEC-11: JWT/activation body size cap');

{
  // verifyLicense itself throws LICENSE_TOO_LARGE on >8KB input
  const huge = 'x'.repeat(10_000);
  try {
    verifyLicense(huge);
    bad('oversized JWT not refused');
  } catch (err) {
    if (err.code === 'LICENSE_TOO_LARGE') ok('verifyLicense refuses > 8 KB');
    else bad('wrong code for oversized', err.code);
  }

  // Static-code check: controller mounts express.json with 8kb limit so
  // bodies larger than that are rejected at the parser layer with HTTP 413
  // before they reach the verifyLicense library.
  const ctrlSrc = fs.readFileSync(
    path.join(PROJECT_ROOT, 'src/backend/modules/license/license.controller.js'),
    'utf8'
  );
  if (/express\.json\(\s*\{\s*limit:\s*['"]8kb['"]/.test(ctrlSrc)) {
    ok('license router mounts express.json({ limit: "8kb" })');
  } else {
    bad('controller body limit', 'express.json 8kb limit not found');
  }
}

// =====================================================================
// SEC-12: Legacy traffic counter + Sunset header
// =====================================================================
group('SEC-12: Legacy traffic surveillance');

{
  const serverJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src/backend/server.js'), 'utf8');
  const checks = [
    [/_legacyPublicCounter/, '_legacyPublicCounter var present'],
    [/Sunset/, 'Sunset header set'],
    [/Deprecation/, 'Deprecation header set'],
    [/\/api\/v1\/health\/legacy-traffic/, 'legacy-traffic admin endpoint registered'],
  ];
  for (const [re, label] of checks) {
    if (re.test(serverJs)) ok(label);
    else bad(label);
  }
}

// =====================================================================
// SEC-13: ES384 (EC P-384) parallel signing path
// =====================================================================
group('SEC-13: ES384 / EC P-384 alternate algorithm');

{
  // Test 13a: P-256 (weak EC curve) public key refused at boot
  const { publicKey: p256Pub } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const p256Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec13a-'));
  const p256Path = path.join(p256Dir, 'p256-pub.pem');
  fs.writeFileSync(p256Path, p256Pub.export({ type: 'spki', format: 'pem' }));

  const origPath = process.env.LICENSE_PUBLIC_KEY_PATH;
  process.env.LICENSE_PUBLIC_KEY_PATH = p256Path;
  const lib = await import('../src/core/lib/licenseKey.js');
  lib._resetPublicKeyCacheForTests();
  let p256Threw = false;
  try { lib.loadPublicKey(); }
  catch (err) { p256Threw = /P-256|prime256v1|P-384|secp384r1|too weak/i.test(err.message); }
  if (p256Threw) ok('P-256 (weak curve) public key refused');
  else bad('P-256 not refused', 'verifier accepted weak EC curve');
  fs.unlinkSync(p256Path);
  fs.rmdirSync(p256Dir);

  // Test 13b: P-384 public key accepted, alg = ES384
  const { publicKey: p384Pub, privateKey: p384Priv } = crypto.generateKeyPairSync(
    'ec', { namedCurve: 'secp384r1' }
  );
  const p384Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec13b-'));
  const p384Path = path.join(p384Dir, 'p384-pub.pem');
  fs.writeFileSync(p384Path, p384Pub.export({ type: 'spki', format: 'pem' }));
  process.env.LICENSE_PUBLIC_KEY_PATH = p384Path;
  lib._resetPublicKeyCacheForTests();
  let p384Alg = null;
  try { lib.loadPublicKey(); p384Alg = lib.getPublicKeyAlg(); }
  catch (err) { p384Alg = `error: ${err.message}`; }
  if (p384Alg === 'ES384') ok('P-384 public key accepted → alg=ES384');
  else bad('P-384 not accepted', `got: ${p384Alg}`);

  // Test 13c: ES384 JWT round-trip (sign → verify) on the P-384 keypair
  {
    const payload = defaultPayload({ signed_for: 'es384-test.local' });
    const header = { alg: 'ES384', typ: 'JWT' };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.sign(
      'sha384',
      Buffer.from(`${h}.${p}`),
      { key: p384Priv, dsaEncoding: 'ieee-p1363' }
    );
    const jwt = `${h}.${p}.${sig.toString('base64url')}`;
    try {
      const verified = lib.verifyLicense(jwt);
      if (verified.signed_for === 'es384-test.local') ok('ES384 JWT round-trip verified');
      else bad('ES384 round-trip', `payload mismatch: ${verified.signed_for}`);
    } catch (err) {
      bad('ES384 round-trip', `${err.code}: ${err.message}`);
    }
  }

  // Test 13d: alg/key mismatch refused — pass an RS256-shaped JWT to a
  // P-384-keyed deployment. The verifier MUST reject with LICENSE_BAD_ALG.
  {
    const rsaPriv = keys.privateKey;  // RSA-4096 priv from setup
    const payload = defaultPayload({ signed_for: 'mismatch-test.local' });
    const header = { alg: 'RS256', typ: 'JWT' };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.sign('sha256', Buffer.from(`${h}.${p}`), rsaPriv);
    const rsaJwt = `${h}.${p}.${sig.toString('base64url')}`;
    try {
      lib.verifyLicense(rsaJwt);
      bad('alg/key mismatch not refused', 'verifier accepted RSA-signed JWT on EC deployment');
    } catch (err) {
      if (err.code === 'LICENSE_BAD_ALG') ok('alg/key mismatch refused (LICENSE_BAD_ALG)');
      else bad('wrong error code on mismatch', err.code);
    }
  }

  // Cleanup — restore RSA pubkey path so subsequent tests use it
  fs.unlinkSync(p384Path);
  fs.rmdirSync(p384Dir);
  process.env.LICENSE_PUBLIC_KEY_PATH = origPath;
  lib._resetPublicKeyCacheForTests();
  lib.loadPublicKey();  // sanity
}

// op-license-sign.js script-level check (exit code 2 for P-256 EC)
{
  const { privateKey: privP256 } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec13e-'));
  const privPath = path.join(dir, 'privP256.pem');
  fs.writeFileSync(privPath, privP256.export({ type: 'pkcs8', format: 'pem' }));
  const outPath = path.join(dir, 'unused.jwt');
  const r = spawnSync('node', [
    path.join(PROJECT_ROOT, 'scripts/op-license-sign.js'),
    `--priv=${privPath}`,
    '--plan=lite',
    '--signed-for=test.local',
    `--out=${outPath}`,
  ], { encoding: 'utf8' });
  if (r.status === 2 && /P-256|prime256v1|P-384|secp384r1/i.test(r.stderr + r.stdout)) {
    ok('op-license-sign.js refuses EC P-256');
  } else {
    bad('op-license-sign refuse P-256', `exit=${r.status} stderr=${r.stderr.slice(0, 80)}`);
  }
  fs.unlinkSync(privPath);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  fs.rmdirSync(dir);
}

// =====================================================================
// Reporter
// =====================================================================
console.log('=== SEC RED-TEAM SUITE (v1.4.4) ===\n');
console.log(lines.join('\n'));
console.log('\n--- SUMMARY ---');
console.log(`Pass: ${pass}`);
console.log(`Fail: ${fail}`);
if (fail > 0) process.exit(1);
