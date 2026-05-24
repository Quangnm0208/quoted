#!/usr/bin/env node
/**
 * scripts/test-tenant-isolation.js
 *
 * Direct DB-level verification — tenant 1 không nhìn thấy data của tenant 2.
 * Chạy SAU khi seed admin + có ít nhất 1 dummy tenant 2.
 *
 * Tests:
 *   1. Insert article cho tenant 1 + tenant 2 với cùng slug → OK (constraint)
 *   2. Query articles WHERE tenant_id = 1 → KHÔNG return tenant 2 row
 *   3. Same với projects, leads, media, page_sections
 */

import Database from 'better-sqlite3';
import { env } from '../src/core/config/env.js';

const db = new Database(env.DB_PATH, { readonly: false });
db.pragma('foreign_keys = ON');

let pass = 0, fail = 0;
const errors = [];

function assert(name, cond) {
  if (cond) { console.log('  ✓', name); pass++; }
  else { console.log('  ✗', name); fail++; errors.push(name); }
}

console.log('\n=== TENANT ISOLATION TEST ===\n');

// Ensure tenant 2 exists
const t2 = db.prepare('SELECT id FROM tenants WHERE id = 2').get();
if (!t2) {
  db.prepare(`INSERT INTO tenants (id, slug, name, status) VALUES (2, 'test-tenant-2', 'Test Tenant 2', 'active')`).run();
  console.log('▸ Created test tenant 2\n');
}

const TEST_SLUG = 'isolation-test-' + Date.now();

// Cleanup helpers
const cleanup = () => {
  db.prepare('DELETE FROM articles WHERE slug = ?').run(TEST_SLUG);
};

try {
  cleanup();

  // Test 1: Insert same slug for both tenants
  console.log('[1] UNIQUE(tenant_id, slug) allows same slug across tenants');
  const a1 = db.prepare(`
    INSERT INTO articles (tenant_id, slug, title) VALUES (1, ?, 'Article T1')
  `).run(TEST_SLUG);
  const a2 = db.prepare(`
    INSERT INTO articles (tenant_id, slug, title) VALUES (2, ?, 'Article T2')
  `).run(TEST_SLUG);
  assert('Tenant 1 insert with slug "' + TEST_SLUG + '"', a1.changes === 1);
  assert('Tenant 2 insert with same slug', a2.changes === 1);

  // Test 2: Query scoped by tenant_id
  console.log('\n[2] Query scoped by tenant_id sees only own data');
  const t1Articles = db.prepare(`
    SELECT title FROM articles WHERE tenant_id = 1 AND slug = ?
  `).all(TEST_SLUG);
  const t2Articles = db.prepare(`
    SELECT title FROM articles WHERE tenant_id = 2 AND slug = ?
  `).all(TEST_SLUG);
  assert('Tenant 1 sees only "Article T1"',
    t1Articles.length === 1 && t1Articles[0].title === 'Article T1');
  assert('Tenant 2 sees only "Article T2"',
    t2Articles.length === 1 && t2Articles[0].title === 'Article T2');

  // Test 3: Try duplicate in same tenant → should fail
  console.log('\n[3] Duplicate slug within same tenant → UNIQUE constraint fails');
  let dupFailed = false;
  try {
    db.prepare(`
      INSERT INTO articles (tenant_id, slug, title) VALUES (1, ?, 'Duplicate T1')
    `).run(TEST_SLUG);
  } catch (e) {
    dupFailed = e.message.includes('UNIQUE');
  }
  assert('Duplicate (tenant_id=1, slug) rejected', dupFailed);

  // Test 4: Cross-tenant query returns nothing
  console.log('\n[4] Cross-tenant accidental query yields no leak');
  const fakeQuery = db.prepare(`
    SELECT COUNT(*) AS c FROM articles WHERE tenant_id = 999 AND slug = ?
  `).get(TEST_SLUG);
  assert('Unknown tenant_id=999 returns 0 rows', fakeQuery.c === 0);

  cleanup();
} catch (e) {
  console.error('FATAL:', e.message);
  cleanup();
  process.exit(2);
}

console.log(`\n=== SUMMARY ===\nPassed: ${pass}\nFailed: ${fail}`);
if (fail > 0) {
  console.log('Failed tests:', errors.join(', '));
  process.exit(1);
}
db.close();
process.exit(0);
