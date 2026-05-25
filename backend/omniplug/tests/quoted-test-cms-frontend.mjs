/**
 * T-CMS-FE-1..4 — CMS-driven marketing site (milestone 1: hero).
 *
 * Verifies the page_sections seed for page_key "quoted_home" is reachable
 * via the public API and exposes the fields the hydration helper expects.
 *
 * Runs against the live backend on BASE (default http://127.0.0.1:4000).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:4000';

async function get(path) {
  const res = await fetch(BASE + path);
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

test('T-CMS-FE-1: GET /api/public/pages/quoted_home returns sections array', async () => {
  const { status, body } = await get('/api/public/pages/quoted_home');
  assert.equal(status, 200, `expected 200, got ${status}`);
  assert.equal(body && body.page, 'quoted_home');
  assert.ok(Array.isArray(body.sections), 'sections must be an array');
  assert.ok(body.sections.length >= 1, 'expected at least the hero section from migration 037');
});

test('T-CMS-FE-2: hero section exposes the contract the hydration helper consumes', async () => {
  const { body } = await get('/api/public/pages/quoted_home');
  const hero = (body.sections || []).find(s => s.key === 'hero');
  assert.ok(hero, 'hero section missing — migration 037 not applied?');
  assert.equal(hero.type, 'hero_banner');
  assert.ok(typeof hero.subtitle === 'string' && hero.subtitle.length > 0, 'hero.subtitle required');
  assert.ok(hero.payload && typeof hero.payload === 'object', 'hero.payload required');
  assert.ok(typeof hero.payload.eyebrow === 'string', 'hero.payload.eyebrow required');
  assert.ok(typeof hero.payload.cta_primary_label === 'string', 'hero.payload.cta_primary_label required');
  assert.ok(typeof hero.payload.cta_primary_url === 'string', 'hero.payload.cta_primary_url required');
  assert.ok(typeof hero.payload.cta_secondary_label === 'string', 'hero.payload.cta_secondary_label required');
  assert.ok(typeof hero.payload.cta_secondary_url === 'string', 'hero.payload.cta_secondary_url required');
});

test('T-CMS-FE-3: response carries cache header so edge can serve marketing traffic', async () => {
  const { headers } = await get('/api/public/pages/quoted_home');
  const cc = headers.get('cache-control') || '';
  assert.ok(cc.includes('max-age'), `Cache-Control max-age expected, got: ${cc}`);
});

test('T-CMS-FE-4: unknown page_key returns empty sections, not 500', async () => {
  const { status, body } = await get('/api/public/pages/does_not_exist_zzz');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.sections));
  assert.equal(body.sections.length, 0);
});
