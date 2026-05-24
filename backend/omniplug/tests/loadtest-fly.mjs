/**
 * OmniPlug CMS Core v1.4.3 — Fly.io-style Load Test
 *
 * Simulates the production scenario:
 *   - 30 businesses (tenants), each with 3 users → 90 users total
 *   - 5,000 leads per business → 150,000 leads total
 *   - Mixed HTTP traffic: lead submit (public), lead list (admin), lead stats
 *
 * Measures:
 *   - p50/p95/p99 latency per endpoint
 *   - Throughput (req/sec)
 *   - Error rate
 *   - Memory after seed
 *   - DB size after seed
 *
 * Run:
 *   node --no-warnings loadtest-fly.mjs
 *
 * Expected env:
 *   BASE_URL=http://localhost:4103  (or https://your-app.fly.dev)
 *   ADMIN_EMAIL=admin@omniplug.local
 *   ADMIN_PASSWORD=Test1234!
 */
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:4103';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@omniplug.local';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Test1234!';
const PROJECT_ROOT = process.env.PROJECT_ROOT || '/home/claude/omniplug-v143-final';

const N_TENANTS = parseInt(process.env.N_TENANTS || '30');
const USERS_PER_TENANT = parseInt(process.env.USERS_PER_TENANT || '3');
const LEADS_PER_TENANT = parseInt(process.env.LEADS_PER_TENANT || '5000');
const PUBLIC_SUBMIT_RPS = parseInt(process.env.PUBLIC_RPS || '50'); // sustained req/sec
const TEST_DURATION_S = parseInt(process.env.DURATION_S || '20');

// ============================================================
// Stats utilities
// ============================================================
class Stats {
  constructor(name) {
    this.name = name;
    this.samples = [];
    this.errors = 0;
    this.statusCodes = new Map();
  }
  record(ms, status) {
    this.samples.push(ms);
    if (status >= 400) this.errors++;
    this.statusCodes.set(status, (this.statusCodes.get(status) || 0) + 1);
  }
  summary() {
    if (this.samples.length === 0) return { name: this.name, samples: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p = (q) => sorted[Math.floor(sorted.length * q)];
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      name: this.name,
      samples: sorted.length,
      errors: this.errors,
      error_rate: ((this.errors / sorted.length) * 100).toFixed(2) + '%',
      mean: (sum / sorted.length).toFixed(2),
      p50: p(0.5).toFixed(2),
      p95: p(0.95).toFixed(2),
      p99: p(0.99).toFixed(2),
      max: sorted[sorted.length - 1].toFixed(2),
      status_codes: Object.fromEntries(this.statusCodes),
    };
  }
}

async function timed(stats, fn) {
  const t0 = performance.now();
  let status = 0;
  try {
    const r = await fn();
    status = r.status;
    return r;
  } catch (e) {
    status = -1;
    throw e;
  } finally {
    stats.record(performance.now() - t0, status);
  }
}

// ============================================================
// Phase 0 — Login
// ============================================================
async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error('Login failed: ' + r.status);
  const j = await r.json();
  return j.token;
}

