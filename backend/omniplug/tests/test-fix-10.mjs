// Verify BUG #10 fix: 404 flush survives orphan FK without losing other tenants' data
// Portable: uses helpers for DB + tenant resolution.

import { performance } from 'node:perf_hooks';
import { openTestDb, pickTenant } from './_helpers.mjs';

const { db } = openTestDb();
const tenant = pickTenant(db);
console.log(`Using tenant id=${tenant}\n`);

console.log('=== TEST: BUG #10 fix (404 flush per-row error handling) ===\n');

const upsert = db.prepare(`
  INSERT INTO error_404_log (tenant_id, uri, hits, last_referer, last_user_agent)
  VALUES (@tenant_id, @uri, @hits, @referer, @user_agent)
  ON CONFLICT(tenant_id, uri) DO UPDATE SET
    hits = hits + excluded.hits, last_seen_at = datetime('now')
`);

function batchUpsertResilient(entries) {
  let upserted = 0, skipped = 0;
  const errors = [];
  db.exec('BEGIN');
  try {
    for (const it of entries) {
      db.exec('SAVEPOINT row');
      try {
        upsert.run({ tenant_id: it.tenant_id, uri: it.uri, hits: it.hits, referer: it.referer || null, user_agent: it.user_agent || null });
        db.exec('RELEASE row');
        upserted++;
      } catch (err) {
        db.exec('ROLLBACK TO row'); db.exec('RELEASE row'); skipped++;
        if (errors.length < 3) errors.push(err.message);
      }
    }
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  return { upserted, skipped, errors };
}

function batchUpsertOldBroken(entries) {
  db.exec('BEGIN');
  try {
    for (const it of entries) upsert.run({ tenant_id: it.tenant_id, uri: it.uri, hits: it.hits, referer: it.referer || null, user_agent: it.user_agent || null });
    db.exec('COMMIT');
    return { upserted: entries.length, skipped: 0 };
  } catch (err) { db.exec('ROLLBACK'); throw err; }
}

// Find a second tenant for mixed-batch test, or fall back to same tenant
const otherTenant = db.prepare('SELECT id FROM tenants WHERE id != ? AND status = ? LIMIT 1').get(tenant, 'active');
const t2 = otherTenant ? otherTenant.id : tenant;

console.log('--- Scenario 1: All-valid batch ---');
db.prepare(`DELETE FROM error_404_log WHERE uri LIKE '/test-fix10-%'`).run();
const valid = [];
for (let i = 0; i < 50; i++) valid.push({ tenant_id: i % 2 === 0 ? tenant : t2, uri: `/test-fix10-valid-${i}`, hits: 1 });
const r1 = batchUpsertResilient(valid);
console.log(`  ${r1.upserted === 50 && r1.skipped === 0 ? '✓' : '✗'} 50/50 committed`);

console.log('\n--- Scenario 2: Mixed batch (1 orphan tenant_id) ---');
db.prepare(`DELETE FROM error_404_log WHERE uri LIKE '/test-fix10-%'`).run();
const mixed = [];
for (let i = 0; i < 5; i++) mixed.push({ tenant_id: tenant, uri: `/test-fix10-good-${i}`, hits: 1 });
mixed.push({ tenant_id: 999999, uri: '/test-fix10-orphan', hits: 1 });
for (let i = 0; i < 5; i++) mixed.push({ tenant_id: t2, uri: `/test-fix10-also-good-${i}`, hits: 1 });

const before = db.prepare(`SELECT COUNT(*) AS c FROM error_404_log WHERE uri LIKE '/test-fix10-%'`).get().c;
try { batchUpsertOldBroken(mixed); }
catch (err) {
  const after = db.prepare(`SELECT COUNT(*) AS c FROM error_404_log WHERE uri LIKE '/test-fix10-%'`).get().c;
  console.log(`  Old (broken): threw "${err.message.slice(0, 50)}", lost ${10 - (after - before)} good rows`);
}

const r2 = batchUpsertResilient(mixed);
const after2 = db.prepare(`SELECT COUNT(*) AS c FROM error_404_log WHERE uri LIKE '/test-fix10-%'`).get().c;
console.log(`  ${r2.upserted === 10 && r2.skipped === 1 ? '✓ FIX VERIFIED' : '✗'} keeps 10 good rows, skips 1 orphan`);

console.log('\n--- Scenario 3: All-orphan batch ---');
const allBad = [
  { tenant_id: 999999, uri: '/zombie-1', hits: 1 },
  { tenant_id: 999998, uri: '/zombie-2', hits: 1 },
];
const r3 = batchUpsertResilient(allBad);
console.log(`  ${r3.upserted === 0 && r3.skipped === 2 ? '✓' : '✗'} 0 upserted, 2 skipped (no throw)`);

console.log('\n--- Scenario 4: Performance (500 rows) ---');
db.prepare(`DELETE FROM error_404_log WHERE uri LIKE '/test-fix10-%'`).run();
const perfBatch = Array.from({ length: 500 }, (_, i) => ({ tenant_id: tenant, uri: `/test-fix10-perf-${i}`, hits: 1 }));
const t1 = performance.now();
batchUpsertResilient(perfBatch);
console.log(`  500 rows in ${(performance.now() - t1).toFixed(0)}ms`);

db.prepare(`DELETE FROM error_404_log WHERE uri LIKE '/test-fix10-%' OR uri LIKE '/zombie-%'`).run();
db.close();
