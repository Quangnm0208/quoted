#!/usr/bin/env node
/**
 * scripts/op-revoke-api-key.js — Revoke an API key by prefix.
 *
 * Usage:
 *   node scripts/op-revoke-api-key.js --prefix=AbCdEf12 [--reason="key compromised"]
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
  if (!args.prefix) {
    console.error('Usage: op-revoke-api-key.js --prefix=<key_prefix> [--reason=<reason>]');
    process.exit(2);
  }
  // Accept both "op_live_AbCdEf12" and bare "AbCdEf12"
  const prefix = args.prefix.startsWith('op_live_') ? args.prefix.slice(8).split('_')[0] : args.prefix;

  const row = db.prepare(`
    SELECT id, tenant_id, name, status FROM api_keys WHERE key_prefix = ?
  `).get(prefix);
  if (!row) {
    console.error(`✗ No API key found with prefix=${prefix}`);
    process.exit(2);
  }
  if (row.status === 'revoked') {
    console.log(`▸ Key id=${row.id} (prefix=${prefix}) already revoked. No-op.`);
    return;
  }
  db.prepare(`
    UPDATE api_keys
       SET status         = 'revoked',
           revoked_at     = datetime('now'),
           revoked_reason = ?
     WHERE id = ?
  `).run(args.reason || 'operator_revoke', row.id);

  console.log(`✓ Revoked API key id=${row.id}, prefix=${prefix}, tenant=${row.tenant_id}, name="${row.name}"`);
  console.log(`  Reason: ${args.reason || 'operator_revoke'}`);
  console.log(`  Customer should be re-minted via op-create-api-key.js`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