// ============================================================
// Phase 1 — Seed 30 tenants via API
// ============================================================
async function seedTenants(token) {
  console.log(`\n=== Phase 1: Seed ${N_TENANTS} tenants via API ===`);
  const stats = new Stats('POST /api/admin/tenants');
  const tenants = [];
  const t0 = performance.now();

  for (let i = 1; i <= N_TENANTS; i++) {
    const slug = `biz-${String(i).padStart(3, '0')}`;
    const r = await timed(stats, () => fetch(`${BASE}/api/admin/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ slug, name: `Business ${i}`, domain: `${slug}.test.local` }),
    }));
    if (r.ok) {
      const t = await r.json();
      tenants.push(t);
    } else if (r.status === 409 || r.status === 400) {
      // already exists from prior run — fetch it
      tenants.push({ slug, name: `Business ${i}` });
    }
  }

  const elapsed = (performance.now() - t0) / 1000;
  console.log(`  ${tenants.length}/${N_TENANTS} tenants in ${elapsed.toFixed(1)}s (${(N_TENANTS/elapsed).toFixed(0)}/sec)`);
  console.log(`  Stats:`, stats.summary());
  return tenants;
}

// ============================================================
// Phase 2 — Seed leads directly via DB (bulk insert)
// API submit would take 150k * ~150ms = 6+ hours; bulk insert via DB is fair
// because it tests the SAME schema/indexes the rate-limit query uses.
// ============================================================
async function seedLeadsBulk() {
  console.log(`\n=== Phase 2: Bulk-seed ${LEADS_PER_TENANT * N_TENANTS} leads via DB ===`);
  const { default: db } = await import(path.join(PROJECT_ROOT, 'src/core/db/connection.js'));

  const t0 = performance.now();

  // Get tenant IDs
  const tenants = db.prepare(`SELECT id, slug FROM tenants WHERE slug LIKE 'biz-%' ORDER BY id`).all();
  if (tenants.length < N_TENANTS) {
    throw new Error(`Expected ${N_TENANTS} tenants, found ${tenants.length}`);
  }

  // Check existing lead counts (idempotent — if already seeded, skip)
  const existing = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE tenant_id IN (${tenants.map(t => t.id).join(',')})`).get().c;
  if (existing >= LEADS_PER_TENANT * N_TENANTS * 0.95) {
    console.log(`  Already seeded (${existing.toLocaleString()} leads). Skipping.`);
    return;
  }

  const ins = db.prepare(`
    INSERT INTO leads (tenant_id, name, phone, email, source, notes, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' minutes'))
  `);

  const statuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
  const names = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E', 'Vũ Thị F'];

  let totalInserted = 0;
  for (const tenant of tenants) {
    db.exec('BEGIN');
    try {
      for (let i = 0; i < LEADS_PER_TENANT; i++) {
        const ip = `203.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
        ins.run(
          tenant.id,
          names[i % names.length] + ' #' + i,
          '09' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0'),
          `lead-${i}@${tenant.slug}.local`,
          ['web', 'facebook', 'google', 'referral'][i % 4],
          'Bulk seed test data',
          ip,
          'Mozilla/5.0 LoadTestBot',
          Math.floor(Math.random() * 60 * 24 * 30),  // up to 30 days back
        );
        totalInserted++;
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  const elapsed = (performance.now() - t0) / 1000;
  console.log(`  Inserted ${totalInserted.toLocaleString()} leads in ${elapsed.toFixed(1)}s (${(totalInserted/elapsed).toFixed(0)}/sec)`);

  // ANALYZE so query planner picks up the new stats
  db.exec('ANALYZE leads;');
  console.log(`  ANALYZE leads done.`);
}

// ============================================================
// Phase 3 — HTTP load test
// ============================================================
async function loadTest() {
  console.log(`\n=== Phase 3: HTTP load test (${TEST_DURATION_S}s, target ${PUBLIC_SUBMIT_RPS} req/s) ===`);

  const sLeadSubmit = new Stats('POST /api/public/leads');
  const sHealthCheck = new Stats('GET /api/health');

  const start = performance.now();
  const deadline = start + TEST_DURATION_S * 1000;
  let leadCounter = 0;

  // Distribute load across tenants
  const tenantSlugs = Array.from({ length: N_TENANTS }, (_, i) => `biz-${String(i + 1).padStart(3, '0')}`);

  const inflight = new Set();
  const requestInterval = 1000 / PUBLIC_SUBMIT_RPS;

  let nextRequest = start;
  while (performance.now() < deadline) {
    const now = performance.now();
    if (now >= nextRequest) {
      const tenant = tenantSlugs[Math.floor(Math.random() * tenantSlugs.length)];
      leadCounter++;
      const myCounter = leadCounter;
      const p = (async () => {
        try {
          await timed(sLeadSubmit, () => fetch(`${BASE}/api/public/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Host': `${tenant}.test.local`, 'X-Tenant-Slug': tenant, 'X-Forwarded-For': '10.' + Math.floor(myCounter / 65536) + '.' + Math.floor((myCounter / 256) % 256) + '.' + (myCounter % 256) },
            body: JSON.stringify({
              name: `LoadTest Lead ${myCounter}`,
              phone: '0900' + String(myCounter).padStart(6, '0'),
              email: `loadtest-${myCounter}@test.local`,
              source: 'load-test',
              notes: 'Generated by loadtest-fly.mjs',
            }),
          }));
        } catch (e) {}
      })();
      inflight.add(p);
      p.finally(() => inflight.delete(p));
      nextRequest += requestInterval;
    }

    // Periodic health check (every 1s)
    if (Math.floor((now - start) / 1000) > Math.floor(((now - requestInterval) - start) / 1000)) {
      const p2 = (async () => {
        try { await timed(sHealthCheck, () => fetch(`${BASE}/api/health`)); } catch {}
      })();
      inflight.add(p2);
      p2.finally(() => inflight.delete(p2));
    }

    await new Promise(r => setTimeout(r, Math.max(1, nextRequest - performance.now())));
  }

  // Wait for inflight to settle
  await Promise.all([...inflight]);

  const totalElapsed = (performance.now() - start) / 1000;
  console.log(`\n  Total elapsed: ${totalElapsed.toFixed(1)}s`);
  console.log(`  Total requests: ${sLeadSubmit.samples.length}`);
  console.log(`  Actual throughput: ${(sLeadSubmit.samples.length / totalElapsed).toFixed(1)} req/sec`);
  return { sLeadSubmit, sHealthCheck };
}

