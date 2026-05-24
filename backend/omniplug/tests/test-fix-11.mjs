// Verify Fix #7 (BUG #11): path traversal in 404 log middleware
// Extract the relevant logic and test directly.

function shouldReject(path) {
  return path.includes('\u0000') || /(?:^|\/)\.\.(?:\/|$)/.test(path);
}

const cases = [
  // Should reject
  ['/../../etc/passwd',       true],
  ['/../etc/passwd',          true],
  ['/foo/../bar',             true],
  ['/foo/../../bar',          true],
  ['/foo/..',                 true],
  ['/..',                     true],
  ['/article\u0000bypass',    true],
  ['/\u0000',                 true],

  // Should pass through (no traversal)
  ['/articles/normal',        false],
  ['/articles/foo..bar',      false],  // .. inside slug, not segment
  ['/articles/..foo',         false],  // .. at start of slug
  ['/articles/bar..',         false],  // .. at end of slug
  ['/articles/version-3.4.2', false],  // dots in path are fine
  ['/articles/my-post',       false],
  ['/',                       false],
  ['/dấu-tiếng-việt',         false],
];

console.log('=== TEST: BUG #11 fix (URI sanitization) ===\n');
let pass = 0, fail = 0;
for (const [input, expectReject] of cases) {
  const rejected = shouldReject(input);
  const ok = rejected === expectReject;
  console.log(`  ${ok ? '✓' : '✗'} ${JSON.stringify(input).padEnd(40)} → ${rejected ? 'REJECT' : 'ACCEPT'}${ok ? '' : ` (expected ${expectReject ? 'REJECT' : 'ACCEPT'})`}`);
  if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${pass+fail} cases pass`);
process.exit(fail > 0 ? 1 : 0);
