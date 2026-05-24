#!/usr/bin/env node
/**
 * test-migration-idempotency.js — Verify migrations are idempotent.
 *
 * Runs `node src/core/db/migrate.js` 3 times on a fresh temporary DB.
 * Asserts:
 *   1. First run creates all required tables
 *   2. Subsequent runs are no-ops (schema unchanged)
 *   3. schema_migrations row count stable across runs
 *
 * Required tables (auto-check after run 1):
 *   schema_migrations, tenants, users, articles, projects, project_milestones,
 *   project_gallery, pages (none — pages are sections), page_sections, site_config,
 *   leads, media, audit_log, auth_attempts, instance_identity
 *
 * Run: node scripts/test-migration-idempotency.js
 * Or:  npm run test:migration
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DB = path.join(os.tmpdir(), 'omniplug-cms-core-test-migration.db');

const REQUIRED_TABLES = [
  'schema_migrations',
  'tenants',
  'users',
  'articles',
  'projects',
  'project_milestones',
  'project_gallery',
  'page_sections',
  'site_config',
  'leads',
  'media',
  'audit_log',
  'auth_attempts',
  'instance_identity',
];

const REQUIRED_MIGRATIONS = [
  '011_platform_admin_role.sql',
];

function cleanup() {
  for (const ext of ['', '-shm', '-wal']) {
    const f = TEST_DB + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

function schemaSnapshot(db) {
  return JSON.stringify(
    db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all()
  );
}

function migrationRows(db) {
  return db.prepare("SELECT filename FROM schema_migrations ORDER BY filename").all();
}

function listTables(db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all().map(r => r.name);
}

function main() {
  cleanup();
  console.log('═══ Migration Idempotency Test ═══\n');
  
  const env = { ...process.env, DB_PATH: TEST_DB };
  let prev_schema = null;
  let prev_rows = null;
  
  for (let run = 1; run <= 3; run++) {
    console.log(`→ Run ${run}/3...`);
    try {
      execSync('node src/core/db/migrate.js', { env, stdio: 'pipe' });
    } catch (err) {
      console.error(`✗ Run ${run} failed: ${err.message}`);
      cleanup();
      process.exit(1);
    }
    
    const db = new Database(TEST_DB, { readonly: true });
    const schema = schemaSnapshot(db);
    const rows = migrationRows(db);
    db.close();
    
    if (run === 1) {
      // Verify required tables created
      const db2 = new Database(TEST_DB, { readonly: true });
      const existing = listTables(db2);
      db2.close();
      
      const missing = REQUIRED_TABLES.filter(t => !existing.includes(t));
      if (missing.length > 0) {
        console.error(`\n✗ Missing required tables after run 1:`);
        missing.forEach(t => console.error(`    - ${t}`));
        console.error(`\nFound tables: ${existing.join(', ')}`);
        cleanup();
        process.exit(1);
      }
      console.log(`  ✓ All ${REQUIRED_TABLES.length} required tables created`);
      console.log(`  ✓ ${rows.length} migration files applied`);
      const applied = new Set(rows.map(r => r.filename));
      const missingMigrations = REQUIRED_MIGRATIONS.filter(f => !applied.has(f));
      if (missingMigrations.length > 0) {
        console.error(`\n✗ Missing required migrations after run 1:`);
        missingMigrations.forEach(f => console.error(`    - ${f}`));
        cleanup();
        process.exit(1);
      }
      console.log(`  ✓ Required migrations present: ${REQUIRED_MIGRATIONS.join(', ')}`);
    } else {
      if (schema !== prev_schema) {
        console.error(`\n✗ Schema changed between run ${run-1} and ${run}!`);
        cleanup();
        process.exit(1);
      }
      if (rows.length !== prev_rows.length) {
        console.error(`\n✗ schema_migrations duplicated: r${run-1}=${prev_rows.length}, r${run}=${rows.length}`);
        cleanup();
        process.exit(1);
      }
      console.log(`  ✓ Schema unchanged, ${rows.length} migrations`);
    }
    
    prev_schema = schema;
    prev_rows = rows;
  }
  
  // Final auth_attempts check (this was Bug A — must be present)
  const db = new Database(TEST_DB, { readonly: true });
  const authAttemptsRow = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='auth_attempts'"
  ).get();
  db.close();
  
  if (!authAttemptsRow) {
    console.error('\n✗ auth_attempts table missing (regression of Bug A)');
    cleanup();
    process.exit(1);
  }
  console.log('\n  ✓ auth_attempts table present (Bug A regression check)');
  
  cleanup();
  console.log('\n🎉 Migration is idempotent. All required tables exist.\n');
}

try {
  main();
} catch (err) {
  console.error('Test crashed:', err.message);
  cleanup();
  process.exit(1);
}
