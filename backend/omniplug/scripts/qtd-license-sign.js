#!/usr/bin/env node
/**
 * scripts/qtd-license-sign.js — Sign a Quoted-flavoured license envelope.
 *
 * Wraps the upstream `op-license-sign.js` JWT in the Quoted envelope:
 *   qtd_live_<header>.<payload>.<signature>
 *
 * Usage:
 *   node scripts/qtd-license-sign.js \
 *     --priv=keys/op-license-rsa.priv.pem \
 *     --signed-for=marcus-outdoor.test \
 *     --plan=lite \
 *     --customer-email=ops@marcus-outdoor.test \
 *     --customer-name="Marcus Outdoor" \
 *     --expires-in-days=365 \
 *     --env=live \
 *     --out=keys/marcus-outdoor.qtd-license.txt
 *
 * `--env=live` produces a `qtd_live_*` envelope (default).
 * `--env=test` produces a `qtd_test_*` envelope (recommended for local dev).
 *
 * The inner JWT is identical to what op-license-sign.js would produce.
 * Plan vocabulary maps:
 *   OmniPlug → Quoted
 *   community → free
 *   lite      → free
 *   standard  → pro
 *   pro       → pro
 *   pro_plus  → agency
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith('--')) out[a.slice(2)] = true;
  }
  return out;
}

function fail(msg, code = 2) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (!args.priv)        fail('--priv=<path> is required');
if (!args['signed-for']) fail('--signed-for=<domain> is required');
if (!args.plan)        fail('--plan=community|lite|standard|pro|pro_plus is required');

const envTag = (args.env || 'live').toLowerCase();
if (envTag !== 'live' && envTag !== 'test') {
  fail('--env must be "live" or "test"');
}

// Stage the inner JWT to a temp file via the upstream signer, then read+wrap.
const innerOut = path.resolve(`.qtd-inner.${process.pid}.jwt`);
const signerPath = path.join(__dirname, 'op-license-sign.js');

const cliArgs = [
  signerPath,
  `--priv=${args.priv}`,
  `--plan=${args.plan}`,
  `--signed-for=${args['signed-for']}`,
  `--out=${innerOut}`,
];
if (args['customer-name'])  cliArgs.push(`--customer-name=${args['customer-name']}`);
if (args['customer-email']) cliArgs.push(`--customer-email=${args['customer-email']}`);
if (args['expires-in-days']) cliArgs.push(`--expires-in-days=${args['expires-in-days']}`);
if (args.jti)               cliArgs.push(`--jti=${args.jti}`);
if (args.features)          cliArgs.push(`--features=${args.features}`);

const result = spawnSync(process.execPath, cliArgs, { stdio: 'inherit' });
if (result.status !== 0) {
  try { fs.unlinkSync(innerOut); } catch {}
  fail(`Inner signing failed (exit ${result.status})`);
}

const inner = fs.readFileSync(innerOut, 'utf8').trim();
try { fs.unlinkSync(innerOut); } catch {}

const envelope = `qtd_${envTag}_${inner}`;
const outPath = path.resolve(args.out || `qtd-license-${args['signed-for']}.txt`);
fs.writeFileSync(outPath, envelope + '\n');

console.log('');
console.log(`✓ Quoted license envelope written to ${path.relative(process.cwd(), outPath)}`);
console.log(`  envelope:      qtd_${envTag}_…  (${envelope.length} bytes total)`);
console.log(`  signed_for:    ${args['signed-for']}`);
console.log(`  plan:          ${args.plan}`);
console.log('');
console.log('Paste the contents of that file into the Quoted WP plugin');
console.log('Settings → "License key" field, then click "Connect".');
