/**
 * tests/acceptance-v144.test.mjs — PROMPT v1.4.4 §5 acceptance suite.
 *
 * 50 criteria. Many are static (file present, string match in source),
 * some are runtime (boot test, integration). Each criterion → one
 * pass/fail line. The hard SEC-1..12 functional tests live in
 * sec-redteam.test.mjs and are summarized in this report by re-running.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
const lines = [];

function check(label, fn) {
  try {
    const r = fn();
    if (r === true || (typeof r === 'object' && r && r.ok)) {
      pass++; lines.push(`  ✓ ${label}${r && r.detail ? ` — ${r.detail}` : ''}`);
    } else {
      fail++; lines.push(`  ✗ ${label}${r && r.detail ? ` — ${r.detail}` : ''}`);
    }
  } catch (err) {
    fail++; lines.push(`  ✗ ${label} — threw: ${err.message}`);
  }
}

function readFile(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function srcMatches(p, re) {
  return re.test(readFile(p));
}

// --------------------------------------------------------------------
// Section A: Schema (criteria 1-5)
// --------------------------------------------------------------------
lines.push('\n=== A. Schema (5 criteria) ===');

check('1. Migration 016 (licenses table) exists', () =>
  exists('src/core/db/migrations/016_licenses.sql') &&
  srcMatches('src/core/db/migrations/016_licenses.sql', /CREATE TABLE IF NOT EXISTS licenses/));

check('2. Migration 017 (tenant license link) exists', () =>
  exists('src/core/db/migrations/017_tenant_license_link.sql') &&
  srcMatches('src/core/db/migrations/017_tenant_license_link.sql', /license_id|plan_cached/));

check('3. Migration 018 (api_keys) exists', () =>
  exists('src/core/db/migrations/018_api_keys.sql') &&
  srcMatches('src/core/db/migrations/018_api_keys.sql', /key_prefix.*UNIQUE/i));

check('4. Migration 019 (api_usage) exists', () =>
  exists('src/core/db/migrations/019_api_usage.sql') &&
  srcMatches('src/core/db/migrations/019_api_usage.sql', /api_usage/));

check('5. Migration 020 (license_activations) exists', () =>
  exists('src/core/db/migrations/020_license_activations.sql') &&
  srcMatches('src/core/db/migrations/020_license_activations.sql', /license_activations/));

// --------------------------------------------------------------------
// Section B: Core libraries (criteria 6-12)
// --------------------------------------------------------------------
lines.push('\n=== B. Core libraries (7 criteria) ===');

check('6. licenseKey.js implements verifyLicense', () =>
  exists('src/core/lib/licenseKey.js') &&
  srcMatches('src/core/lib/licenseKey.js', /export function verifyLicense/));

check('7. crl.js implements syncCrl + isRevoked + signCrl', () =>
  srcMatches('src/core/lib/crl.js', /export function syncCrl/) &&
  srcMatches('src/core/lib/crl.js', /export function isRevoked/) &&
  srcMatches('src/core/lib/crl.js', /export function signCrl/));

check('8. apiKeyMint.js exports mintApiKey + verifyApiKey + DUMMY_HASH', () =>
  srcMatches('src/core/lib/apiKeyMint.js', /export function mintApiKey/) &&
  srcMatches('src/core/lib/apiKeyMint.js', /export async function verifyApiKey/) &&
  srcMatches('src/core/lib/apiKeyMint.js', /export const DUMMY_HASH/));

check('9. rateLimiterIp.js exports tryAcquire', () =>
  srcMatches('src/core/lib/rateLimiterIp.js', /export function tryAcquire/));

check('10. planQuotas.js defines all 5 plans', () => {
  const s = readFile('src/core/lib/planQuotas.js');
  return /community/.test(s) && /lite/.test(s) && /standard/.test(s) && /pro/.test(s) && /pro_plus/.test(s);
});

check('11. maskers.js exports maskLead + maskPhone + maskEmail', () =>
  srcMatches('src/core/lib/maskers.js', /export function maskLead/) &&
  srcMatches('src/core/lib/maskers.js', /export function maskPhone/) &&
  srcMatches('src/core/lib/maskers.js', /export function maskEmail/));

check('12. aiDetect.js exports scoreLead (gated by plan)', () =>
  srcMatches('src/core/lib/aiDetect.js', /export function scoreLead/) &&
  srcMatches('src/core/lib/aiDetect.js', /planHasFeature/));

// --------------------------------------------------------------------
// Section C: Middleware (criteria 13-18)
// --------------------------------------------------------------------
lines.push('\n=== C. Middleware (6 criteria) ===');

check('13. licenseGate.js — strict/warn/off modes', () => {
  const s = readFile('src/core/middleware/licenseGate.js');
  return /strict/.test(s) && /warn/.test(s) && /off/.test(s);
});

check('14. licenseGate.js refuses with 402 PAYMENT_REQUIRED', () =>
  srcMatches('src/core/middleware/licenseGate.js', /status\(402\)/));

check('15. apiKey.js calls rateLimitPerIp before bcrypt', () => {
  const s = readFile('src/core/middleware/apiKey.js');
  const ipIdx = s.indexOf('rateLimitPerIp.tryAcquire');
  // Look for the call site of verifyApiKey (not the import) — must be `await verifyApiKey(`
  const bcryptIdx = s.indexOf('await verifyApiKey(');
  return ipIdx > 0 && bcryptIdx > 0 && ipIdx < bcryptIdx;
});

check('16. apiKey.js uses DUMMY_HASH on miss path', () =>
  srcMatches('src/core/middleware/apiKey.js', /DUMMY_HASH/));

check('17. attribution.js sets X-Powered-By per plan', () =>
  srcMatches('src/core/middleware/attribution.js', /X-Powered-By/) &&
  srcMatches('src/core/middleware/attribution.js', /attributionLevel/));

check('18. softLock.js exports maskLeadsForPlan', () =>
  srcMatches('src/core/middleware/softLock.js', /export function maskLeadsForPlan/));

// --------------------------------------------------------------------
// Section D: License controller (criteria 19-25)
// --------------------------------------------------------------------
lines.push('\n=== D. License controller (7 criteria) ===');

const lc = 'src/backend/modules/license/license.controller.js';
check('19. POST /activate route defined', () =>
  srcMatches(lc, /router\.post\(['"]\/activate['"]/));

check('20. POST /sync-crl route defined', () =>
  srcMatches(lc, /router\.post\(['"]\/sync-crl['"]/));

check('21. GET /status route defined', () =>
  srcMatches(lc, /router\.get\(['"]\/status['"]/));

check('22. activate enforces SEC-6 domain match', () =>
  srcMatches(lc, /LICENSE_DOMAIN_MISMATCH/));

check('23. activate logs SEC-7 replay_suspected', () =>
  srcMatches(lc, /license\.activation\.replay_suspected/));

check('24. activate persists into license_activations', () =>
  srcMatches(lc, /INSERT INTO license_activations/));

check('25. activate updates tenants.plan_cached', () =>
  srcMatches(lc, /UPDATE tenants[\s\S]*plan_cached/));

// --------------------------------------------------------------------
// Section E: Operator CLIs (criteria 26-31)
// --------------------------------------------------------------------
lines.push('\n=== E. Operator CLIs (6 criteria) ===');

check('26. scripts/op-license-sign.js exists, refuses RSA<4096', () => {
  const s = readFile('scripts/op-license-sign.js');
  return /MIN_KEY_BITS/.test(s) && /4096/.test(s);
});

check('27. scripts/op-license-revoke.js exists', () =>
  exists('scripts/op-license-revoke.js'));

check('28. scripts/op-crl-sign.js exists', () =>
  exists('scripts/op-crl-sign.js'));

check('29. scripts/op-create-api-key.js exists', () =>
  exists('scripts/op-create-api-key.js'));

check('30. scripts/op-revoke-api-key.js exists', () =>
  exists('scripts/op-revoke-api-key.js'));

check('31. scripts/op-license-reimport.js exists (DR)', () =>
  exists('scripts/op-license-reimport.js'));

// --------------------------------------------------------------------
// Section F: SEC-1..12 (criteria 32-43) — re-run sec-redteam suite
// --------------------------------------------------------------------
lines.push('\n=== F. SEC-1..SEC-12 red-team (12 criteria) ===');

const sec = spawnSync('node', [path.join(ROOT, 'tests/sec-redteam.test.mjs')], {
  encoding: 'utf8',
  env: { ...process.env, DB_PATH: path.join(ROOT, '.test-data', 'load.db') },
});
const secOut = sec.stdout + sec.stderr;

for (let i = 1; i <= 12; i++) {
  const sectionMatch = secOut.match(new RegExp(`SEC-${i}:[^\\n]*\\n([\\s\\S]*?)(?=\\n===|\\n--- SUMMARY)`));
  if (sectionMatch) {
    const lines2 = sectionMatch[1].split('\n').filter(l => l.trim().startsWith('✓') || l.trim().startsWith('✗'));
    const subPass = lines2.filter(l => l.includes('✓')).length;
    const subFail = lines2.filter(l => l.includes('✗')).length;
    const total = subPass + subFail;
    if (subFail === 0 && subPass > 0) {
      pass++;
      lines.push(`  ✓ 31+${i}. SEC-${i} passes (${subPass}/${total} sub-checks)`);
    } else {
      fail++;
      lines.push(`  ✗ 31+${i}. SEC-${i} failed (${subPass}/${total} sub-checks pass)`);
    }
  } else {
    fail++;
    lines.push(`  ✗ 31+${i}. SEC-${i} — no output found`);
  }
}

// --------------------------------------------------------------------
// Section G: Server.js integration (criteria 44-47)
// --------------------------------------------------------------------
lines.push('\n=== G. Server wiring (4 criteria) ===');

const srv = 'src/backend/server.js';
check('44. server.js mounts /api/admin/license', () =>
  srcMatches(srv, /app\.use\(['"]\/api\/admin\/license['"]/));

check('45. server.js mounts /api/v1 with requireApiKey + licenseGate', () =>
  srcMatches(srv, /app\.use\(['"]\/api\/v1['"],\s*requireApiKey,\s*licenseGate\)/));

check('46. server.js attaches maskLeadsForPlan to /api/admin/leads', () =>
  srcMatches(srv, /app\.use\(['"]\/api\/admin\/leads['"],\s*maskLeadsForPlan/));

check('47. server.js calls loadPublicKey in strict mode at boot', () =>
  srcMatches(srv, /loadPublicKey/));

// --------------------------------------------------------------------
// Section H: Admin UI (criteria 48-50)
// --------------------------------------------------------------------
lines.push('\n=== H. Admin UI (3 criteria) ===');

check('48. /admin/license.html exists with activate UI', () =>
  exists('src/cms/admin/license.html') &&
  srcMatches('src/cms/admin/license.html', /jwtInput/) &&
  srcMatches('src/cms/admin/license.html', /syncCrlBtn/));

check('49. admin.js includes License tab for admin role + version 1.4.4 badge', () =>
  srcMatches('src/cms/admin/assets/admin.js', /License/) &&
  srcMatches('src/cms/admin/assets/admin.js', /v1\.4\.4/));

check('50. softlock-banner.js exists + auto-injected', () =>
  exists('src/cms/admin/assets/softlock-banner.js') &&
  srcMatches('src/cms/admin/assets/admin.js', /softlock-banner\.js/));

// --------------------------------------------------------------------
// Final report
// --------------------------------------------------------------------
console.log('=== PROMPT v1.4.4 §5 ACCEPTANCE TESTS ===\n');
console.log(lines.join('\n'));
console.log('\n--- SUMMARY ---');
console.log(`Pass: ${pass}`);
console.log(`Fail: ${fail}`);
console.log(`Total: ${pass + fail}`);
if (fail > 0) process.exit(1);
