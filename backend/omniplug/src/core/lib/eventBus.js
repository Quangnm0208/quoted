/**
 * core/lib/eventBus.js - typed in-process event bus.
 *
 * The OmniPlug CMS Core uses this bus for local side effects such as audit
 * logging without introducing a queue, worker or paid service. Services emit
 * events; subscribers register at boot. Business logic does not need to know
 * who listens.
 *
 * Design choices:
 *   1. Typed topics: every topic must be registered before emit.
 *   2. Synchronous execution: emit returns after local handlers have run.
 *   3. Subscriber isolation: one failed subscriber is logged and does not
 *      prevent other subscribers from running.
 *   4. No external dependencies: stdlib EventEmitter is enough for the core.
 */

import { EventEmitter } from 'node:events';

class TypedEventBus {
  #emitter = new EventEmitter();
  #knownTopics = new Set();

  constructor() {
    // Subscribers are added at module load, not at request time.
    this.#emitter.setMaxListeners(0);
  }

  registerTopic(topic) {
    if (typeof topic !== 'string' || !topic.includes('.')) {
      throw new Error(
        `eventBus.registerTopic: topic must be a dotted string ` +
        `(e.g. "project.created"), got "${topic}"`
      );
    }
    this.#knownTopics.add(topic);
  }

  emit(topic, payload) {
    if (!this.#knownTopics.has(topic)) {
      throw new Error(
        `eventBus.emit: unknown topic "${topic}". ` +
        `Register it via eventBus.registerTopic("${topic}") at app boot.`
      );
    }

    const listeners = this.#emitter.listeners(topic);
    for (const handler of listeners) {
      try {
        // Allow async handlers, but do not await; the emitter stays sync.
        const ret = handler(payload);
        if (ret && typeof ret.catch === 'function') {
          ret.catch((err) => {
            console.error(`[eventBus] async subscriber for "${topic}" rejected:`, err);
          });
        }
      } catch (err) {
        console.error(`[eventBus] subscriber for "${topic}" threw:`, err);
      }
    }
  }

  on(topic, handler) {
    if (!this.#knownTopics.has(topic)) {
      throw new Error(
        `eventBus.on: unknown topic "${topic}". Register before subscribing.`
      );
    }
    this.#emitter.on(topic, handler);
    return () => this.#emitter.off(topic, handler);
  }

  listTopics() {
    return Array.from(this.#knownTopics).sort();
  }

  clearSubscribers() {
    this.#emitter.removeAllListeners();
  }
}

export const eventBus = new TypedEventBus();

// Project lifecycle
eventBus.registerTopic('project.created');
eventBus.registerTopic('project.updated');
eventBus.registerTopic('project.softDeleted');
eventBus.registerTopic('project.restored');
eventBus.registerTopic('project.statusChanged');

// Article lifecycle
eventBus.registerTopic('article.created');
eventBus.registerTopic('article.updated');
eventBus.registerTopic('article.softDeleted');
eventBus.registerTopic('article.published');
eventBus.registerTopic('article.unpublished');

// Media lifecycle
eventBus.registerTopic('media.uploaded');
eventBus.registerTopic('media.softDeleted');
eventBus.registerTopic('media.purged');
eventBus.registerTopic('media.altUpdated');

// Lead lifecycle
eventBus.registerTopic('lead.created');
eventBus.registerTopic('lead.statusChanged');

// Auth events
eventBus.registerTopic('auth.loginSucceeded');
eventBus.registerTopic('auth.loginFailed');
eventBus.registerTopic('auth.passwordChanged');

// Page events
eventBus.registerTopic('page.sectionUpdated');

/**
 * Payload shape convention:
 *
 * {
 *   context: AuditContext,
 *   entity: <post-mutation snapshot>,
 *   previous?: <pre-mutation snapshot>,
 *   metadata?: object
 * }
 *
 * The audit subscriber expects this shape. New subscribers should follow it.
 */
