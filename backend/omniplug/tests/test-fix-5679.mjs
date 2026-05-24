// Verify fixes for BUG #5/6/7/9 — path normalization hardening.
// Portable: reads source from project root via relative paths.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const src = fs.readFileSync(
  path.join(PROJECT_ROOT, 'src/backend/modules/redirections/redirections.cache.js'),
  'utf8'
);

// Extract just the normalizePath function for isolated testing
const fnMatch = src.match(/function normalizePath\([^)]*\) \{[\s\S]*?\n\}/);
if (!fnMatch) { console.error('Could not extract normalizePath'); process.exit(1); }

const sandbox = { String, Array, Object };
sandbox.global = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fnMatch[0] + "\nglobalThis._np = normalizePath;", sandbox);
const normalizePath = sandbox._np;

console.log('=== TEST: BUG #5/6/7/9 fix (path normalization) ===\n');

const cases = [
  // BUG #5: ASCII-only lowercase
  { name: 'BUG #5: regular UPPERCASE',                 input: '/Articles/My-Post', expected: '/articles/my-post' },
  { name: 'BUG #5: Vietnamese (non-ASCII preserved)',  input: '/CÀ-PHÊ',           expected: '/cÀ-phÊ' },

  // BUG #6: null byte
  { name: 'BUG #6: null byte rejected',                input: '/article\u0000bypass', expected: '' },
  { name: 'BUG #6: null in middle',                    input: '/a/b\u0000/c',         expected: '' },

  // BUG #7: double slash
  { name: 'BUG #7: double slash collapsed',            input: '/articles//double',    expected: '/articles/double' },
  { name: 'BUG #7: triple slash',                      input: '///etc/passwd',        expected: '/etc/passwd' },
  { name: 'BUG #7: many slashes',                      input: '/a/////b//////c',      expected: '/a/b/c' },

  // BUG #9: fragment
  { name: 'BUG #9: fragment stripped',                 input: '/page#section',        expected: '/page' },
  { name: 'BUG #9: fragment + query',                  input: '/page?q=1#section',    expected: '/page' },

  // Existing behavior preserved
  { name: 'Existing: query string stripped',           input: '/page?id=1',           expected: '/page' },
  { name: 'Existing: trailing slash stripped',         input: '/page/',               expected: '/page' },
  { name: 'Existing: root preserved',                  input: '/',                    expected: '/' },
  { name: 'Existing: empty input',                     input: '',                     expected: '/' },
  { name: 'Existing: no leading slash',                input: 'page',                 expected: '/page' },
  { name: 'Existing: combined transforms',             input: '/Articles//Post-1/?id=1#section', expected: '/articles/post-1' },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const got = normalizePath(c.input);
  const ok = got === c.expected;
  console.log(`  ${ok ? '✓' : '✗'} ${c.name.padEnd(45)} "${c.input}" → "${got}"${ok ? '' : ` (expected "${c.expected}")`}`);
  if (ok) pass++; else fail++;
}

console.log(`\n${pass}/${pass+fail} cases pass`);
process.exit(fail > 0 ? 1 : 0);
