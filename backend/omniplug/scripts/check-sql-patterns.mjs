#!/usr/bin/env node
/**
 * check-sql-patterns.mjs — SQL anti-pattern detector for OmniPlug CMS Core.
 *
 * Scans src/ for known dangerous patterns. Exit 1 if any ERROR found.
 *
 * Patterns detected:
 *   1. SQL double-quote string literal — `= "active"` inside SQL
 *   2. Top-level `const STMT = { ... db.prepare ... }` — should be lazy
 *   3. SELECT * from tenant table without `tenant_id` (warn)
 *
 * Run: node scripts/check-sql-patterns.mjs
 * Or:  npm run lint:sql
 */
import fs from 'node:fs';
import path from 'node:path';

const SCAN_TARGETS = process.argv.slice(2);
const SRC_DIR = 'src';
const ISSUES = [];

const TENANT_TABLES = new Set([
  'articles', 'leads', 'projects', 'pages', 'page_sections',
  'media', 'site_config', 'users', 'audit_log',
  'project_milestones', 'project_gallery',
]);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'node_modules') continue;
    if (entry.name === '__lint_fixtures__' && SCAN_TARGETS.length === 0) continue;
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) checkFile(full);
  }
}

function scan(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) walk(target);
  else if (target.endsWith('.js') || target.endsWith('.mjs')) checkFile(target);
}

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // RULE 1: SQL double-quote string literal
  // Match: `= "literal"` inside db.prepare/exec strings
  // Heuristic: line contains both `db.prepare` (or in continuation) AND `= "word"`
  let inSqlBlock = false;
  let sqlBlockStart = -1;
  
  lines.forEach((line, idx) => {
    // Detect SQL block start
    if (/db\.(prepare|exec)\(\s*[`'"]/.test(line)) {
      inSqlBlock = true;
      sqlBlockStart = idx;
    }
    
    if (inSqlBlock) {
      // Check for double-quote string literal pattern
      const match = line.match(/=\s*"([a-zA-Z_][a-zA-Z0-9_]*)"/);
      if (match && !/\/\//.test(line.slice(0, line.indexOf('"')))) {
        ISSUES.push({
          file, line: idx + 1, severity: 'ERROR',
          rule: 'sql-double-quote-string',
          message: `Use single quotes for SQL string literal: "${match[1]}" → '${match[1]}'`,
          code: line.trim().slice(0, 100),
        });
      }
      
      // Detect SQL block end
      if (/\)[,;]?\s*$/.test(line) && idx > sqlBlockStart) {
        inSqlBlock = false;
      }
    }
  });

  // RULE 2: Top-level `const STMT = { ... db.prepare ... }`
  // (case-insensitive STMT/QUERIES/STATEMENTS)
  const topLevelConstPattern = /^const\s+(STMT|QUERIES|STATEMENTS|QUERY|PREP)\s*=\s*\{/m;
  const match = content.match(topLevelConstPattern);
  if (match && /db\.prepare\(/.test(content.slice(content.indexOf(match[0])))) {
    const lineNum = content.substring(0, content.indexOf(match[0])).split('\n').length;
    ISSUES.push({
      file, line: lineNum, severity: 'ERROR',
      rule: 'top-level-db-prepare',
      message: `Top-level \`${match[1]}\` block with db.prepare() crashes on fresh DB. Use lazy init: \`let _stmt = null; function stmt() { ... }\``,
      code: match[0],
    });
  }

  // RULE 2b: Top-level direct prepared statement.
  const directPreparePattern = /^const\s+([A-Z0-9_]*STMT[A-Z0-9_]*|STMT[A-Z0-9_]*|[A-Z0-9_]+_BY_[A-Z0-9_]+)\s*=\s*db\.prepare\(/m;
  const direct = content.match(directPreparePattern);
  if (direct) {
    const lineNum = content.substring(0, content.indexOf(direct[0])).split('\n').length;
    ISSUES.push({
      file, line: lineNum, severity: 'ERROR',
      rule: 'top-level-direct-db-prepare',
      message: `Top-level \`${direct[1]}\` db.prepare() can run before migrations. Use lazy init function.`,
      code: direct[0],
    });
  }

  // RULE 2c: ANY top-level `const <name> = { ... db.prepare(...) ... }`
  // regardless of case. Catches lowercase variants that 2/2b miss.
  const lines2c = content.split('\n');
  let braceDepth = 0;
  let inTopLevelObject = false;
  let topLevelStart = -1;
  let topLevelName = null;

  for (let i = 0; i < lines2c.length; i++) {
    const line = lines2c[i];

    const startMatch = line.match(/^const\s+(\w+)\s*=\s*\{/);
    if (startMatch && braceDepth === 0) {
      inTopLevelObject = true;
      topLevelStart = i;
      topLevelName = startMatch[1];
    }

    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }

    if (inTopLevelObject && /db\.prepare\(/.test(line)) {
      ISSUES.push({
        file, line: topLevelStart + 1, severity: 'ERROR',
        rule: 'top-level-obj-db-prepare',
        message: `Top-level object \`${topLevelName}\` contains db.prepare() — will run before migrations. Use lazy init: \`let _stmt = null; function stmt() { ... }\`.`,
        code: `const ${topLevelName} = { ... db.prepare(...) ... }`,
      });
      inTopLevelObject = false;
    }

    if (inTopLevelObject && braceDepth === 0) {
      inTopLevelObject = false;
    }
  }

  // RULE 3: SELECT/UPDATE/DELETE/JOIN on tenant tables without tenant_id (ERROR).
  //
  // Tenant leak is an existential risk, so this rule is an ERROR.
  // risk and discipline-based check has known false-negative escape routes.
  //
  // Cross-tenant queries (login, system jobs) must be marked with an EXPLICIT
  // comment annotation `// @cross-tenant: <reason>` on the same line or the
  // line above the query. Hardcoded file-name special cases removed; the
  // annotation is auditable and grep-able.
  lines.forEach((line, idx) => {
    const tableMatch = line.match(/(FROM|UPDATE|DELETE\s+FROM|JOIN)\s+(\w+)/i);
    if (!tableMatch) return;
    const tableName = tableMatch[2].toLowerCase();
    if (!TENANT_TABLES.has(tableName)) return;

    // Context window: current line + next 20 lines. Multi-line SQL statements
    // (multi-line INSERT/UPDATE/SELECT with backtick template literals) are
    // common; the closing `WHERE tenant_id = ?` can be 10-15 lines below the
    // `UPDATE`/`FROM` keyword. 20 lines covers all observed statements.
    const contextLines = lines.slice(idx, Math.min(idx + 20, lines.length)).join(' ');
    if (/tenant_id/.test(contextLines)) return;

    // Explicit escape hatches (system-level tables that have no tenant column).
    const SYSTEM_TABLES = new Set(['tenants', 'auth_attempts', 'schema_migrations']);
    if (SYSTEM_TABLES.has(tableName)) return;

    // Explicit cross-tenant annotation. Must appear on the previous line
    // or the same line as the query. Two forms accepted:
    //   - `// @cross-tenant: <reason>` (JS line comment)
    //   - `-- @cross-tenant: <reason>` (SQL line comment, for inside template literals)
    // This forces every exception to be documented in source AND grep-able.
    const prevLine = idx > 0 ? lines[idx - 1] : '';
    const annotation = /(?:\/\/|--)\s*@cross-tenant:\s*\S+/;
    if (annotation.test(line) || annotation.test(prevLine)) return;

    ISSUES.push({
      file, line: idx + 1, severity: 'ERROR',
      rule: 'tenant-isolation-check',
      message:
        `Query on tenant table \`${tableName}\` without tenant_id filter. ` +
        `Every tenant-scoped query MUST include tenant_id. If this is an ` +
        `intentional cross-tenant query (e.g. login, system job), add an ` +
        `explicit annotation comment on the same or previous line: ` +
        `\`// @cross-tenant: <reason>\``,
      code: line.trim().slice(0, 120),
    });
  });
}

if (SCAN_TARGETS.length > 0) {
  SCAN_TARGETS.forEach(scan);
} else {
  walk(SRC_DIR);
}

// Report
const errors = ISSUES.filter(i => i.severity === 'ERROR');
const warnings = ISSUES.filter(i => i.severity === 'WARN');

console.log('═══ SQL Anti-pattern Lint Report ═══\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✓ No issues found.');
  process.exit(0);
}

for (const i of [...errors, ...warnings]) {
  console.log(`  ${i.severity}: ${i.file}:${i.line}`);
  console.log(`    Rule: ${i.rule}`);
  console.log(`    ${i.message}`);
  console.log(`    Code: ${i.code}`);
  console.log('');
}

console.log(`Summary: ${errors.length} ERROR, ${warnings.length} WARN`);

if (errors.length > 0) {
  console.error('\n❌ Lint failed (errors present).');
  process.exit(1);
} else {
  console.log('\n⚠️  Lint passed with warnings.');
  process.exit(0);
}
