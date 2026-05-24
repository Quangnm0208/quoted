#!/usr/bin/env node
/**
 * scripts/op-license-reimport.js — Disaster recovery: bulk re-import licenses.
 *
 * If the licenses table is lost (DB corrupted/wiped), customers can
 * still re-paste their JWTs OR the operator can bulk-import them from a
 * backed-up list. Each JWT is verified against the operator public key
 * before insert; tenants are matched by `signed_for` domain.
 *
 * Usage:
 *   node scripts/op-license-reimport.js --jwt-file=customer-jwts.txt
 *
 * jwt-file format: one JWT per line, comments (#) and blank lines ignored.
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import fs from 'node:fs';
import path from 'node:path';
import db from '../src/core/db/connection.js';
import { verifyLicense } from '../src/core/lib/licenseKey.js';

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function normalizeDomain(s) {
  return String(s || '').toLowerCase().replace(/^www\./, '').replace(/:.*$/, '').trim();
}

function main() {
  const args = parseArgs(process.argv);
  if (!args['jwt-file']) {
    console.error('Usage: op-license-reimport.js --jwt-file=<path-to-jwts.txt>');
    process.exit(2);
  }
  const filePath = path.resolve(args['jwt-file']);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ JWT file not found: ${filePath}`);
    process.exit(2);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const jwts = content.split(/\r?\n/)
    .map(line => line.replace(/#.*$/, '').trim())
    .filter(Boolean);

  console.log(`▸ Loaded ${jwts.length} JWT(s) to import`);

  let imported = 0, failed = 0, no_tenant = 0;
  const upsert = db.prepare(`
    INSERT INTO licenses
      (jti, raw_jwt, plan, signed_for, customer_name, customer_email,
       issued_at, expires_at, features_json, status, tenant_id)
    VALUES
      (@jti, @raw_jwt, @plan, @signed_for, @customer_name, @customer_email,
       @issued_at, @expires_at, @features_json, 'active', @tenant_id)
    ON CONFLICT(jti) DO UPDATE SET
      raw_jwt        = excluded.raw_jwt,
      plan           = excluded.plan,
      signed_for     = excluded.signed_for,
      customer_name  = excluded.customer_name,
      customer_email = excluded.customer_email,
      issued_at      = excluded.issued_at,
      expires_at     = excluded.expires_at,
      features_json  = excluded.features_json,
      tenant_id      = excluded.tenant_id,
      updated_at     = datetime('now')
  `);

  for (const jwt of jwts) {
    let payload;
    try {
      payload = verifyLicense(jwt);
    } catch (err) {
      console.error(`  ✗ ${jwt.slice(0, 32)}... — ${err.code}: ${err.message}`);
      failed++;
      continue;
    }
    // Match tenant by signed_for domain
    let tenantId = null;
    if (payload.signed_for) {
      const want = normalizeDomain(payload.signed_for);
      const tenant = db.prepare(`SELECT id, domain FROM tenants`).all()
        .find(t => normalizeDomain(t.domain) === want);
      if (tenant) tenantId = tenant.id;
    }
    if (!tenantId) {
      console.warn(`  ▸ jti=${payload.jti} signed_for="${payload.signed_for}" — no matching tenant; license imported without tenant link`);
      no_tenant++;
    }
    upsert.run({
      jti: payload.jti,
      raw_jwt: jwt,
      plan: payload.plan,
      signed_for: payload.signed_for || null,
      customer_name: payload.customer_name || '',
      customer_email: payload.customer_email || '',
      issued_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString(),
      expires_at: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      features_json: JSON.stringify(payload.features || {}),
      tenant_id: tenantId,
    });
    if (tenantId) {
      const licenseRow = db.prepare('SELECT id FROM licenses WHERE jti = ?').get(payload.jti);
      db.prepare(`UPDATE tenants SET license_id = ?, plan_cached = ?, plan_checked_at = datetime('now') WHERE id = ?`)
        .run(licenseRow.id, payload.plan, tenantId);
    }
    imported++;
  }

  console.log('');
  console.log(`▸ Summary: imported=${imported}, failed=${failed}, no_tenant_match=${no_tenant}`);
  if (no_tenant > 0) {
    console.log('  Licenses without tenant match are stored but not active.');
    console.log('  Re-run after creating the missing tenants, or use op-link-license.js.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
