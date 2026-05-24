#!/usr/bin/env node
/**
 * Upgrade user len platform_admin role.
 * Usage: node scripts/set-platform-admin.js --email=admin@omniplug.local
 * Chi chay khi server dung.
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const email = process.argv.find(a => a.startsWith('--email='))?.split('=')[1];
if (!email) {
  console.error('Usage: node scripts/set-platform-admin.js --email=your@email.com');
  process.exit(1);
}

const db = new Database(path.resolve(process.env.DB_PATH || './data/cms.db'));
db.pragma('foreign_keys = ON');

const user = db.prepare(
  'SELECT id, email, role FROM users WHERE email = ? AND deleted_at IS NULL'
).get(email.toLowerCase());

if (!user) { console.error(`User not found: ${email}`); process.exit(1); }
if (user.role === 'platform_admin') {
  console.log(`Already platform_admin: ${email}`); process.exit(0);
}

db.prepare("UPDATE users SET role=?, updated_at=datetime('now') WHERE id=?")
  .run('platform_admin', user.id);
console.log(`Upgraded ${email} (id=${user.id}): '${user.role}' -> 'platform_admin'`);
db.close();
