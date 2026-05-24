#!/usr/bin/env node
/**
 * scripts/op-create-api-key.js — Mint a new API key for a customer.
 *
 * Shows the full secret EXACTLY ONCE on stdout. The DB only ever stores
 * the bcrypt hash of the secret half (op_live_<prefix>_<hash>).
 *
 * Usage:
 *   node scripts/op-create-api-key.js \
 *     --tenant=12 \
 *     --license-id=5 \
 *     --name="Re-mint 2026-05-19" \
 *     --scope="site:read articles:read projects:read pages:read"
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import db from '../src/core/db/connection.js';
import { mintApiKey } from '../src/core/lib/apiKeyMint.js';
import {
  DEFAULT_API_KEY_SCOPE,
  scopeUsageText,
  validateApiKeyScopeString,
} from '../src/core/lib/apiKeyScopes.js';

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
  if (!args.tenant) {
    console.error(`Usage: op-create-api-key.js --tenant=<tenant_id> [--license-id=<id>] [--name=<label>] [--scope="${scopeUsageText()}"]`);
    process.exit(2);
  }
  const tenantId = parseInt(args.tenant, 10);
  if (!Number.isInteger(tenantId) || tenantId < 1) {
    console.error('--tenant must be a positive integer');
    process.exit(2);
  }

  const tenant = db.prepare('SELECT id, slug, name, domain FROM tenants WHERE id = ?').get(tenantId);
  if (!tenant) {
    console.error(`✗ Tenant id=${tenantId} not found`);
    process.exit(2);
  }

  let licenseId = null;
  if (args['license-id']) {
    licenseId = parseInt(args['license-id'], 10);
    const license = db.prepare('SELECT id, plan, signed_for FROM licenses WHERE id = ?').get(licenseId);
    if (!license) {
      console.error(`✗ License id=${licenseId} not found`);
      process.exit(2);
    }
  } else {
    // Auto-detect from tenant
    const t2 = db.prepare('SELECT license_id FROM tenants WHERE id = ?').get(tenantId);
    if (t2 && t2.license_id) licenseId = t2.license_id;
  }

  const minted = mintApiKey();
  const scope = args.scope || DEFAULT_API_KEY_SCOPE;
  const scopeValidation = validateApiKeyScopeString(scope);
  if (!scopeValidation.ok) {
    console.error(`Invalid --scope token(s): ${scopeValidation.invalid.join(', ')}`);
    console.error(`Allowed scopes: ${scopeUsageText()}`);
    process.exit(2);
  }
  const name = args.name || `Key ${new Date().toISOString().slice(0, 10)}`;

  db.prepare(`
    INSERT INTO api_keys (tenant_id, license_id, key_prefix, key_hash, name, scope, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(tenantId, licenseId, minted.prefix, minted.hash, name, scope);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' API KEY (SHOWN ONCE — STORE IMMEDIATELY)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  ' + minted.full);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  tenant:     ${tenant.name} (id=${tenantId}, domain=${tenant.domain || '—'})`);
  console.log(`  license:    ${licenseId || '(none)'}`);
  console.log(`  name:       ${name}`);
  console.log(`  scope:      ${scope}`);
  console.log(`  prefix:     ${minted.prefix} (this is what shows in DB / logs)`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Send to customer via:');
  console.log('  - SECURE channel (1Password share, signed email)');
  console.log('  - NOT chat / SMS');
  console.log('  - Tell them to paste the full string into their SDK config or');
  console.log('    use as `Authorization: Bearer <full-key>` header.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
