/**
 * seo/seo.subscriber.js — Cache invalidation via event bus.
 *
 * When content changes, invalidate the SEO cache for that tenant so the next
 * request regenerates with fresh data. Without this, a freshly published
 * article wouldn't appear in sitemap.xml for up to 60 seconds (the TTL).
 *
 * Event topics registered here mirror what the existing audit subscriber
 * uses, so the contracts stay consistent. If a service emits a topic that is
 * not listed in the typed bus, eventBus.emit() throws — that is the design.
 *
 * Failure mode: subscriber handlers must not throw. Cache invalidation is
 * advisory; if it fails the TTL still saves us within 60s.
 */

import { eventBus } from '../../../core/lib/eventBus.js';
import { seoCache } from './seo.cache.js';

const TOPICS = [
  'article.created',
  'article.updated',
  'article.published',
  'article.unpublished',
  'article.deleted',
  'project.created',
  'project.updated',
  'project.deleted',
  'page.section.updated',
  'site.config.updated',
];

function safeInvalidate(payload) {
  try {
    if (payload && typeof payload.tenant_id === 'number') {
      seoCache.invalidateTenant(payload.tenant_id);
    }
  } catch (err) {
    console.warn('[seo.subscriber] invalidate failed:', err.message);
  }
}

export function registerSeoSubscriber() {
  for (const topic of TOPICS) {
    try {
      eventBus.registerTopic(topic);
    } catch {
      // Already registered by another subscriber — fine.
    }
    eventBus.on(topic, safeInvalidate);
  }
}
