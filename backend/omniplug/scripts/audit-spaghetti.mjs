#!/usr/bin/env node
/**
 * audit-spaghetti.mjs — Automated architecture health check.
 *
 * Runs the release architecture health check. Outputs counts; CI
 * compares against baseline (committed in this file) and fails if any
 * category grows.
 *
 * Add to CI: `npm run audit` before merge to main.
 *
 * To update baseline (when 1 module gets refactored):
 *   1. Run this script
 *   2. Copy current counts to BASELINE below
 *   3. Commit. PR reviewer verifies counts went DOWN, not up.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// =============================================================================
// BASELINE - current state as of OmniPlug CMS Core v1.4.4 (baseline established at v1.2.0)
//
// CI rule: counts must NOT exceed these values. Lower is better.
// When refactoring reduces a count, update the baseline in the same PR.
// =============================================================================
const BASELINE = Object.freeze({
  controllers_with_db_prepare:  0,
  total_db_prepare_in_controllers: 0,
  circular_imports:             0,
  layer_violations:             0,   // repo→express, service→router
  dead_code_files:              1,   // src/core/index.js
                                     // (dialect.js removed in v1.4.0)
});

// =============================================================================
// Checks
// =============================================================================

function walk(dir, pattern = /\.js$/) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...walk(full, pattern));
    } else if (pattern.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function checkControllerDbPrepare() {
  const ctrls = walk(SRC).filter(f => f.endsWith('.controller.js'));
  const violators = [];
  let total = 0;
  for (const f of ctrls) {
    const content = fs.readFileSync(f, 'utf8');
    const matches = content.match(/db\.prepare\b|db\.exec\b/g) || [];
    if (matches.length > 0) {
      violators.push({ file: path.relative(ROOT, f), count: matches.length });
      total += matches.length;
    }
  }
  return { violators, total };
}

function checkLayerViolations() {
  const violations = [];

  // Repository must not import Express/Router
  for (const f of walk(SRC).filter(p => p.endsWith('.repository.js'))) {
    const content = fs.readFileSync(f, 'utf8');
    if (/from\s+['"](express|.*Router)/i.test(content)) {
      violations.push({ file: path.relative(ROOT, f), rule: 'repository-imports-router' });
    }
  }

  // Service must not import Router
  for (const f of walk(SRC).filter(p => p.endsWith('.service.js'))) {
    const content = fs.readFileSync(f, 'utf8');
    if (/from\s+['"]express['"]|import.*Router.*from/i.test(content)) {
      violations.push({ file: path.relative(ROOT, f), rule: 'service-imports-router' });
    }
  }

  return violations;
}

function checkCircularImports() {
  const JSDOC = /\/\*\*[\s\S]*?\*\//g;
  const IMP = /(?:import\b[^;'"]*|export\b[^;'"]*)\s+from\s+['"]([^'"]+\.js)['"]/g;

  const graph = new Map();
  for (const js of walk(SRC)) {
    const text = fs.readFileSync(js, 'utf8').replace(JSDOC, '');
    const targets = new Set();
    let m;
    while ((m = IMP.exec(text))) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const target = path.resolve(path.dirname(js), spec);
      if (fs.existsSync(target)) targets.add(target);
    }
    graph.set(js, targets);
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const cycles = [];

  function dfs(node, path) {
    color.set(node, GRAY);
    for (const next of graph.get(node) || []) {
      if (color.get(next) === GRAY) {
        cycles.push([...path.slice(path.indexOf(next)), next]);
      } else if (!color.has(next)) {
        dfs(next, [...path, next]);
      }
    }
    color.set(node, BLACK);
  }

  for (const node of graph.keys()) {
    if (!color.has(node)) dfs(node, [node]);
  }

  return cycles;
}

function checkDeadCode() {
  const JSDOC = /\/\*\*[\s\S]*?\*\//g;
  const IMP = /(?:import\b[^;'"]*|export\b[^;'"]*)\s+from\s+['"]([^'"]+)['"]/g;

  const imported = new Set();
  for (const js of walk(SRC)) {
    const text = fs.readFileSync(js, 'utf8').replace(JSDOC, '');
    let m;
    while ((m = IMP.exec(text))) {
      let spec = m[1];
      if (!spec.startsWith('.')) continue;
      if (!spec.endsWith('.js')) spec += '.js';
      const target = path.resolve(path.dirname(js), spec);
      if (fs.existsSync(target)) imported.add(target);
    }
  }

  const allFiles = walk(SRC);
  const ENTRY = new Set([
    path.join(SRC, 'backend/server.js'),
  ]);
  // Admin UI assets are loaded via HTML <script>, not ESM import
  const HTML_LOADED_PATTERNS = [
    /cms\/admin\/assets\/.*-init\.js$/,
    /cms\/admin\/assets\/admin\.js$/,
    /cms\/sdk\//,
  ];

  return allFiles.filter(f => {
    const normalized = f.split(path.sep).join('/');
    if (imported.has(f)) return false;
    if (ENTRY.has(f)) return false;
    if (HTML_LOADED_PATTERNS.some(re => re.test(normalized))) return false;
    return true;
  });
}

// =============================================================================
// Report + compare to baseline
// =============================================================================

console.log('═══ Architecture Health Audit ═══\n');

const dbResult = checkControllerDbPrepare();
const layerResult = checkLayerViolations();
const cycleResult = checkCircularImports();
const deadResult = checkDeadCode();

const current = {
  controllers_with_db_prepare: dbResult.violators.length,
  total_db_prepare_in_controllers: dbResult.total,
  circular_imports: cycleResult.length,
  layer_violations: layerResult.length,
  dead_code_files: deadResult.length,
};

console.log('Current state:');
for (const [k, v] of Object.entries(current)) {
  const base = BASELINE[k];
  let icon, msg;
  if (v < base)  { icon = '✓'; msg = `${v} (improved from ${base})`; }
  else if (v === base) { icon = '·'; msg = `${v} (unchanged)`; }
  else { icon = '✗'; msg = `${v} (REGRESSION from ${base})`; }
  console.log(`  ${icon} ${k}: ${msg}`);
}

const regressions = Object.entries(current).filter(([k, v]) => v > BASELINE[k]);

if (regressions.length > 0) {
  console.error('\n✗ AUDIT FAILED — architecture quality regressed:');
  for (const [k, v] of regressions) {
    console.error(`  ${k}: ${BASELINE[k]} → ${v}`);
  }
  if (dbResult.violators.length > BASELINE.controllers_with_db_prepare) {
    console.error('\n  New controller(s) with db.prepare():');
    for (const v of dbResult.violators) console.error(`    ${v.count}× ${v.file}`);
  }
  process.exit(1);
}

console.log('\n✓ Audit passed (no regressions vs baseline).');

// Suggest baseline updates when things improve
const improvements = Object.entries(current).filter(([k, v]) => v < BASELINE[k]);
if (improvements.length > 0) {
  console.log('\nℹ Architecture improved — update BASELINE in audit-spaghetti.mjs:');
  for (const [k, v] of improvements) console.log(`  ${k}: ${BASELINE[k]} → ${v}`);
}
