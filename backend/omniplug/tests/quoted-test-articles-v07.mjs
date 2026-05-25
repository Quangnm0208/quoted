/**
 * T-ART-1..12 — Articles v0.7.0 SEO + workflow tests.
 *
 * Live integration tests against the running backend on $BASE.
 * Logs in as admin to create + manage articles, then checks public
 * visibility rules.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:4000';

let adminToken = null;
let testArticleId = null;
const TEST_SLUG = 'v07-test-article-' + Date.now();

async function login() {
  if (adminToken) return adminToken;
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@omniplug.local', password: 'ChangeMe123!' }),
  });
  const body = await res.json();
  adminToken = body.token;
  return adminToken;
}

async function adminPost(path, body) {
  const token = await login();
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function adminGet(path) {
  const token = await login();
  const res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function adminDelete(path) {
  const token = await login();
  const res = await fetch(BASE + path, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  });
  return { status: res.status };
}

async function publicGet(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('T-ART-1: create draft article with full SEO fields', async () => {
  const { status, body } = await adminPost('/api/admin/articles', {
    title: 'v0.7.0 Test Article',
    slug: TEST_SLUG,
    excerpt: 'Test excerpt',
    content_html: '<p>Test body</p>',
    seo_title: 'SEO title test',
    seo_description: 'SEO desc test',
    canonical_url: 'https://example.com/blog/' + TEST_SLUG,
    og_title: 'OG title test',
    og_description: 'OG desc test',
    schema_type: 'BlogPosting',
    content_type: 'article',
    robots_index: true,
    robots_follow: true,
  });
  assert.equal(status, 201, `expected 201, got ${status}: ${JSON.stringify(body)}`);
  assert.ok(body.id, 'article id required');
  testArticleId = body.id;
  assert.equal(body.status, 'draft');
  assert.equal(body.seo_title, 'SEO title test');
  assert.equal(body.canonical_url, 'https://example.com/blog/' + TEST_SLUG);
  assert.equal(body.schema_type, 'BlogPosting');
  assert.equal(body.content_type, 'article');
  assert.equal(body.robots_index, 1);
});

test('T-ART-2: public list excludes draft', async () => {
  const { body } = await publicGet('/api/public/articles');
  const found = (body.rows || []).find(a => a.slug === TEST_SLUG);
  assert.equal(found, undefined, 'draft article must not appear in public list');
});

test('T-ART-3: public slug returns 404 for draft', async () => {
  const { status } = await publicGet('/api/public/articles/' + TEST_SLUG);
  assert.equal(status, 404);
});

test('T-ART-4: schedule with past date is rejected', async () => {
  const { status, body } = await adminPost(`/api/admin/articles/${testArticleId}/schedule`, {
    scheduled_at: '2020-01-01T00:00:00Z',
  });
  assert.equal(status, 400);
  assert.match(body.error.message || '', /future/i);
});

test('T-ART-5: schedule with future date succeeds', async () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const { status, body } = await adminPost(`/api/admin/articles/${testArticleId}/schedule`, {
    scheduled_at: future,
  });
  assert.equal(status, 200);
  assert.equal(body.status, 'scheduled');
  assert.ok(body.scheduled_at);
});

test('T-ART-6: scheduled-future article NOT visible publicly', async () => {
  const { body } = await publicGet('/api/public/articles');
  const found = (body.rows || []).find(a => a.slug === TEST_SLUG);
  assert.equal(found, undefined, 'scheduled-future must not appear publicly');
});

test('T-ART-7: publish makes article public', async () => {
  const { status } = await adminPost(`/api/admin/articles/${testArticleId}/publish`, {});
  assert.equal(status, 200);
  const { body } = await publicGet('/api/public/articles');
  const found = (body.rows || []).find(a => a.slug === TEST_SLUG);
  assert.ok(found, 'published article must appear in public list');
  assert.equal(found.status, 'published');
});

test('T-ART-8: public slug returns full article including SEO fields', async () => {
  const { status, body } = await publicGet('/api/public/articles/' + TEST_SLUG);
  assert.equal(status, 200);
  assert.equal(body.slug, TEST_SLUG);
  assert.equal(body.schema_type, 'BlogPosting');
  assert.equal(body.canonical_url, 'https://example.com/blog/' + TEST_SLUG);
  assert.equal(body.og_title, 'OG title test');
});

test('T-ART-9: unpublish reverts to draft and removes from public', async () => {
  const { status, body } = await adminPost(`/api/admin/articles/${testArticleId}/unpublish`, {});
  assert.equal(status, 200);
  assert.equal(body.status, 'draft');
  const pub = await publicGet('/api/public/articles');
  const found = (pub.body.rows || []).find(a => a.slug === TEST_SLUG);
  assert.equal(found, undefined, 'unpublished must not appear publicly');
});

test('T-ART-10: archive sets archived_at and excludes from public', async () => {
  const { status, body } = await adminPost(`/api/admin/articles/${testArticleId}/archive`, {});
  assert.equal(status, 200);
  assert.equal(body.status, 'archived');
  assert.ok(body.archived_at);
  const pub = await publicGet('/api/public/articles');
  const found = (pub.body.rows || []).find(a => a.slug === TEST_SLUG);
  assert.equal(found, undefined);
});

test('T-ART-11: slug collision blocked', async () => {
  const { status, body } = await adminPost('/api/admin/articles', {
    title: 'Duplicate slug attempt',
    slug: TEST_SLUG,  // same slug as T-ART-1
    content_html: '<p>x</p>',
  });
  // Server auto-resolves to unique slug (-2 suffix) — should succeed with different slug, not error
  assert.equal(status, 201);
  assert.notEqual(body.slug, TEST_SLUG, 'slug must be auto-resolved to unique');
  // Cleanup
  await adminDelete('/api/admin/articles/' + body.id);
});

test('T-ART-12: cleanup test article', async () => {
  const { status } = await adminDelete('/api/admin/articles/' + testArticleId);
  assert.equal(status, 200);
});
