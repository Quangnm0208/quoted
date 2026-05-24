// Full v1.4.3 regression suite — module imports + API surface + pure-function tests.
// Portable: paths are relative to this file's location.

import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');

const results = { pass: [], fail: [] };
function record(name, ok, detail) {
  (ok ? results.pass : results.fail).push({ name, detail });
}

console.log('=== REGRESSION TEST — v1.4.3 codebase ===\n');

// 1. Every patched module imports cleanly
const modules = [
  'backend/modules/indexing/indexing.repository.js',
  'backend/modules/indexing/indexing.service.js',
  'backend/modules/indexing/indexing.controller.js',
  'backend/modules/indexing/indexing.subscriber.js',
  'backend/modules/error_log/error_log.repository.js',
  'backend/modules/error_log/error_log.controller.js',
  'backend/modules/redirections/redirections.cache.js',
  'backend/modules/seo-validator/seo-validator.service.js',
  'backend/modules/seo-validator/seo-validator.rules.js',
  'backend/modules/articles/articles.repository.js',
  'backend/modules/articles/articles.schema.js',
  'backend/modules/projects/projects.repository.js',
  'backend/modules/projects/gallery.repository.js',
  'backend/modules/projects/milestones.repository.js',
  'backend/modules/leads/leads.repository.js',
];

console.log('--- Phase 1: module import smoke test ---');
for (const rel of modules) {
  const fullPath = path.join(SRC, rel);
  try {
    await import(fullPath);
    record(`import ${rel}`, true);
    console.log(`  ✓ ${rel}`);
  } catch (err) {
    record(`import ${rel}`, false, err.message);
    console.log(`  ✗ ${rel} — ${err.message.split('\n')[0].slice(0, 80)}`);
  }
}

// 2. Verify v1.4.2/v1.4.3 specific exports still present
console.log('\n--- Phase 2: API surface check (no removed exports) ---');
const surfaceCheck = [
  ['backend/modules/indexing/indexing.repository.js', ['indexingRepository', 'tryInsertLog', 'insertLog', 'updateLogResult', 'listRecent', 'recentSubmissionExists', 'getKey', 'setKey', 'isEnabled', 'prune']],
  ['backend/modules/indexing/indexing.service.js', ['submit']],
  ['backend/modules/error_log/error_log.repository.js', ['errorLogRepository', 'batchUpsert', 'listForAdmin', 'setIgnored', 'prune']],
  ['backend/modules/error_log/error_log.controller.js', ['logMiddleware', 'startFlushTimer', 'stopFlushTimer', 'adminRouter']],
  ['backend/modules/redirections/redirections.cache.js', ['load', 'lookup', 'invalidate', 'normalizePath']],
  ['backend/modules/seo-validator/seo-validator.service.js', ['scoreArticle', 'scoreProject', 'enforcePublish', 'seoValidatorService']],
  ['backend/modules/articles/articles.repository.js', ['articlesRepository']],
  ['backend/modules/articles/articles.schema.js', ['articleInputSchema', 'articleListQuerySchema', 'articleIdParamSchema', 'CONTENT_HTML_MAX_BYTES']],
  ['backend/modules/projects/projects.repository.js', ['projectsRepository']],
  ['backend/modules/projects/gallery.repository.js', ['galleryRepository']],
  ['backend/modules/projects/milestones.repository.js', ['milestonesRepository']],
  ['backend/modules/leads/leads.repository.js', ['leadsRepository']],
];

for (const [rel, expectedExports] of surfaceCheck) {
  const fullPath = path.join(SRC, rel);
  try {
    const mod = await import(fullPath);
    const missing = [];
    for (const exp of expectedExports) {
      if (exp === 'tryInsertLog' || exp === 'CONTENT_HTML_MAX_BYTES') {
        if (!(exp in mod) && !(mod.indexingRepository && mod.indexingRepository[exp])) {
          missing.push(exp + ' (NEW)');
        }
      } else if (exp.endsWith('Repository') || exp.endsWith('Service')) {
        if (!(exp in mod)) missing.push(exp);
      } else {
        const inModule = exp in mod;
        const inNamespace = Object.values(mod).some(v => v && typeof v === 'object' && exp in v);
        if (!inModule && !inNamespace) missing.push(exp);
      }
    }
    if (missing.length === 0) {
      record(`exports ${rel}`, true);
      console.log(`  ✓ ${rel} — all ${expectedExports.length} expected exports present`);
    } else {
      record(`exports ${rel}`, false, 'missing: ' + missing.join(', '));
      console.log(`  ✗ ${rel} — missing: ${missing.join(', ')}`);
    }
  } catch (err) {
    record(`exports ${rel}`, false, err.message);
    console.log(`  ✗ ${rel} — ${err.message.split('\n')[0].slice(0, 80)}`);
  }
}

// 3. Pure-function tests
console.log('\n--- Phase 3: pure-function regression tests ---');

