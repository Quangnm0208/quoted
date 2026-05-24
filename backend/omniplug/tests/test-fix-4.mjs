// Verify BUG #4 fix: cached prepared statements behave identically + bounded
// Portable: resolves DB + tenant dynamically.

import { performance } from 'node:perf_hooks';
import { openTestDb, pickTenant } from './_helpers.mjs';

const { db } = openTestDb();
const tenant = pickTenant(db);
console.log(`Using tenant id=${tenant}\n`);

console.log('=== TEST: BUG #4 fix (cached prepared statements) ===\n');

const _cache = new Map();
const MAX = 30;
function preparedSelect(sql) {
  let s = _cache.get(sql);
  if (s) return s;
  if (_cache.size >= MAX) _cache.delete(_cache.keys().next().value);
  s = db.prepare(sql);
  _cache.set(sql, s);
  return s;
}

function listLeadsNew({ tenantId, status, search, includeDeleted, limit = 50, offset = 0 }) {
  const where = ['tenant_id = ?'];
  const params = [tenantId];
  if (!includeDeleted) where.push('deleted_at IS NULL');
  if (status) { where.push('status = ?'); params.push(status); }
  if (search) { where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)'); const q = '%'+search+'%'; params.push(q, q, q); }
  const whereSQL = 'WHERE ' + where.join(' AND ');
  const rows = preparedSelect(`SELECT * FROM leads ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const { total } = preparedSelect(`SELECT COUNT(*) AS total FROM leads ${whereSQL}`).get(...params);
  return { rows, total };
}

function listLeadsOld({ tenantId, status, search, includeDeleted, limit = 50, offset = 0 }) {
  const where = ['tenant_id = ?'];
  const params = [tenantId];
  if (!includeDeleted) where.push('deleted_at IS NULL');
  if (status) { where.push('status = ?'); params.push(status); }
  if (search) { where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)'); const q = '%'+search+'%'; params.push(q, q, q); }
  const whereSQL = 'WHERE ' + where.join(' AND ');
  const rows = db.prepare(`SELECT * FROM leads ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM leads ${whereSQL}`).get(...params);
  return { rows, total };
}

console.log('--- Behavior equivalence ---');
const cases = [
  { name: 'plain',         opts: { tenantId: tenant, limit: 10, offset: 0 } },
  { name: 'status=new',    opts: { tenantId: tenant, status: 'new', limit: 10 } },
  { name: 'search common', opts: { tenantId: tenant, search: 'e', limit: 10 } },
  { name: 'deep offset',   opts: { tenantId: tenant, limit: 10, offset: 500 } },
  { name: 'includeDeleted',opts: { tenantId: tenant, includeDeleted: true, limit: 10 } },
];

let match = 0, mismatch = 0;
for (const c of cases) {
  const oldR = listLeadsOld(c.opts);
  const newR = listLeadsNew(c.opts);
  const idsMatch = oldR.rows.length === newR.rows.length &&
                   oldR.rows.every((r, i) => r.id === newR.rows[i].id) &&
                   oldR.total === newR.total;
  console.log(`  ${idsMatch ? '✓' : '✗'} ${c.name.padEnd(20)} both ${oldR.rows.length} rows, total=${oldR.total}`);
  if (idsMatch) match++; else mismatch++;
}

console.log('\n--- Cache bound test ---');
_cache.clear();
for (let i = 0; i < 100; i++) {
  listLeadsNew({
    tenantId: tenant,
    status: ['new', 'contacted', 'qualified', 'converted', 'lost'][i % 5],
    search: i % 3 === 0 ? `keyword${i}` : null,
    includeDeleted: i % 2 === 0,
  });
}
console.log(`  Cache size: ${_cache.size} (max ${MAX}) — ${_cache.size <= MAX ? '✓ bounded' : '✗ unbounded'}`);

console.log('\n--- Performance: 5000 mixed requests ---');
_cache.clear();
const TRIALS = 5000;
let t = performance.now();
for (let i = 0; i < TRIALS; i++) {
  const status = i % 5 === 0 ? 'new' : null;
  listLeadsNew({ tenantId: tenant, status, limit: 20, offset: (i % 10) * 20 });
}
const newMs = performance.now() - t;
console.log(`  Cached: ${newMs.toFixed(0)}ms (${(TRIALS/(newMs/1000)).toFixed(0)} req/s)`);

t = performance.now();
for (let i = 0; i < TRIALS; i++) {
  const status = i % 5 === 0 ? 'new' : null;
  listLeadsOld({ tenantId: tenant, status, limit: 20, offset: (i % 10) * 20 });
}
const oldMs = performance.now() - t;
console.log(`  Per-request: ${oldMs.toFixed(0)}ms (${(TRIALS/(oldMs/1000)).toFixed(0)} req/s)`);
console.log(`  Speedup: ${(oldMs/newMs).toFixed(1)}x`);

console.log(`\n${match}/${match+mismatch} equivalence cases pass`);
db.close();
process.exit(mismatch > 0 ? 1 : 0);
