#!/usr/bin/env node
/**
 * scripts/seed.js — Tạo admin user đầu tiên.
 *
 * Idempotent: chạy nhiều lần OK, không duplicate.
 * Chạy 1 lần sau migrate, hoặc khi deploy lên server.
 *
 * Usage:
 *   npm run seed
 *
 * Environment:
 *   ADMIN_EMAIL=admin@omniplug.local
 *   ADMIN_INITIAL_PASSWORD=ChangeMe123!
 *   ADMIN_DISPLAY_NAME='Admin Site'
 */

import db from '../src/core/db/connection.js';
import { runMigrations } from '../src/core/db/migrate.js';
import { hashPassword } from '../src/core/lib/password.js';
import { env } from '../src/core/config/env.js';

async function seed() {
  runMigrations();

  const findUser = db.prepare('SELECT id, email FROM users WHERE email = ? COLLATE NOCASE');
  const existing = findUser.get(env.ADMIN_EMAIL);

  if (existing) {
    console.log('✓ Admin user already exists: ' + env.ADMIN_EMAIL + ' (id=' + existing.id + ')');
    return;
  }

  const passwordHash = await hashPassword(env.ADMIN_INITIAL_PASSWORD);

  const insert = db.prepare(`
    INSERT INTO users (tenant_id, email, password_hash, display_name, role, is_active)
    VALUES (1, ?, ?, ?, 'admin', 1)
  `);
  const info = insert.run(env.ADMIN_EMAIL, passwordHash, env.ADMIN_DISPLAY_NAME);

  console.log('✓ Created admin user');
  console.log('  Email:    ' + env.ADMIN_EMAIL);
  console.log('  Password: ' + env.ADMIN_INITIAL_PASSWORD);
  console.log('  ID:       ' + info.lastInsertRowid);
  console.log('');
  console.log('⚠️  ĐỔI PASSWORD NGAY sau khi login lần đầu!');
  console.log('   POST /api/auth/change-password { current_password, new_password }');
}

seed().catch(err => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
