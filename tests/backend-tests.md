# Backend — Test Plan

Follows OmniPlug v1.4.4's `tests/` convention. Add these to your existing
backend test suite. Format: ES module test files, plain Node.js (no Jest).

---

## File layout

```
tests/
  quoted-test-wp-sites.mjs       — register + sync flow
  quoted-test-bot-crawls.mjs     — batch ingestion
  quoted-test-llms-content.mjs   — sitemap + markdown
  quoted-test-e2e.mjs            — full integration
```

---

## T-BE-1 — wp-sites register

```js
import { test } from 'node:test';
import assert from 'node:assert';

test('register: happy path', async () => {
  const res = await fetch(`${BASE}/api/v1/wp-sites/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: VALID_TEST_KEY,
      domain: 'test.local',
      wp_version: '6.5.2',
      plugin_version: '0.1.0',
      admin_email: 'test@test.local',
    }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.ok(body.jwt);
  assert.ok(body.tenant_id);
  assert.strictEqual(body.plan, 'free');
});

test('register: invalid format → 400', async () => {
  const res = await fetch(`${BASE}/api/v1/wp-sites/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: 'bad', domain: 'test.local' }),
  });
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error.code, 'INVALID_LICENSE_FORMAT');
});

test('register: domain mismatch → 403', async () => {
  const res = await fetch(`${BASE}/api/v1/wp-sites/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: VALID_TEST_KEY,           // issued for test.local
      domain: 'attacker.com',
    }),
  });
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.error.code, 'DOMAIN_MISMATCH');
});

test('register: re-register same domain returns same tenant', async () => {
  // First call
  const r1 = await register(VALID_TEST_KEY, 'test.local');
  // Second call
  const r2 = await register(VALID_TEST_KEY, 'test.local');
  assert.strictEqual(r1.tenant_id, r2.tenant_id);
  assert.notStrictEqual(r1.jwt, r2.jwt); // new JWT each time
});
```

## T-BE-2 — bot crawls batch ingestion

```js
test('batch: 100 events accepted', async () => {
  const events = Array.from({ length: 100 }, (_, i) => ({
    bot_name: 'ClaudeBot',
    url_path: `/post-${i}`,
    user_agent: 'Mozilla/5.0 (compatible; ClaudeBot/1.0)',
    ip_hash: 'sha256:' + '0'.repeat(64),
    crawled_at: new Date(Date.now() - i * 60000).toISOString(),
  }));

  const res = await authedFetch('POST', '/api/v1/bot-crawls/batch', {
    batch_id: 'test_001',
    events,
  });

  assert.strictEqual(res.status, 202);
  const body = await res.json();
  assert.strictEqual(body.accepted, 100);
  assert.strictEqual(body.deduped, 0);
});

test('batch: same minute = deduped', async () => {
  const sameMinute = new Date('2026-05-23T10:00:00Z').toISOString();
  const events = Array.from({ length: 5 }, () => ({
    bot_name: 'GPTBot',
    url_path: '/same-page',
    user_agent: 'GPTBot',
    ip_hash: 'sha256:' + '0'.repeat(64),
    crawled_at: sameMinute,
  }));

  const res = await authedFetch('POST', '/api/v1/bot-crawls/batch', { events });
  const body = await res.json();
  assert.strictEqual(body.accepted, 1);
  assert.strictEqual(body.deduped, 4);
});

test('batch: unknown bot → rejected validation', async () => {
  const res = await authedFetch('POST', '/api/v1/bot-crawls/batch', {
    events: [{ bot_name: 'EvilBot', url_path: '/', ip_hash: 'sha256:0', crawled_at: new Date().toISOString() }],
  });
  assert.strictEqual(res.status, 400);
});

