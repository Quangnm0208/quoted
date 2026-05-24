#!/usr/bin/env node
/**
 * scripts/op-key-generate.js — Generate an operator signing keypair.
 *
 * Picks the right algorithm based on the hardware you're using:
 *
 *   --rsa            → RSA-4096 (default). Use this if signing in software
 *                      or with YubiHSM 2 ($650). Software path = 1Password
 *                      Secure Note + tmpfs.
 *   --ec             → EC P-384. Use this if signing with a YubiKey 5 PIV
 *                      ($55). YubiKey 5 cannot do RSA-4096 but CAN do P-384,
 *                      which is cryptographically stronger than RSA-4096.
 *
 * Output: writes <basename>.priv.pem (chmod 600) and <basename>.pub.pem in
 * the current directory. Operator MUST move .priv.pem off this machine
 * immediately (1Password / YubiHSM / shred), and commit .pub.pem to the
 * repo at keys/op-license-pub.pem.
 *
 * Usage:
 *   node scripts/op-key-generate.js --rsa --basename=op-license-rsa
 *   node scripts/op-key-generate.js --ec  --basename=op-license-ec
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

function main() {
  const args = parseArgs(process.argv);
  if (!args.rsa && !args.ec) {
    fail('Pick one: --rsa  (RSA-4096, software/YubiHSM 2) or --ec  (P-384, YubiKey 5 PIV)');
  }
  if (args.rsa && args.ec) {
    fail('Pick exactly one of --rsa or --ec, not both');
  }

  const basename = args.basename || `op-license-${args.ec ? 'ec' : 'rsa'}-${Date.now()}`;
  const privPath = path.resolve(`${basename}.priv.pem`);
  const pubPath = path.resolve(`${basename}.pub.pem`);

  if (fs.existsSync(privPath)) fail(`Refuse: ${privPath} already exists. Pick a different --basename.`);
  if (fs.existsSync(pubPath))  fail(`Refuse: ${pubPath} already exists. Pick a different --basename.`);

  let publicKey, privateKey, description;
  if (args.rsa) {
    console.log('▸ Generating RSA-4096 keypair (this takes ~5-30s)…');
    ({ publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 4096 }));
    description = 'RSA-4096 (RS256)';
  } else {
    console.log('▸ Generating EC P-384 keypair…');
    ({ publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }));
    description = 'EC P-384 (ES384)';
  }

  fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(pubPath,  publicKey.export({  type: 'spki',  format: 'pem' }));

  console.log(`✓ Generated ${description}`);
  console.log(`  Private key:  ${privPath}  (chmod 600)`);
  console.log(`  Public key:   ${pubPath}`);
  console.log('');
  console.log('═══ NEXT STEPS — READ CAREFULLY ═══');
  console.log('1. Copy the PUBLIC key into the repo (commit + ship to every customer):');
  console.log(`     cp ${path.basename(pubPath)} keys/op-license-pub.pem`);
  console.log(`     git add keys/op-license-pub.pem && git commit -m "ops(license): install operator public key"`);
  console.log('');
  console.log('2. Store the PRIVATE key off this machine, then DESTROY the local copy:');
  if (args.rsa) {
    console.log('   Option A — 1Password Secure Note (recommended for solo operator):');
    console.log(`     cat ${path.basename(privPath)} | pbcopy   # macOS — paste into 1Password`);
    console.log(`     shred -uvz ${path.basename(privPath)}`);
    console.log('');
    console.log('   Option B — YubiHSM 2 ($650, supports RSA-4096):');
    console.log('     See https://developers.yubico.com/yubihsm-shell for PKCS#11 import');
  } else {
    console.log('   YubiKey 5 PIV slot (recommended — $55, hardware-bound P-384):');
    console.log(`     yubico-piv-tool -s 9c -a import-key -i ${path.basename(privPath)}`);
    console.log(`     yubico-piv-tool -s 9c -a generate-public-key -o yubikey-pub-check.pem`);
    console.log('     # Compare yubikey-pub-check.pem against your .pub.pem — must match');
    console.log(`     shred -uvz ${path.basename(privPath)}`);
    console.log('');
    console.log('   ⚠ The PIV "Authentication" slot (9a) is fine too if 9c is in use for SSH.');
  }
  console.log('');
  console.log('3. Verify the public key is recognised by the server:');
  console.log('     LICENSE_PUBLIC_KEY_PATH=keys/op-license-pub.pem node -e \\');
  console.log('       "import(\'./src/core/lib/licenseKey.js\').then(m => console.log(\'OK:\', m.getPublicKeyAlg()))"');
  console.log('');
  console.log('See docs/RUNBOOK.md §1 for the full bootstrap procedure.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
