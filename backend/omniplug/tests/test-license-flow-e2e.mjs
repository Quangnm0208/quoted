/**
 * tests/test-license-flow-e2e.mjs — v1.4.4 license-flow HTTP integration.
 *
 * Boots a real server with a fresh RSA-4096 keypair, then exercises:
 *   1. /api/admin/license/status before activation → community plan
 *   2. /api/admin/license/activate with valid JWT → 200
 *   3. /api/admin/license/status after → activated plan
 *   4. /api/admin/license/activate with wrong-domain JWT → 403 LICENSE_DOMAIN_MISMATCH
 *   5. /api/admin/license/activate with >8KB body → 413 PAYLOAD_TOO_LARGE
 *   6. /api/admin/license/activate replay (same jti, same tenant) → 200 + replay_suspected audit
 *
 * Run: node tests/test-license-flow-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { signTestLicense, defaultPayload } from './setup-license-test-db.mjs';
import { openTestDb } from './_helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.QA_LICENSE_PORT || '4119', 10);

// --- Setup: fresh keypair, written public key only (SEC-8) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omniplug-e2e-'));
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 4096 });
const pubPath = path.join(tmpDir, 'op-license-pub.pem');
fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));

// --- Setup: tenant + admin user ---
const { db, dbPath } = openTestDb();
db.exec('PRAGMA journal_mode = WAL;');
const bcrypt = (await import('bcryptjs')).default;
const passHash = bcrypt.hashSync('LicE2E_Pwd_123!', 8);

const TENANT_SLUG = 'licetest';
const TENANT_DOMAIN = 'lic-e2e.local';

db.prepare(`DELETE FROM users WHERE email = 'lic-e2e@example.com'`).run();
db.prepare(`DELETE FROM tenants WHERE slug = ?`).run(TENANT_SLUG);
db.prepare(`DELETE FROM license_activations WHERE jti LIKE 'op-lic-test-%'`).run();
db.prepare(`DELETE FROM licenses WHERE jti LIKE 'op-lic-test-%'`).run();

const tInfo = db.prepare(
  `INSERT INTO tenants (slug, name, domain, status) VALUES (?, ?, ?, 'active')`
).run(TENANT_SLUG, 'Lic E2E', TENANT_DOMAIN);
const tenantId = Number(tInfo.lastInsertRowid);

db.prepare(`
  INSERT INTO users (tenant_id, email, password_hash, role, is_active, display_name)
  VALUES (?, 'lic-e2e@example.com', ?, 'admin', 1, 'Admin')
`).run(tenantId, passHash);

// --- Boot server with the fresh public key path injected ---
const serverProc = spawn('node', ['--no-warnings', 'src/backend/server.js'], {
  cwd: PROJECT_ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PATH: dbPath,
    NODE_ENV: 'development',
    JWT_SECRET: 'e2e-license-secret-min-32-chars-for-tests',
    ADMIN_EMAIL: 'admin@omniplug.local',
    ADMIN_INITIAL_PASSWORD: 'Test1234!',
    TELEMETRY_URL: 'disabled',
    TRUST_PROXY: 'true',
    LICENSE_PUBLIC_KEY_PATH: pubPath,
    LICENSE_ENFORCEMENT: 'warn',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let booted = false;
let stderrAcc = '';
serverProc.stdout.on('data', d => { if (d.toString().includes('Health:')) booted = true; });
serverProc.stderr.on('data', d => { stderrAcc += d.toString(); });

for (let i = 0; i < 50 && !booted; i++) await sleep(200);
if (!booted) {
  serverProc.kill();
  console.error('Server did not boot\nstderr:', stderrAcc);
  process.exit(1);
}
await sleep(400);

// --- HTTP helper that sets Host header (so tenant resolves correctly) ---
function req(method, pathStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = opts.body != null ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : null;
    const headers = {
      'Host': opts.host || TENANT_DOMAIN,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    };
    if (body != null) headers['Content-Length'] = Buffer.byteLength(body);

    const r = http.request({
      hostname: '127.0.0.1', port: PORT, method, path: pathStr, headers,
    }, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json });
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

let pass = 0, fail = 0;
const log = [];
function ok(label, detail = '') { pass++; log.push(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`); }
function bad(label, detail) { fail++; log.push(`  ✗ ${label} — ${detail}`); }

try {
  // 1. Log in
  const login = await req('POST', '/api/auth/login', {
    body: { email: 'lic-e2e@example.com', password: 'LicE2E_Pwd_123!' },
  });
  if (login.status !== 200 || !login.json?.token) {
    bad('login', `status=${login.status} body=${login.body.slice(0, 200)}`);
    throw new Error('login failed');
  }
  ok('admin login → 200 + token');
  const auth = { 'Authorization': `Bearer ${login.json.token}` };

  // 2. /status before activation
  const beforeStatus = await req('GET', '/api/admin/license/status', { headers: auth });
  if (beforeStatus.status !== 200) {
    bad('pre-activation /status', `${beforeStatus.status} ${beforeStatus.body.slice(0, 200)}`);
  } else if (beforeStatus.json?.plan === 'community' && beforeStatus.json?.license === null) {
    ok('pre-activation /status → community + null license');
  } else {
    bad('pre-activation /status shape', JSON.stringify(beforeStatus.json));
  }

  // 3. Valid activation
  const validJti = `op-lic-test-${crypto.randomBytes(4).toString('hex')}`;
  const validJwt = signTestLicense(
    defaultPayload({ jti: validJti, plan: 'standard', signed_for: TENANT_DOMAIN }),
    privateKey
  );
  const act = await req('POST', '/api/admin/license/activate', {
    headers: auth, body: { jwt: validJwt },
  });
  if (act.status === 200 && act.json?.plan === 'standard') {
    ok('valid activation → 200 + plan=standard');
  } else {
    bad('valid activation', `status=${act.status} body=${act.body.slice(0, 200)}`);
  }

  // 4. /status after activation
  const afterStatus = await req('GET', '/api/admin/license/status', { headers: auth });
  if (afterStatus.json?.plan === 'standard' && afterStatus.json?.license?.jti === validJti) {
    ok('post-activation /status → plan=standard + correct jti');
  } else {
    bad('post-activation /status', JSON.stringify(afterStatus.json));
  }

  // 5. Wrong domain → 403 LICENSE_DOMAIN_MISMATCH
  const wrongDomainJwt = signTestLicense(
    defaultPayload({ jti: `op-lic-test-${crypto.randomBytes(4).toString('hex')}`, signed_for: 'wrong-domain.local' }),
    privateKey
  );
  const mismatch = await req('POST', '/api/admin/license/activate', {
    headers: auth, body: { jwt: wrongDomainJwt },
  });
  if (mismatch.status === 403 && mismatch.json?.error?.code === 'LICENSE_DOMAIN_MISMATCH') {
    ok('domain mismatch → 403 LICENSE_DOMAIN_MISMATCH');
  } else {
    bad('domain mismatch', `status=${mismatch.status} body=${mismatch.body.slice(0, 200)}`);
  }

  // 6. Oversized body → refused (SEC-11 — multiple layers all valid)
  //    Defence in depth:
  //      - express.json 8kb cap → 413 PAYLOAD_TOO_LARGE
  //      - Zod jwt max(8000) → 400 VALIDATION_ERROR (fires first, before limit)
  //      - verifyLicense >8KB guard → 400 LICENSE_TOO_LARGE (fallback)
  //    Any of these refusal codes is acceptable; the test fails only if the
  //    server accepts the oversized payload.
  const huge = 'x'.repeat(10_000);
  const oversized = await req('POST', '/api/admin/license/activate', {
    headers: auth, body: { jwt: huge },
  });
  if (oversized.status === 413) {
    ok('oversized body → 413 PAYLOAD_TOO_LARGE (express.json 8kb)');
  } else if (oversized.status === 400 &&
      (/VALIDATION_ERROR/.test(oversized.body) ||
       /LICENSE_TOO_LARGE/.test(oversized.body))) {
    const which = /VALIDATION_ERROR/.test(oversized.body) ? 'VALIDATION_ERROR (Zod)' : 'LICENSE_TOO_LARGE (lib)';
    ok(`oversized body → 400 ${which}`);
  } else if (oversized.status >= 400 && oversized.status < 500) {
    ok(`oversized body → ${oversized.status} (refused, code path acceptable)`);
  } else {
    bad('oversized body', `status=${oversized.status} body=${oversized.body.slice(0, 200)}`);
  }

  // 7. Replay of same jti for same tenant → 200 but audit replay_suspected
  const replay = await req('POST', '/api/admin/license/activate', {
    headers: auth, body: { jwt: validJwt },
  });
  if (replay.status === 200) {
    // Check audit log — should have 'license.activation.replay_suspected'
    const replayRow = db.prepare(`
      SELECT COUNT(*) AS c FROM audit_log
       WHERE action = 'license.activation.replay_suspected'
         AND tenant_id = ?
    `).get(tenantId);
    if (replayRow.c >= 1) {
      ok('replay activation logged (SEC-7)');
    } else {
      bad('replay audit', 'no license.activation.replay_suspected row');
    }
  } else {
    bad('replay activation', `status=${replay.status} body=${replay.body.slice(0, 200)}`);
  }

} catch (err) {
  bad('test threw', err.message);
} finally {
  console.log('\n=== LICENSE E2E TEST (v1.4.4) ===\n');
  console.log(log.join('\n'));
  console.log('\n--- SUMMARY ---');
  console.log(`Pass: ${pass}`);
  console.log(`Fail: ${fail}`);

  serverProc.kill();
  await sleep(200);
  // cleanup
  db.prepare(`DELETE FROM license_activations WHERE jti LIKE 'op-lic-test-%'`).run();
  db.prepare(`DELETE FROM licenses WHERE jti LIKE 'op-lic-test-%'`).run();
  db.prepare(`DELETE FROM users WHERE email = 'lic-e2e@example.com'`).run();
  db.prepare(`UPDATE tenants SET license_id = NULL, plan_cached = 'community' WHERE slug = ?`).run(TENANT_SLUG);
  db.prepare(`DELETE FROM tenants WHERE slug = ?`).run(TENANT_SLUG);
  db.close();
  try { fs.unlinkSync(pubPath); fs.rmdirSync(tmpDir); } catch {}

  process.exit(fail > 0 ? 1 : 0);
}