try {
  const rules = await import(path.join(SRC, 'backend/modules/seo-validator/seo-validator.rules.js'));

  {
    const t = rules.htmlToText('<p>Hello <b>world</b></p>');
    const ok = t.includes('Hello') && t.includes('world');
    record('htmlToText basic', ok);
    console.log(`  ${ok ? '✓' : '✗'} htmlToText extracts text: "${t.slice(0, 40)}"`);
  }
  {
    const w = rules.countWords('one two three four five');
    record('countWords 5', w === 5);
    console.log(`  ${w === 5 ? '✓' : '✗'} countWords: ${w} (expected 5)`);
  }
  {
    const start = performance.now();
    const dom = rules.parseDom('<h2>Test</h2><p>Hello <img src="/x" alt="a"/></p>');
    const ms = performance.now() - start;
    const ok = dom && ms < 1000;
    record('parseDom normal', ok);
    console.log(`  ${ok ? '✓' : '✗'} parseDom normal: ${ms.toFixed(0)}ms`);
  }
  {
    const html = '<h2>Title</h2>' + '<p>nội dung bài viết với từ khoá quan trọng.</p>'.repeat(50);
    const entity = {
      slug: 'test-article',
      title: 'Test Article',
      seo_title: 'Test Article về từ khoá',
      seo_description: 'Mô tả bài viết test có chứa từ khoá đầy đủ để pass description rule',
      focus_keyword: 'từ khoá',
      content_html: html,
      robots_directive: 'index,follow',
      cover_media_id: 1,
    };
    const opts = {
      images: [{ alt: 'a', byte_size: 100000 }, { alt: 'b', byte_size: 200000 }, { alt: 'c', byte_size: 150000 }],
      tenant: { display_name: 'X', domain: 'x.vn' },
      internalLinkCount: 3,
      contentText: rules.htmlToText(html),
      contentDom: rules.parseDom(html),
      ogImageResolved: { ok: true, url: '/x.webp' },
    };
    const result = rules.runRules(entity, opts);
    const ok = result && typeof result.score === 'number' && Array.isArray(result.blockers) && Array.isArray(result.warnings) && Array.isArray(result.passed);
    record('runRules shape', ok);
    console.log(`  ${ok ? '✓' : '✗'} runRules returns {score:${result.score}, blockers:${result.blockers.length}, warnings:${result.warnings.length}, passed:${result.passed.length}}`);
  }
} catch (err) {
  console.log(`  ✗ rules module — ${err.message}`);
  record('seo-validator rules', false, err.message);
}

try {
  const { articleInputSchema, CONTENT_HTML_MAX_BYTES } = await import(path.join(SRC, 'backend/modules/articles/articles.schema.js'));
  const cap = CONTENT_HTML_MAX_BYTES;
  const ok1 = cap === 200_000;
  record('CONTENT_HTML_MAX_BYTES', ok1);
  console.log(`  ${ok1 ? '✓' : '✗'} CONTENT_HTML_MAX_BYTES = ${cap}`);

  const r1 = articleInputSchema.safeParse({ content_html: 'a'.repeat(cap + 1) });
  record('schema rejects oversize', !r1.success);
  console.log(`  ${!r1.success ? '✓' : '✗'} schema rejects content_html > ${cap} bytes`);

  const r2 = articleInputSchema.safeParse({ title: 'OK', content_html: '<p>Hello</p>' });
  record('schema accepts normal', r2.success);
  console.log(`  ${r2.success ? '✓' : '✗'} schema accepts normal article`);

  const r3 = articleInputSchema.safeParse({ title: 'OK' });
  record('schema accepts no content_html', r3.success);
  console.log(`  ${r3.success ? '✓' : '✗'} schema accepts missing content_html (back-compat)`);
} catch (err) {
  console.log(`  ✗ schema module — ${err.message}`);
  record('schema module', false, err.message);
}

try {
  const cache = await import(path.join(SRC, 'backend/modules/redirections/redirections.cache.js'));
  const normalizePath = cache._internals?.normalizePath;
  if (!normalizePath) throw new Error('_internals.normalizePath not exported');
  const tests = [
    ['/Articles/Test/',  '/articles/test'],
    ['/foo//bar',        '/foo/bar'],
    ['/page#x',          '/page'],
    ['/null\u0000bypass', ''],
    ['',                 '/'],
    ['/',                '/'],
  ];
  let allOk = true;
  for (const [input, expected] of tests) {
    const got = normalizePath(input);
    if (got !== expected) { console.log(`  ✗ normalizePath(${JSON.stringify(input)}) → "${got}", expected "${expected}"`); allOk = false; }
  }
  if (allOk) console.log(`  ✓ normalizePath: 6/6 cases including v1.4.3 hardening`);
  record('normalizePath hardening', allOk);
} catch (err) {
  console.log(`  ✗ redirections cache — ${err.message}`);
  record('redirections cache', false, err.message);
}

console.log(`\n=== SUMMARY ===`);
console.log(`Pass: ${results.pass.length}`);
console.log(`Fail: ${results.fail.length}`);
if (results.fail.length > 0) {
  console.log('\nFailures:');
  for (const f of results.fail) console.log(`  • ${f.name}: ${f.detail || ''}`);
  process.exit(1);
}
