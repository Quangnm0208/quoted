#!/usr/bin/env node
/**
 * db/migrate.js — Run all migrations in order.
 *
 * Tracking strategy:
 *   - Bảng `schema_migrations(filename, applied_at)` lưu file đã chạy
 *   - Migration nào chưa có trong bảng thì chạy + insert
 *   - Idempotent: chạy nhiều lần OK
 *
 * Đặt tên file: `NNN_description.sql`. Order theo thứ tự alphabetic.
 *
 * Usage:
 *   node src/db/migrate.js
 *   npm run migrate
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcryptjs from 'bcryptjs';
import db from './connection.js';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT    PRIMARY KEY,
      applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getAppliedMigrations() {
  const rows = db.prepare('SELECT filename FROM schema_migrations').all();
  return new Set(rows.map(r => r.filename));
}

function normalizeDomain(raw) {
  const value = String(raw || '').trim();
  if (!value || /^(skip|none|false)$/i.test(value)) return '';
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .split(':')[0]
    .replace(/^www\./i, '')
    .toLowerCase();
}

function defaultTenantDomain() {
  const explicit = normalizeDomain(process.env.TENANT_DEFAULT_DOMAIN);
  if (explicit) return explicit;

  const backend = normalizeDomain(process.env.BACKEND_PUBLIC_DOMAIN || process.env.PUBLIC_BACKEND_DOMAIN);
  if (backend) return backend;

  const flyApp = normalizeDomain(process.env.FLY_APP_NAME);
  if (flyApp) return `${flyApp}.fly.dev`;

  return env.NODE_ENV === 'production' ? '' : 'localhost';
}

function bootstrapDefaultTenantDomain() {
  const domain = defaultTenantDomain();
  const slug = String(process.env.TENANT_DEFAULT_SLUG || 'demo').trim().toLowerCase() || 'demo';
  const name = String(process.env.TENANT_DEFAULT_NAME || 'Demo Tenant').trim() || 'Demo Tenant';

  const row = db.prepare('SELECT slug, name, domain FROM tenants WHERE id = 1').get();
  if (!row) return;

  const current = normalizeDomain(row.domain);
  const nextDomain = current || domain || null;

  db.prepare(`
    UPDATE tenants
    SET
      slug = ?,
      name = ?,
      domain = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(slug, name, nextDomain);

  if (nextDomain) console.log(`[migrate] Default tenant domain: ${nextDomain}`);
}

function bootstrapInitialAdmin() {
  const row = db.prepare(`
    SELECT id FROM users
    WHERE tenant_id = 1 AND role = 'admin' AND is_active = 1 AND deleted_at IS NULL
    LIMIT 1
  `).get();
  if (row) return;

  const email = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(env.ADMIN_INITIAL_PASSWORD || '');
  const displayName = String(env.ADMIN_DISPLAY_NAME || 'Admin').trim() || 'Admin';
  if (!email || password.length < 8) {
    throw new Error('ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD are required to bootstrap the first admin user');
  }

  const passwordHash = bcryptjs.hashSync(password, env.BCRYPT_ROUNDS);
  db.prepare(`
    INSERT INTO users (tenant_id, email, password_hash, display_name, role, is_active)
    VALUES (1, ?, ?, ?, 'admin', 1)
  `).run(email, passwordHash, displayName);
  console.log(`[migrate] Created initial admin user: ${email}`);
}

function runMigrations() {
  ensureMigrationsTable();
  const applied = getAppliedMigrations();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pending = files.filter(f => !applied.has(f));
  if (pending.length === 0) {
    console.log('▸ Migrations: up to date (' + files.length + ' applied)');
    bootstrapDefaultTenantDomain();
    bootstrapInitialAdmin();
    return;
  }

  console.log('▸ Running ' + pending.length + ' pending migration(s)...');
  const insertRecord = db.prepare(
    'INSERT INTO schema_migrations (filename) VALUES (?)'
  );

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      // Mỗi migration chạy trong 1 transaction để rollback nếu lỗi.
      db.transaction(() => {
        db.exec(sql);
        insertRecord.run(file);
      })();
      console.log('  ✓ ' + file);
    } catch (err) {
      console.error('  ✗ ' + file + ' — ' + err.message);
      process.exit(1);
    }
  }

  console.log('▸ All migrations applied successfully.');
  bootstrapDefaultTenantDomain();
  bootstrapInitialAdmin();
}

// Chạy nếu được gọi trực tiếp, không chạy nếu được import.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations();
}

export { runMigrations };
