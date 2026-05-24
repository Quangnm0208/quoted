// Shared helpers for test-fix-*.mjs scripts.
// Portable: no hardcoded paths or tenant IDs.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const SRC = path.join(PROJECT_ROOT, 'src');

/**
 * Open the test DB. Path resolution priority:
 *   1. LOAD_DB_PATH env var (explicit)
 *   2. <PROJECT_ROOT>/.test-data/load.db (default — created by setup-test-db.mjs)
 *   3. <PROJECT_ROOT>/data/cms.db (fallback — production DB; tests should NOT use)
 */
export function openTestDb() {
  let dbPath = process.env.LOAD_DB_PATH;
  if (!dbPath) {
    const candidate = path.join(PROJECT_ROOT, '.test-data', 'load.db');
    if (fs.existsSync(candidate)) {
      dbPath = candidate;
    } else {
      const fallback = path.join(PROJECT_ROOT, 'data', 'cms.db');
      if (fs.existsSync(fallback)) {
        console.warn(`[helpers] LOAD_DB_PATH not set and .test-data/load.db missing — falling back to ${fallback}`);
        dbPath = fallback;
      } else {
        throw new Error(
          'No test DB found. Run `node tests/setup-test-db.mjs` first, ' +
          'or set LOAD_DB_PATH env var to point at an existing DB with migrations applied.'
        );
      }
    }
  }
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Test DB not found at ${dbPath}. Run setup-test-db.mjs first.`);
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  return { db, dbPath };
}

/**
 * Pick a real tenant ID from the DB. Allows test-fix scripts to be portable
 * regardless of which seed produced the DB.
 *
 * Priority:
 *   1. QA_TENANT_ID env var (explicit)
 *   2. First tenant whose slug starts with 'biz-' (load-test seed)
 *   3. First tenant whose id > 1 (skip default)
 *   4. Default tenant id=1
 */
export function pickTenant(db) {
  if (process.env.QA_TENANT_ID) {
    const id = parseInt(process.env.QA_TENANT_ID, 10);
    const row = db.prepare('SELECT id FROM tenants WHERE id = ?').get(id);
    if (row) return id;
    throw new Error(`QA_TENANT_ID=${id} not found in DB`);
  }
  const biz = db.prepare(`SELECT id FROM tenants WHERE slug LIKE 'biz-%' ORDER BY id LIMIT 1`).get();
  if (biz) return biz.id;
  const nonDefault = db.prepare('SELECT id FROM tenants WHERE id > 1 ORDER BY id LIMIT 1').get();
  if (nonDefault) return nonDefault.id;
  const def = db.prepare('SELECT id FROM tenants WHERE id = 1').get();
  if (def) return 1;
  throw new Error('No tenants found in DB. Run setup-test-db.mjs first.');
}
