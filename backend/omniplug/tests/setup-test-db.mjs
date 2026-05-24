/**
 * tests/setup-test-db.mjs
 *
 * Bootstrap a test DB for the test-fix-*.mjs and regression-test.mjs scripts.
 *
 * Creates .test-data/load.db with:
 *   - All 15 migrations applied
 *   - 1 test tenant (id auto-assigned)
 *
 * Idempotent: re-running won't duplicate data or re-apply migrations.
 *
 * Run: node tests/setup-test-db.mjs
 *
 * Env vars:
 *   LOAD_DB_PATH — path to DB file (default: .test-data/load.db)
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'src/core/db/migrations');

const dbPath = process.env.LOAD_DB_PATH || path.join(PROJECT_ROOT, '.test-data', 'load.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

console.log(`[setup] DB path: ${dbPath}`);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;');

// Apply migrations idempotently
const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
console.log(`[setup] Applying ${files.length} migrations...`);
let applied = 0;
for (const f of files) {
  try {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
    applied++;
  } catch (e) {
    // "duplicate column" / "already exists" — idempotent re-run; skip
    const msg = e.message.split('\n')[0];
    if (/(already exists|duplicate column)/i.test(msg)) {
      // expected on re-run
    } else {
      console.log(`  ✗ ${f}: ${msg}`);
    }
  }
}
db.exec('PRAGMA foreign_keys = ON;');
console.log(`[setup] ${applied}/${files.length} migrations applied (rest were idempotent skips)`);

// Ensure at least one test tenant exists
let tenant = db.prepare(`SELECT id FROM tenants WHERE slug = 'qa-test'`).get();
if (!tenant) {
  const info = db.prepare(
    `INSERT INTO tenants (slug, name, domain, status) VALUES ('qa-test', 'QA Test Tenant', 'qa-test.local', 'active')`
  ).run();
  tenant = { id: info.lastInsertRowid };
  console.log(`[setup] Created test tenant id=${tenant.id} (slug=qa-test)`);
} else {
  console.log(`[setup] Test tenant id=${tenant.id} already exists`);
}

// Print summary
const counts = {
  tenants: db.prepare('SELECT COUNT(*) AS c FROM tenants').get().c,
  users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  leads: db.prepare('SELECT COUNT(*) AS c FROM leads').get().c,
  indexes: db.prepare(`SELECT COUNT(*) AS c FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`).get().c,
};
console.log(`[setup] DB ready:`, counts);
console.log(`[setup] Suggested env for test-fix-*.mjs scripts:`);
console.log(`    LOAD_DB_PATH=${dbPath}`);
console.log(`    QA_TENANT_ID=${tenant.id}`);

db.close();
