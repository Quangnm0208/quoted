#!/usr/bin/env node
/**
 * scripts/preflight-strict.mjs — Pre-flight check before flipping
 * LICENSE_ENFORCEMENT from 'warn' → 'strict'.
 *
 * Runs a battery of read-only checks against the local deployment.
 * Exits 0 if all green; exits 1 with a numbered list of failures if not.
 *
 * Usage:
 *   node scripts/preflight-strict.mjs            # default DB
 *   DB_PATH=/path/to/cms.db node scripts/preflight-strict.mjs
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const checks = [];
function check(name, run) { checks.push({ name, run }); }

// 1. Public key file present + not placeholder
check('Public key file present at keys/op-license-pub.pem', () => {
  const p = process.env.LICENSE_PUBLIC_KEY_PATH ||
    path.resolve(process.cwd(), 'keys', 'op-license-pub.pem');
  if (!fs.existsSync(p)) throw new Error(`missing: ${p}`);
  const content = fs.readFileSync(p, 'utf8');
  if (/TODO_OPERATOR_PUBLIC_KEY_PEM/.test(content)) {
    throw new Error('still has TODO_OPERATOR_PUBLIC_KEY_PEM placeholder — run op-key-generate.js first');
  }
  return p;
});

// 2. Public key has correct strength (RSA-4096+ or P-384)
check('Public key passes SEC-10 strength rules', async () => {
  const { loadPublicKey, getPublicKeyAlg, _resetPublicKeyCacheForTests } =
    await import('../src/core/lib/licenseKey.js');
  _resetPublicKeyCacheForTests();
  loadPublicKey();
  return `algorithm: ${getPublicKeyAlg()}`;
});

// 3. Database is at migration 024+
check('DB schema is at v1.4.4 hotfix level (migration >= 024)', async () => {
  const dbMod = await import('../src/core/db/connection.js');
  const db = dbMod.default;
  // Production code uses `schema_migrations(filename, applied_at)`.
  // Tolerate test environments where load.db hasn't materialized the
  // ledger yet — fall back to checking for the v1.4.4 license tables.
  let maxNum = 0;
  try {
    const rows = db.prepare('SELECT filename FROM schema_migrations').all();
    for (const r of rows) {
      const m = /^(\d+)_/.exec(r.filename);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
  } catch {
    // No schema_migrations table — verify the v1.4.4 tables exist instead
    const tabs = db.prepare(`
      SELECT name FROM sqlite_master
       WHERE type='table' AND name IN
       ('licenses','license_revocations','api_keys','api_usage','license_activations')
    `).all();
    if (tabs.length === 5) return 'tables present (ledger fallback)';
    throw new Error(`only ${tabs.length}/5 v1.4.4 tables present, and no schema_migrations ledger`);
  }
  if (maxNum < 24) throw new Error(`only at migration ${maxNum}`);
  return `migration: ${maxNum}`;
});

// 4. At least one license activated (otherwise strict mode would lock everyone out)
check('At least one license activated', async () => {
  const dbMod = await import('../src/core/db/connection.js');
  const db = dbMod.default;
  const row = db.prepare(`SELECT COUNT(*) AS c FROM licenses WHERE status = 'active'`).get();
  if (row.c === 0) {
    throw new Error('zero active licenses — flipping strict would block ALL /api/v1/* traffic. Activate licenses first.');
  }
  return `${row.c} active license(s)`;
});

// 5. Every paying tenant has plan_cached set (no NULLs)
check('Every paying tenant has plan_cached set', async () => {
  const dbMod = await import('../src/core/db/connection.js');
  const db = dbMod.default;
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM tenants
     WHERE license_id IS NOT NULL AND plan_cached IS NULL
  `).get();
  if (row.c > 0) throw new Error(`${row.c} tenant(s) have license_id but no plan_cached`);
  return 'OK';
});

// 6. TELEMETRY_URL is intentional (either disabled or a real https URL)
check('TELEMETRY_URL is intentional', () => {
  const v = process.env.TELEMETRY_URL;
  if (v === 'disabled') return 'disabled (default)';
  if (v && /^https:\/\//.test(v)) return v;
  if (!v) throw new Error('TELEMETRY_URL not set. Set to "disabled" or an https endpoint in fly.toml.');
  throw new Error(`TELEMETRY_URL=${v} is neither "disabled" nor an https URL`);
});

// 7. fly.toml (if present) is strict for production.
check('fly.toml LICENSE_ENFORCEMENT is strict', () => {
  const flyPath = path.resolve(process.cwd(), 'fly.toml');
  if (!fs.existsSync(flyPath)) return 'no fly.toml (skipping)';
  const fly = fs.readFileSync(flyPath, 'utf8');
  const m = fly.match(/LICENSE_ENFORCEMENT\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('LICENSE_ENFORCEMENT not declared in fly.toml');
  if (!['off', 'warn', 'strict'].includes(m[1])) throw new Error(`LICENSE_ENFORCEMENT=${m[1]} not in {off,warn,strict}`);
  if (m[1] !== 'strict') throw new Error(`LICENSE_ENFORCEMENT=${m[1]} leaves /api/v1 open; set strict for production`);
  return m[1];
});

// 8. Public key file mode is reasonable (not world-writable)
check('Public key file is not world-writable', () => {
  const p = process.env.LICENSE_PUBLIC_KEY_PATH ||
    path.resolve(process.cwd(), 'keys', 'op-license-pub.pem');
  const mode = fs.statSync(p).mode & 0o777;
  if (mode & 0o002) throw new Error(`mode ${mode.toString(8)} — world-writable`);
  return `mode ${mode.toString(8)}`;
});

// 9. node_modules present with critical native/runtime packages (server can boot)
check('node_modules installed with runtime packages', () => {
  const modulesDir = path.resolve(process.cwd(), 'node_modules');
  if (!fs.existsSync(modulesDir)) {
    throw new Error('node_modules missing — run npm ci');
  }
  const required = ['better-sqlite3', 'sharp', 'bcryptjs'];
  const missing = required.filter((name) => !fs.existsSync(path.join(modulesDir, name)));
  if (missing.length > 0) {
    throw new Error(`node_modules incomplete, missing: ${missing.join(', ')} — run npm ci successfully`);
  }
  return required.join(', ');
});

// 10. package.json version matches the expected v1.4.4
check('package.json version is 1.4.4', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  if (pkg.version !== '1.4.4') throw new Error(`version ${pkg.version} not 1.4.4`);
  return pkg.version;
});

(async () => {
  console.log('═══ OmniPlug CMS Core v1.4.4 — pre-flight strict check ═══\n');
  let passed = 0, failed = 0;
  const failures = [];
  for (const { name, run } of checks) {
    try {
      const detail = await run();
      console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${name} — ${err.message}`);
      failed++;
      failures.push({ name, err: err.message });
    }
  }
  console.log(`\n  ${passed}/${passed + failed} checks passed`);
  if (failed > 0) {
    console.log(`\n✗ NOT READY for LICENSE_ENFORCEMENT=strict`);
    console.log('  Fix the failures above and re-run. See docs/RUNBOOK.md §6.');
    process.exit(1);
  }
  console.log('\n✓ READY. You can safely set LICENSE_ENFORCEMENT=strict.');
  console.log('  Recommended: roll out one customer at a time, monitor for 24h before next.');
})();