// ============================================================
// Phase 4 — Admin queries (read path, deep pagination)
// ============================================================
async function adminQueries(token) {
  console.log(`\n=== Phase 4: Admin query benchmark ===`);
  const sList = new Stats('GET /api/admin/leads?limit=50&offset=0');
  const sListDeep = new Stats('GET /api/admin/leads?limit=50&offset=4950');
  const sCount = new Stats('GET /api/admin/leads (total count via response)');

  const tenantSlugs = Array.from({ length: N_TENANTS }, (_, i) => `biz-${String(i + 1).padStart(3, '0')}`);

  // 100 trials each
  for (let i = 0; i < 100; i++) {
    const tenant = tenantSlugs[i % tenantSlugs.length];
    const h = { 'Authorization': 'Bearer ' + token, 'X-Tenant-Slug': tenant };

    await timed(sList, () => fetch(`${BASE}/api/admin/leads?limit=50&offset=0`, { headers: h }));
    await timed(sListDeep, () => fetch(`${BASE}/api/admin/leads?limit=50&offset=4950`, { headers: h }));
  }
  return { sList, sListDeep };
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  OmniPlug CMS Core v1.4.3 — Load Test');
  console.log(`  Target: ${BASE}`);
  console.log(`  Scenario: ${N_TENANTS} tenants × ${USERS_PER_TENANT} users × ${LEADS_PER_TENANT} leads`);
  console.log(`  Total leads target: ${(N_TENANTS * LEADS_PER_TENANT).toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════════════');

  // 0. Sanity: health check
  const h = await fetch(`${BASE}/api/health`);
  if (!h.ok) throw new Error('Server not healthy: ' + h.status);
  const healthBody = await h.json();
  console.log(`\n  Health: ${healthBody.product} v${healthBody.version}`);

  // 1. Login
  const token = await login();
  console.log(`  Logged in (token ${token.length} chars)`);

  // 2. Seed tenants
  await seedTenants(token);

  // 3. Bulk-seed leads
  await seedLeadsBulk();

  // 4. Run HTTP load
  const httpResults = await loadTest();

  // 5. Admin read benchmarks
  const adminResults = await adminQueries(token);

  // ============================================================
  // Final report
  // ============================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  FINAL RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const allStats = [
    httpResults.sLeadSubmit,
    httpResults.sHealthCheck,
    adminResults.sList,
    adminResults.sListDeep,
  ];

  console.log('| Endpoint                                        | N    | p50    | p95    | p99    | Max     | Err  |');
  console.log('|-------------------------------------------------|------|--------|--------|--------|---------|------|');
  for (const s of allStats) {
    const r = s.summary();
    console.log(
      '| ' + r.name.padEnd(47, ' ') +
      ' | ' + String(r.samples).padStart(4) +
      ' | ' + (r.p50 + 'ms').padStart(6) +
      ' | ' + (r.p95 + 'ms').padStart(6) +
      ' | ' + (r.p99 + 'ms').padStart(6) +
      ' | ' + (r.max + 'ms').padStart(7) +
      ' | ' + r.error_rate.padStart(4) + ' |'
    );
  }

  // Per-endpoint status code breakdown
  console.log('\n=== Status code distribution ===');
  for (const s of allStats) {
    const r = s.summary();
    console.log(`  ${r.name}: ${JSON.stringify(r.status_codes)}`);
  }

  // Final DB stats
  const { default: db } = await import(path.join(PROJECT_ROOT, 'src/core/db/connection.js'));
  console.log('\n=== Final DB state ===');
  console.log(`  Tenants:   ${db.prepare('SELECT COUNT(*) AS c FROM tenants').get().c}`);
  console.log(`  Users:     ${db.prepare('SELECT COUNT(*) AS c FROM users').get().c}`);
  console.log(`  Leads:     ${db.prepare('SELECT COUNT(*) AS c FROM leads').get().c.toLocaleString()}`);

  // DB file size
  const dbStat = fs.statSync(path.join(PROJECT_ROOT, 'data/cms.db'));
  console.log(`  DB size:   ${(dbStat.size / 1024 / 1024).toFixed(1)} MB`);

  // Memory check
  const mem = process.memoryUsage();
  console.log(`\n=== Test runner memory ===`);
  console.log(`  RSS:       ${(mem.rss / 1024 / 1024).toFixed(0)} MB`);
  console.log(`  Heap used: ${(mem.heapUsed / 1024 / 1024).toFixed(0)} MB`);

  console.log('\n✅ Load test complete.');
}

main().catch(e => { console.error('\n❌ Load test failed:', e); process.exit(1); });
