#!/usr/bin/env node
import db from '../src/core/db/connection.js';
import { env } from '../src/core/config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v1.4.3 fix: read version from package.json instead of hardcoding 1.4.0.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const failures = [];
const warnings = [];
const staleProjectToken = 'projects_' + 'old';
const legacyBrandPattern = new RegExp('fu' + 'ta|' + 'kim' + ' an', 'i');

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function hasTable(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

function columns(table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
}

function requireTable(name) {
  if (!hasTable(name)) fail(`missing required table: ${name}`);
}

function requireColumns(table, names) {
  if (!hasTable(table)) return;
  const available = columns(table);
  for (const name of names) {
    if (!available.has(name)) fail(`missing required column: ${table}.${name}`);
  }
}

function parentTablesFor(table) {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all().map(row => row.table);
}

const requiredTables = [
  'schema_migrations',
  'auth_attempts',
  'tenants',
  'users',
  'articles',
  'projects',
  'project_milestones',
  'project_gallery',
  'site_config',
  'page_sections',
  'leads',
  'media',
  'audit_log',
  'instance_identity',
];

for (const table of requiredTables) requireTable(table);

requireColumns('schema_migrations', ['filename', 'applied_at']);
requireColumns('auth_attempts', ['id', 'email', 'ip_address', 'success', 'user_agent', 'tenant_id', 'created_at']);
requireColumns('tenants', ['id', 'slug', 'name', 'domain', 'status', 'settings_json']);
requireColumns('users', ['id', 'tenant_id', 'email', 'password_hash', 'display_name', 'role', 'is_active', 'deleted_at']);
requireColumns('projects', ['id', 'tenant_id', 'slug', 'name', 'status', 'deleted_at']);
requireColumns('project_milestones', ['id', 'tenant_id', 'project_id']);
requireColumns('project_gallery', ['id', 'tenant_id', 'project_id', 'media_id']);

const fkIssues = db.prepare('PRAGMA foreign_key_check').all();
if (fkIssues.length > 0) {
  fail(`foreign_key_check returned ${fkIssues.length} issue(s)`);
  for (const issue of fkIssues.slice(0, 5)) {
    fail(`foreign key issue: table=${issue.table} rowid=${issue.rowid} parent=${issue.parent}`);
  }
}

for (const child of ['project_milestones', 'project_gallery']) {
  if (!hasTable(child)) continue;
  const parents = parentTablesFor(child);
  if (!parents.includes('projects')) fail(`${child} does not reference projects`);
  if (parents.some(parent => parent.toLowerCase().includes(staleProjectToken))) {
    fail(`${child} still references legacy project rebuild table`);
  }
}

const staleProjectRefs = db.prepare(`
  SELECT name, sql
  FROM sqlite_master
`).all().filter(row =>
  String(row.name || '').toLowerCase().includes(staleProjectToken) ||
  String(row.sql || '').toLowerCase().includes(staleProjectToken)
);
if (staleProjectRefs.length > 0) {
  fail('schema still contains legacy project rebuild references');
}

const tenant = hasTable('tenants')
  ? db.prepare('SELECT id, slug, name, domain, status FROM tenants WHERE id = 1').get()
  : null;
if (!tenant) {
  fail('default tenant id=1 is missing');
} else {
  if (tenant.status !== 'active') fail('default tenant id=1 is not active');
  if (!tenant.slug || legacyBrandPattern.test(tenant.slug)) fail('default tenant slug is missing or legacy-branded');
  if (!tenant.name || legacyBrandPattern.test(tenant.name)) fail('default tenant name is missing or legacy-branded');
  if (env.NODE_ENV === 'production' && !tenant.domain) {
    fail('production default tenant domain is empty');
  }
  if (!tenant.domain) warn('default tenant domain is empty in non-production mode');
}

const admin = hasTable('users')
  ? db.prepare(`
      SELECT id, email FROM users
      WHERE tenant_id = 1 AND role = 'admin' AND is_active = 1 AND deleted_at IS NULL
      LIMIT 1
    `).get()
  : null;
if (!admin) {
  fail('active admin user for tenant id=1 is missing');
}

for (const warning of warnings) console.warn(`[verify-schema] WARN ${warning}`);

if (failures.length > 0) {
  console.error('[verify-schema] FAILED');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('[verify-schema] schema verification passed');
console.log(`[verify-schema] product=OmniPlug CMS Core version=${pkg.version} tenant=${tenant?.slug || 'n/a'} admin=${admin?.email || 'n/a'}`);
