// Verify BUG #17/#18 fix: oversize content_html rejected via schema + service guard.
// Portable: imports schema from this project, not external paths.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// articleInputSchema imports zod — requires node_modules to be installed
// in the project root (npm ci before running).
const { articleInputSchema, CONTENT_HTML_MAX_BYTES } = await import(
  path.join(PROJECT_ROOT, 'src/backend/modules/articles/articles.schema.js')
);

console.log('=== TEST: BUG #17/#18 fix (content_html size cap) ===\n');
console.log(`CONTENT_HTML_MAX_BYTES = ${CONTENT_HTML_MAX_BYTES}\n`);

const cases = [
  { name: 'Empty content',         html: '',                                        shouldPass: true },
  { name: 'Normal article (5KB)',  html: '<p>'.repeat(500) + '</p>'.repeat(500),    shouldPass: true },
  { name: 'Large article (100KB)', html: '<p>x</p>'.repeat(10000),                  shouldPass: true },
  { name: 'At limit (199KB)',      html: 'a'.repeat(199_000),                       shouldPass: true },
  { name: 'Over limit (200KB+1)',  html: 'a'.repeat(CONTENT_HTML_MAX_BYTES + 1),    shouldPass: false },
  { name: 'Pathological (1MB)',    html: 'a'.repeat(1_048_576),                     shouldPass: false },
  { name: 'Vietnamese UTF-8',      html: 'ầ'.repeat(80_000),                         shouldPass: false }, // ầ = 3 bytes
  { name: 'No content_html',       payload: { title: 'x' },                          shouldPass: true },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const payload = c.payload || { content_html: c.html };
  const result = articleInputSchema.safeParse(payload);
  const got = result.success;
  if (got === c.shouldPass) {
    console.log(`  ✓ ${c.name.padEnd(30)} ${got ? 'accepted' : 'rejected'}`);
    pass++;
  } else {
    console.log(`  ✗ ${c.name.padEnd(30)} expected ${c.shouldPass ? 'pass' : 'fail'}, got ${got ? 'pass' : 'fail'}`);
    fail++;
  }
}

console.log(`\n${pass}/${pass+fail} schema cases pass`);

console.log('\n--- Service-layer guardContentSize wiring ---');
const svc = fs.readFileSync(
  path.join(PROJECT_ROOT, 'src/backend/modules/seo-validator/seo-validator.service.js'),
  'utf8'
);
const checks = [
  ['guardContentSize function exists',        svc.includes('function guardContentSize')],
  ['Called in buildOpts before parseDom',     /guardContentSize\(content\)[\s\S]*?parseDom\(/.test(svc)],
  ['Throws ValidationError',                  /guardContentSize[\s\S]*?ValidationError/.test(svc)],
  ['Imports CONTENT_HTML_MAX_BYTES',          svc.includes("import { CONTENT_HTML_MAX_BYTES } from '../articles/articles.schema.js'")],
];
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (!ok) fail++;
}

process.exit(fail > 0 ? 1 : 0);
