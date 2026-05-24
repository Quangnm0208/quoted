/**
 * Verify QA finding #3 fix: tenant-domain isolation on login.
 *
 * From QA_TEST_REPORT_FLYIO_SCALE_2026-05-19.md section 8.5:
 *   "Login khong rang buoc user voi Host tenant: /api/auth/login resolve
 *    tenant tu Host de audit/rate limit, nhung sau do findByEmail global
 *    va khong check user.tenant_id === req.tenantId."
 *
 * This test verifies the fix in src/backend/modules/auth/auth.controller.js.
 *
 * Boots a real server on a random port, seeds 2 tenants, runs login matrix.
 *
 * Run: node tests/test-fix-login-isolation.mjs
 *
 * Requires:
 *   - DB at LOAD_DB_PATH (or .test-data/load.db) with migrations applied
 *   - Server NOT already running on PORT
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { openTestDb } from './_helpers.mjs';

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.QA_TEST_PORT || '4109', 10);
const BASE = `http://localhost:${PORT}`;

// Seed 2 isolated tenants
const { db, dbPath } = openTestDb();
db.exec('PRAGMA journal_mode = WAL;');

const bcrypt = (await import('bcryptjs')).default;
const hash = bcrypt.hashSync('TestPwd123!', 8);

// Clean previous test data
db.prepare(`DELETE FROM users WHERE email LIKE '%@isolation-test.local'`).run();
db.prepare(`DELETE FROM tenants WHERE slug LIKE 'iso-%'`).run();
db.prepare(`DELETE FROM auth_attempts WHERE ip_address = '127.0.0.1' AND created_at > datetime('now', '-1 hour')`).run();

const tenantAInfo = db.prepare(
  `INSERT INTO tenants (slug, name, domain, status) VALUES ('iso-a', 'Iso A', 'iso-a.local', 'active')`
).run();
const tenantBInfo = db.prepare(
  `INSERT INTO tenants (slug, name, domain, status) VALUES ('iso-b', 'Iso B', 'iso-b.local', 'active')`
).run();
const aliceInfo = db.prepare(
  `INSERT INTO users (tenant_id, email, password_hash, display_name, role, is_active) VALUES (?, 'alice@isolation-test.local', ?, 'Alice', 'admin', 1)`
).run(tenantAInfo.lastInsertRowid, hash);
const bobInfo = db.prepare(
  `INSERT INTO users (tenant_id, email, password_hash, display_name, role, is_active) VALUES (?, 'bob@isolation-test.local', ?, 'Bob', 'admin', 1)`
).run(tenantBInfo.lastInsertRowid, hash);

// CRITICAL: force checkpoint so the server (which opens its own DB connection)
// sees these writes immediately, not after the next auto-checkpoint.
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

console.log(`Seeded tenant-A (id=${tenantAInfo.lastInsertRowid}) + tenant-B (id=${tenantBInfo.lastInsertRowid})`);
db.close();

// Boot server
const serverProc = spawn('node', ['--no-warnings', 'src/backend/server.js'], {
  cwd: PROJECT_ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PATH: dbPath,
    NODE_ENV: 'development',
    JWT_SECRET: 'isolation-test-secret-min-32-chars-for-test',
    ADMIN_EMAIL: 'admin@omniplug.local',
    ADMIN_INITIAL_PASSWORD: 'Test1234!',
    TELEMETRY_ENABLED: 'false',
    TRUST_PROXY: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let booted = false;
serverProc.stdout.on('data', d => { if (d.toString().includes('Health:')) booted = true; });
serverProc.stderr.on('data', () => {});

for (let i = 0; i < 30 && !booted; i++) await sleep(200);
if (!booted) { serverProc.kill(); console.error('Server did not boot'); process.exit(1); }
await sleep(300);

async function loginTest(host, email, password) {
  // CRITICAL: Use node:http directly. Undici fetch strips custom Host header
  // (it's a security/spec restriction). To test tenant resolution by Host,
  // we need raw http.request.
  return new Promise((resolve, reject) => {
    const http = require('node:http');
    const body = JSON.stringify({ email, password });
    const req = http.request({
      method: 'POST',
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Host': host,
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch (e) { resolve({ status: res.statusCode, body: { _raw: chunks } }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

console.log('\n=== TEST: Login tenant-domain isolation (v1.4.3 QA fix) ===\n');

const tests = [
  { name: 'Alice via her own domain',            host: 'iso-a.local', email: 'alice@isolation-test.local', pwd: 'TestPwd123!', expectToken: true },
  { name: 'Alice via wrong domain (iso-b)',      host: 'iso-b.local', email: 'alice@isolation-test.local', pwd: 'TestPwd123!', expectToken: false, expectCode: 'INVALID_CREDENTIALS' },
  { name: 'Bob via his own domain',              host: 'iso-b.local', email: 'bob@isolation-test.local',   pwd: 'TestPwd123!', expectToken: true },
  { name: 'Bob via wrong domain (iso-a)',        host: 'iso-a.local', email: 'bob@isolation-test.local',   pwd: 'TestPwd123!', expectToken: false, expectCode: 'INVALID_CREDENTIALS' },
  { name: 'Wrong password (consistent error)',   host: 'iso-a.local', email: 'alice@isolation-test.local', pwd: 'WrongPwd!',   expectToken: false, expectCode: 'INVALID_CREDENTIALS' },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const r = await loginTest(t.host, t.email, t.pwd);
  const hasToken = !!r.body.token;
  const code = r.body.error?.code;
  let ok;
  if (t.expectToken) ok = hasToken && r.status === 200;
  else ok = !hasToken && r.status === 401 && code === t.expectCode;
  console.log(`  ${ok ? '✓' : '✗'} ${t.name.padEnd(40)} HTTP ${r.status} ${hasToken ? '(token)' : '(' + code + ')'}`);
  if (ok) pass++; else fail++;
}

// Cleanup
const { db: db2 } = openTestDb();
db2.prepare(`DELETE FROM users WHERE email LIKE '%@isolation-test.local'`).run();
db2.prepare(`DELETE FROM tenants WHERE slug LIKE 'iso-%'`).run();
db2.close();

serverProc.kill();
await sleep(200);

console.log(`\n${pass}/${pass + fail} cases pass`);
process.exit(fail > 0 ? 1 : 0);