test('batch: future timestamp → filtered out', async () => {
  const future = new Date(Date.now() + 86400_000).toISOString();
  const res = await authedFetch('POST', '/api/v1/bot-crawls/batch', {
    events: [{
      bot_name: 'ClaudeBot',
      url_path: '/',
      user_agent: 'CB',
      ip_hash: 'sha256:' + '0'.repeat(64),
      crawled_at: future,
    }],
  });
  // Either 400 (no valid events) or 202 with accepted=0
  assert.ok([400, 202].includes(res.status));
});
```

## T-BE-3 — llms.txt + markdown

```js
test('sitemap: returns markdown', async () => {
  const res = await fetch(`${BASE}/api/public/llm/sitemap.txt`, {
    headers: { Host: 'test.local' },
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/markdown'));
  const body = await res.text();
  assert.ok(body.startsWith('#'));
});

test('sitemap: unknown host → 404', async () => {
  const res = await fetch(`${BASE}/api/public/llm/sitemap.txt`, {
    headers: { Host: 'unregistered.com' },
  });
  assert.strictEqual(res.status, 404);
});

test('post markdown: returns clean MD', async () => {
  // Assumes 'sample-post' was synced earlier in test
  const res = await fetch(`${BASE}/api/public/llm/posts/sample-post.md`, {
    headers: { Host: 'test.local' },
  });
  assert.strictEqual(res.status, 200);
  const body = await res.text();
  assert.match(body, /^# /);            // starts with h1
  assert.doesNotMatch(body, /<[a-z]+/); // no HTML tags
});

test('post markdown: 404 for unknown slug', async () => {
  const res = await fetch(`${BASE}/api/public/llm/posts/nope.md`, {
    headers: { Host: 'test.local' },
  });
  assert.strictEqual(res.status, 404);
});
```

## T-BE-4 — End-to-end flow

```js
test('e2e: register → sync posts → ingest crawls → dashboard reflects', async () => {
  // 1. Register
  const reg = await register(VALID_TEST_KEY, 'e2e.local');
  const jwt = reg.jwt;

  // 2. Sync 5 posts
  const syncRes = await authedFetch('POST', '/api/v1/wp-sites/posts/sync', {
    posts: Array.from({ length: 5 }, (_, i) => mockPost(i)),
  }, jwt);
  const syncBody = await syncRes.json();
  assert.strictEqual(syncBody.synced, 5);

  // 3. Ingest crawls
  const crawlRes = await authedFetch('POST', '/api/v1/bot-crawls/batch', {
    events: [
      mockCrawl('ClaudeBot', '/post-0'),
      mockCrawl('GPTBot', '/post-1'),
      mockCrawl('PerplexityBot', '/post-2'),
    ],
  }, jwt);
  const crawlBody = await crawlRes.json();
  assert.strictEqual(crawlBody.accepted, 3);

  // 4. Dashboard summary
  const dash = await authedFetch('GET', '/api/v1/wp-sites/dashboard/summary', null, jwt);
  const dashBody = await dash.json();
  assert.strictEqual(dashBody.bot_activity.total_crawls_7d, 3);
  assert.strictEqual(dashBody.bot_activity.unique_bots_7d, 3);
  assert.strictEqual(dashBody.posts.synced, 5);
  assert.ok(dashBody.ai_distribution_score > 0);

  // 5. llms.txt has 5 articles
  const llms = await fetch(`${BASE}/api/public/llm/sitemap.txt`, {
    headers: { Host: 'e2e.local' },
  });
  const llmsBody = await llms.text();
  for (let i = 0; i < 5; i++) {
    assert.ok(llmsBody.includes(`post-${i}`));
  }
});
```

## T-BE-5 — Migrations idempotent

```js
test('migrations: running twice does not error', async () => {
  // Run migration runner twice in succession
  await runMigrations();
  await runMigrations();
  // No throw = pass
});
```

---

## Run

```bash
cd /path/to/omniplug-cms-core
node --test tests/quoted-test-*.mjs
```

Acceptance: All tests green on staging.

---

## Test data prerequisites

```bash
# Issue a valid test license for test.local
node scripts/op-license-sign.js \
  --email test@test.local \
  --domain test.local \
  --plan free \
  --days 365 \
  --product quoted

# Export the key as VALID_TEST_KEY
export VALID_TEST_KEY="qtd_test_..."

# Similarly for e2e.local
node scripts/op-license-sign.js \
  --email e2e@e2e.local \
  --domain e2e.local \
  --plan free \
  --days 365 \
  --product quoted

export VALID_TEST_KEY_E2E="qtd_test_..."
```
