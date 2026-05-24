/**
 * indexing/indexing.subscriber.js — Auto-submit on content publish.
 *
 * Hooks into the event bus topics emitted by articles/projects/pages.
 * When content goes to published status, we automatically submit the
 * URL to IndexNow.
 *
 * Critical: This subscriber must be NON-BLOCKING. The article controller
 * emits the event synchronously inside the response cycle; if we awaited
 * the IndexNow network call here, every publish would be delayed by up
 * to REQUEST_TIMEOUT_MS (5 seconds).
 *
 * The pattern: schedule the submission with setImmediate so it runs on
 * the next tick of the event loop, after the HTTP response has been
 * sent. The response returns fast; submission happens out of band.
 *
 * Failure mode: if the submission errors out, it is logged but does not
 * affect any application state. The next content edit will re-trigger
 * naturally.
 */

import { eventBus } from '../../../core/lib/eventBus.js';
import { tenancy } from '../../../core/lib/tenancy.js';
import { indexingService } from './indexing.service.js';

// Topics that mean "a public URL has appeared or changed".
// We do NOT subscribe to 'created' or 'updated' alone — drafts should
// not be submitted. The article/project services emit a separate
// '.published' event when status transitions to published.
const PUBLISH_TOPICS = [
  'article.published',
  'project.created',     // projects do not have draft status; created == live
  'project.updated',
  'page.section.updated', // a page is "live" once any section is visible
];

function makeUrl(tenant, payload) {
  if (!tenant || !tenant.domain) return null;
  const base = 'https://' + tenant.domain;
  if (payload.entity_type === 'article' && payload.slug) {
    return base + '/articles/' + payload.slug;
  }
  if (payload.entity_type === 'project' && payload.slug) {
    return base + '/projects/' + payload.slug;
  }
  if (payload.entity_type === 'page' && payload.page_key) {
    return base + '/' + payload.page_key;
  }
  // Fallback: if the payload contains an explicit URL, use it.
  if (payload.url && payload.url.startsWith('https://')) return payload.url;
  return null;
}

async function handle(payload) {
  try {
    if (!payload || typeof payload.tenant_id !== 'number') return;
    const tenant = tenancy.byId(payload.tenant_id);
    if (!tenant || !tenant.domain || tenant.status !== 'active') return;

    const url = makeUrl(tenant, payload);
    if (!url) return;

    // Fire and forget. The service handles its own logging/throttling.
    setImmediate(() => {
      indexingService.submit({
        tenantId: tenant.id,
        host: tenant.domain,
        urls: [url],
        manual: false,
      }).catch((err) => {
        console.warn('[indexing.subscriber] submit failed:', err && err.message);
      });
    });
  } catch (err) {
    // Subscriber handlers must never throw — that would break the event bus
    // for other subscribers (audit, seo cache, etc.).
    console.warn('[indexing.subscriber] handle error:', err && err.message);
  }
}

export function registerIndexingSubscriber() {
  for (const topic of PUBLISH_TOPICS) {
    try {
      eventBus.registerTopic(topic);
    } catch {
      // Topic already registered by another module — fine.
    }
    eventBus.on(topic, handle);
  }
}
