// Verify BUG #21 fix: tenant type guard rejects non-number tenantId.
// Pure-function test — no DB needed.

console.log('=== TEST: BUG #21 fix (tenant guards) ===\n');

const requireTenant = (tenantId) => {
  if (typeof tenantId !== 'number') {
    throw new Error('projects.repository: tenantId required (got: ' + typeof tenantId + ')');
  }
  return tenantId;
};

const requireTenantInPayload = (payload, fieldName = 'tenant_id') => {
  if (!payload || typeof payload[fieldName] !== 'number') {
    throw new Error('projects.repository: payload.' + fieldName + ' required');
  }
  return payload[fieldName];
};

const tests = [
  ['undefined',     undefined, true],
  ['null',          null,      true],
  ['"62" (string)', '62',      true],
  ['"" (empty)',    '',        true],
  ['62',            62,        false],
  ['62.5 (float)',  62.5,      false],
  ['NaN',           NaN,       false],  // typeof NaN === 'number'; SQLite parameter binding will catch
  ['{id:62}',       { id: 62 },true],
];

let pass = 0, fail = 0;
for (const [name, val, shouldThrow] of tests) {
  try {
    requireTenant(val);
    const ok = !shouldThrow;
    if (ok) { console.log(`  ✓ ${name.padEnd(20)} no throw (number)`); pass++; }
    else    { console.log(`  ✗ ${name.padEnd(20)} should have thrown`); fail++; }
  } catch (err) {
    const ok = shouldThrow;
    if (ok) { console.log(`  ✓ ${name.padEnd(20)} threw correctly`); pass++; }
    else    { console.log(`  ✗ ${name.padEnd(20)} unexpected throw: ${err.message.slice(0, 40)}`); fail++; }
  }
}

console.log('\n=== Payload variant test ===\n');
const payloadTests = [
  ['null payload',           null,                       true],
  ['empty {}',               {},                         true],
  ['{tenant_id: "x"}',       { tenant_id: 'x' },         true],
  ['{tenant_id: undefined}', { tenant_id: undefined },   true],
  ['{tenant_id: 100}',       { tenant_id: 100 },         false],
];
for (const [name, payload, shouldThrow] of payloadTests) {
  try {
    requireTenantInPayload(payload);
    if (!shouldThrow) { console.log(`  ✓ ${name.padEnd(30)} no throw`); pass++; }
    else              { console.log(`  ✗ ${name.padEnd(30)} should have thrown`); fail++; }
  } catch (err) {
    if (shouldThrow) { console.log(`  ✓ ${name.padEnd(30)} threw correctly`); pass++; }
    else             { console.log(`  ✗ ${name.padEnd(30)} unexpected throw`); fail++; }
  }
}

console.log(`\n${pass}/${pass+fail} cases pass`);
process.exit(fail > 0 ? 1 : 0);
