#!/usr/bin/env node
/**
 * scripts/smoke.js — End-to-end smoke test.
 *
 * Test flow:
 *   1. GET /health → 200
 *   2. POST /api/auth/login → token
 *   3. GET /api/auth/me → user
 *   4. GET /api/public/site → object
 *   5. POST /api/admin/articles → 201, return article
 *   6. GET /api/public/articles/:slug (public, status=published) → 200
 *   7. PUT /api/admin/articles/:id → updated
 *   8. DELETE /api/admin/articles/:id → deleted
 *   9. POST /api/public/leads (public) → 201 + DB row
 *   10. POST /api/public/leads with website honeypot → 201 + no DB row
 *   11. GET /api/admin/leads → list
 *
 * Run:
 *   1. Start server (npm start hoặc docker compose up)
 *   2. node scripts/smoke.js
 *
 * Exit code 0 = all pass, 1 = any fail.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_ROLES, LOGIN_ENABLED_ROLES, canLogin } from '../src/core/lib/roles.js';

// v1.4.3 fix: read version from package.json instead of hardcoding.
// Previously this file pinned "1.4.0" which broke smoke test on every bump.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const EXPECTED_VERSION = pkg.version;

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4000';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@omniplug.local';
const PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'ChangeMe123!';
const DB_PATH = path.resolve(process.env.DB_PATH || './data/cms.db');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let token = null;
let pass = 0, fail = 0;
let smokeDb = null;

function db() {
  if (!smokeDb) smokeDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return smokeDb;
}

function count(sql, params = []) {
  return db().prepare(sql).get(...params).c;
}

function closeDb() {
  if (smokeDb) {
    smokeDb.close();
    smokeDb = null;
  }
}

async function step(name, fn) {
  try {
    await fn();
    console.log('  ✓', name);
    pass++;
  } catch (e) {
    console.log('  ✗', name, '—', e.message);
    fail++;
  }
}

async function req(method, path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && token) headers.Authorization = 'Bearer ' + token;
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const r = await fetch(BASE + path, { method, headers, body });
  let payload;
  try { payload = await r.json(); } catch { payload = null; }
  if (!r.ok && !opts.allowFail) {
    throw new Error(method + ' ' + path + ' → HTTP ' + r.status + (payload?.message ? ': ' + payload.message : ''));
  }
  return { status: r.status, body: payload };
}

async function run() {
  console.log('▸ Smoke test against', BASE);
  console.log('▸ Admin:', EMAIL);
  console.log('');

  await step('GET /api/health returns 200', async () => {
    const r = await req('GET', '/api/health', { auth: false });
    if (r.body.status !== 'ok') throw new Error('Status not ok');
    if (r.body.version !== EXPECTED_VERSION) throw new Error(`Wrong version: expected ${EXPECTED_VERSION}, got ${r.body.version}`);
    if (r.body.product !== 'OmniPlug CMS Core') throw new Error('Wrong product');
    if (r.body.vendor !== 'OmniPlug') throw new Error('Wrong vendor');
    if (r.body.license !== 'PolyForm Noncommercial 1.0.0') throw new Error('Wrong license');
    if (r.body.homepage !== 'https://omniplug.com') throw new Error('Wrong homepage');
  });

  await step('roles.js exports expected role gates', async () => {
    if (ALL_ROLES.length !== 6) throw new Error('ALL_ROLES length mismatch');
    if (LOGIN_ENABLED_ROLES.length !== 3) throw new Error('LOGIN_ENABLED_ROLES length mismatch');
    if (canLogin('admin') !== true) throw new Error('admin should login');
    if (canLogin('customer') !== false) throw new Error('customer should not login');
  });

  await step('instance_identity has one valid UUID row', async () => {
    const rows = db().prepare('SELECT instance_uuid FROM instance_identity').all();
    if (rows.length !== 1) throw new Error('Expected 1 instance_identity row, got ' + rows.length);
    if (!UUID_RE.test(rows[0].instance_uuid)) throw new Error('Invalid instance UUID');
  });

  await step('POST /api/auth/login wrong password returns 401', async () => {
    const r = await req('POST', '/api/auth/login', {
      auth: false,
      allowFail: true,
      body: { email: EMAIL, password: 'definitely-wrong-password' },
    });
    if (r.status !== 401) throw new Error('Expected 401, got ' + r.status);
  });

  await step('POST /api/auth/login returns token', async () => {
    const r = await req('POST', '/api/auth/login', { auth: false, body: { email: EMAIL, password: PASSWORD } });
    if (!r.body.token) throw new Error('No token in response');
    token = r.body.token;
  });

  await step('GET /api/auth/me returns user', async () => {
    const r = await req('GET', '/api/auth/me');
    if (!r.body.user || r.body.user.email !== EMAIL) throw new Error('Wrong user');
  });

  const customerEmail = 'customer+' + Date.now() + '@smoke.test';
  const customerPassword = 'CustomerPass123!';
  await step('POST /api/admin/users creates reserved customer role', async () => {
    const before = count('SELECT COUNT(*) AS c FROM users');
    const r = await req('POST', '/api/admin/users', {
      body: {
        email: customerEmail,
        password: customerPassword,
        display_name: 'Smoke Customer',
        role: 'customer',
      },
    });
    if (r.status !== 201) throw new Error('Expected 201, got ' + r.status);
    if (r.body.role !== 'customer') throw new Error('Wrong role');
    const after = count('SELECT COUNT(*) AS c FROM users');
    if (after !== before + 1) throw new Error('User row not inserted');
  });

  await step('POST /api/auth/login blocks reserved customer role', async () => {
    const auditBefore = count("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'auth.login.role_not_enabled'");
    const r = await req('POST', '/api/auth/login', {
      auth: false,
      allowFail: true,
      body: { email: customerEmail, password: customerPassword },
    });
    if (r.status !== 403) throw new Error('Expected 403, got ' + r.status);
    const code = r.body?.code || r.body?.error?.code;
    if (code !== 'ROLE_LOGIN_NOT_ENABLED') throw new Error('Wrong error code');
    const auditAfter = count("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'auth.login.role_not_enabled'");
    if (auditAfter !== auditBefore + 1) throw new Error('Role block audit row missing');
  });

  await step('POST /api/admin/users rejects invalid role', async () => {
    const r = await req('POST', '/api/admin/users', {
      allowFail: true,
      body: {
        email: 'garbage+' + Date.now() + '@smoke.test',
        password: 'GarbagePass123!',
        display_name: 'Garbage Role',
        role: 'garbage_role',
      },
    });
    if (r.status !== 400) throw new Error('Expected 400, got ' + r.status);
  });

  await step('GET /api/public/site returns config map', async () => {
    const r = await req('GET', '/api/public/site', { auth: false });
    if (typeof r.body !== 'object' || !r.body.hotline) throw new Error('No hotline key');
  });

  let articleId, articleSlug;
  await step('POST /api/admin/articles creates draft', async () => {
    const r = await req('POST', '/api/admin/articles', {
      body: { title: 'Smoke Test Article ' + Date.now(), excerpt: 'Test', content_html: '<p>Hello</p>', status: 'draft' },
    });
    if (r.status !== 201) throw new Error('Expected 201, got ' + r.status);
    articleId = r.body.id;
    articleSlug = r.body.slug;
  });

  await step('PUT /api/admin/articles/:id publishes article', async () => {
    const r = await req('PUT', '/api/admin/articles/' + articleId, {
      body: { status: 'published' },
    });
    if (r.body.status !== 'published') throw new Error('Status not published');
    if (!r.body.published_at) throw new Error('published_at not set');
  });

  await step('GET /api/public/articles/:slug returns published article', async () => {
    const r = await req('GET', '/api/public/articles/' + articleSlug, { auth: false });
    if (r.body.id !== articleId) throw new Error('Wrong article');
  });

  await step('DELETE /api/admin/articles/:id removes article', async () => {
    await req('DELETE', '/api/admin/articles/' + articleId);
    const r = await req('GET', '/api/public/articles/' + articleSlug, { auth: false, allowFail: true });
    if (r.status !== 404) throw new Error('Article still findable after delete');
  });

  await step('POST /api/public/leads creates lead and persists row', async () => {
    const before = count('SELECT COUNT(*) AS c FROM leads');
    const r = await req('POST', '/api/public/leads', {
      auth: false,
      body: { name: 'Smoke Test', phone: '0901234567', email: 'smoke@test.com' },
    });
    if (r.status !== 201) throw new Error('Expected 201, got ' + r.status);
    const after = count('SELECT COUNT(*) AS c FROM leads');
    if (after !== before + 1) throw new Error('Lead row not inserted');
  });

  await step('POST /api/public/leads honeypot silently drops lead', async () => {
    const leadsBefore = count('SELECT COUNT(*) AS c FROM leads');
    const auditBefore = count("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'lead.honeypot_blocked'");
    const r = await req('POST', '/api/public/leads', {
      auth: false,
      body: {
        name: 'Spam Bot',
        phone: '0901234568',
        email: 'spam@test.com',
        website: 'http://spam.com',
      },
    });
    if (r.status !== 201) throw new Error('Expected 201, got ' + r.status);
    if (!r.body.ok) throw new Error('Expected ok true');
    if (r.body.lead_id < 100000 || r.body.lead_id > 999999) throw new Error('Fake lead_id out of range');
    const leadsAfter = count('SELECT COUNT(*) AS c FROM leads');
    const auditAfter = count("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'lead.honeypot_blocked'");
    if (leadsAfter !== leadsBefore) throw new Error('Honeypot inserted a lead row');
    if (auditAfter !== auditBefore + 1) throw new Error('Honeypot audit row missing');
  });

  await step('GET /api/admin/leads lists leads', async () => {
    const r = await req('GET', '/api/admin/leads');
    if (!Array.isArray(r.body.rows)) throw new Error('rows not array');
  });

  await step('PUT /api/admin/site/:key updates config', async () => {
    const r = await req('PUT', '/api/admin/site/smoke.test.key', { body: { value: 'hello-smoke' } });
    if (r.body.value !== 'hello-smoke') throw new Error('Value not updated');
  });

  console.log('');
  console.log('▸ Results: ' + pass + ' passed, ' + fail + ' failed');
  closeDb();
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => {
  console.error('✗ Fatal:', e);
  closeDb();
  process.exit(2);
});
