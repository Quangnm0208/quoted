#!/usr/bin/env node
/**
 * scripts/op-license-revoke.js — Mark a license locally revoked.
 *
 * This ONLY updates the local DB. To propagate revocation to all
 * customer deployments, use op-crl-sign.js then distribute the
 * signed CRL JSON via customer portal / email until Bridge (v1.5.0).
 *
 * Usage:
 *   node scripts/op-license-revoke.js --jti=op-lic-abc123 --reason="terms_violation"
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import db from '../src/core/db/connection.js';

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith('--')) out[a.slice(2)] = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.jti) {
    console.error('Usage: node scripts/op-license-revoke.js --jti=<jti> [--reason=<reason>]');
    process.exit(2);
  }

  const reason = args.reason || 'operator_revoke';
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const license = db.prepare('SELECT id, jti FROM licenses WHERE jti = ?').get(args.jti);
    if (!license) {
      console.warn(`[op-revoke] no license row found for jti=${args.jti} — adding to local CRL anyway so it cannot be activated`);
    } else {
      db.prepare(`UPDATE licenses SET status = 'revoked', updated_at = ? WHERE id = ?`)
        .run(now, license.id);
    }
    db.prepare(`
      INSERT INTO license_revocations (jti, revoked_at, reason, synced_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(jti) DO UPDATE SET
        revoked_at = excluded.revoked_at,
        reason     = excluded.reason,
        synced_at  = excluded.synced_at
    `).run(args.jti, now, reason, now);
  });
  tx();

  console.log(`✓ Revoked locally: jti=${args.jti}, reason=${reason}`);
  console.log(`  Next step: run op-crl-sign.js to produce a signed CRL`);
  console.log(`  to distribute to customer deployments.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
