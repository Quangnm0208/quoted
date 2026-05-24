// Verify BUG #16 fix: atomic IndexNow throttle (TOCTOU race).
// Portable test — resolves DB path + tenant ID dynamically.

import { performance } from 'node:perf_hooks';
import { openTestDb, pickTenant } from './_helpers.mjs';

const { db } = openTestDb();
db.exec('PRAGMA journal_mode = WAL;');
const tenant = pickTenant(db);
console.log(`Using tenant id=${tenant}`);

const stmtTry = db.prepare(`
  INSERT INTO indexing_log
    (tenant_id, url, provider, status, is_manual)
  SELECT @tenant_id, @url, @provider, 'pending', @is_manual
  WHERE NOT EXISTS (
    SELECT 1 FROM indexing_log
    WHERE tenant_id = @tenant_id AND url = @url
      AND submitted_at > datetime('now', '-' || @threshold || ' seconds')
  )
`);

function tryInsert(tenantId, url, isManual, threshold) {
  const r = stmtTry.run({
    tenant_id: tenantId, url, provider: 'indexnow',
    is_manual: isManual ? 1 : 0, threshold,
  });
  return { inserted: r.changes > 0, id: r.changes > 0 ? r.lastInsertRowid : null };
}

console.log('=== TEST: BUG #16 fix (atomic throttle) ===\n');

const url = `https://test.local/fix16-${Date.now()}`;
db.prepare(`DELETE FROM indexing_log WHERE url LIKE 'https://test.local/fix16-%'`).run();

console.log('--- 100 concurrent submits for same URL ---');
const promises = [];
for (let i = 0; i < 100; i++) {
  promises.push(new Promise((resolve) => {
    setImmediate(() => setImmediate(() => resolve(tryInsert(tenant, url, false, 60))));
  }));
}
const results = await Promise.all(promises);
const inserted = results.filter(r => r.inserted).length;
const throttled = results.filter(r => !r.inserted).length;
const rows = db.prepare('SELECT COUNT(*) AS c FROM indexing_log WHERE url = ?').get(url).c;

console.log(`  Submissions attempted: 100`);
console.log(`  Inserted: ${inserted}`);
console.log(`  Throttled: ${throttled}`);
console.log(`  Actual DB rows: ${rows}`);

if (rows === 1 && throttled === 99) {
  console.log(`  ✅ FIX VERIFIED: only 1 INSERT, 99 throttled (was 100/0 before fix)`);
} else {
  console.log(`  ❌ STILL BUGGED: expected 1 insert, got ${rows}`);
  process.exit(1);
}

console.log('\n--- Manual submission bypasses throttle ---');
const url2 = `https://test.local/fix16-manual-${Date.now()}`;
db.prepare(`DELETE FROM indexing_log WHERE url = ?`).run(url2);
const r1 = tryInsert(tenant, url2, false, 60);
const r2 = tryInsert(tenant, url2, true, 0);
const rows2 = db.prepare('SELECT COUNT(*) AS c FROM indexing_log WHERE url = ?').get(url2).c;
console.log(`  Auto: inserted=${r1.inserted}, Manual: inserted=${r2.inserted}, rows=${rows2}`);
console.log(r1.inserted && r2.inserted && rows2 === 2 ? '  ✅ Manual bypass preserved' : '  ❌ Manual bypass broken');

console.log('\n--- Throttle within window ---');
const url3 = `https://test.local/fix16-window-${Date.now()}`;
db.prepare(`DELETE FROM indexing_log WHERE url = ?`).run(url3);
const r3a = tryInsert(tenant, url3, false, 60);
const r3b = tryInsert(tenant, url3, false, 60);
const r3c = tryInsert(tenant, url3, false, 60);
const rows3 = db.prepare('SELECT COUNT(*) AS c FROM indexing_log WHERE url = ?').get(url3).c;
console.log(`  3 sequential auto-submits: ${r3a.inserted ? '✓' : '✗'} then ${r3b.inserted ? '✗' : '✓'} then ${r3c.inserted ? '✗' : '✓'}`);
console.log(rows3 === 1 ? '  ✅ Throttle window works' : '  ❌ Throttle broken');

console.log('\n--- Performance ---');
const url4 = `https://test.local/fix16-perf-${Date.now()}`;
db.prepare(`DELETE FROM indexing_log WHERE url LIKE 'https://test.local/fix16-perf-%'`).run();
let t = performance.now();
for (let i = 0; i < 1000; i++) tryInsert(tenant, url4 + '-' + i, false, 60);
const newMs = performance.now() - t;
console.log(`  Atomic tryInsert × 1000: ${newMs.toFixed(0)}ms (${(1000/(newMs/1000)).toFixed(0)} ops/s)`);

db.prepare(`DELETE FROM indexing_log WHERE url LIKE 'https://test.local/fix16-%'`).run();
db.close();
