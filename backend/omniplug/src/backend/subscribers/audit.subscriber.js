/**
 * subscribers/audit.subscriber.js — Domain events → audit log.
 *
 * Migration path from `recordAudit(req, ...)` in controllers:
 *
 *   current (v1.4.4): controllers still call recordAudit() directly.
 *   future:           controllers/services emit events. This subscriber catches
 *                     them and writes audit entries. Controllers no longer need
 *                     to know about audit at all.
 *
 * Benefits:
 *   1. Internal cascades (vd. project.update replaces 50 milestones) can
 *      emit per-entity events → per-entity audit rows.
 *   2. Async jobs and cron tasks just emit events; no special path needed.
 *   3. Audit can be turned off in tests by clearing subscribers.
 *   4. Adding a second observer (vd. send-to-SIEM) is just another subscriber.
 *
 * Topic → audit action mapping is explicit (not derived from topic name) so
 * we can rename topics without breaking the audit log format.
 */

import { eventBus } from '../../core/lib/eventBus.js';
import { recordAudit } from '../../core/lib/audit.js';

/**
 * Helper: extract entity id from a payload entity object.
 * Most rows have `.id`; some pivot tables don't. Caller may override via
 * payload.metadata.entityId.
 */
function entityIdOf(payload) {
  return payload?.metadata?.entityId ?? payload?.entity?.id ?? null;
}

/**
 * Map: domain topic → { auditAction, entityType }.
 * If a topic is missing here, no audit row is written for it — explicit.
 */
const TOPIC_MAP = {
  // Projects
  'project.created':       { action: 'project.create',         entityType: 'project' },
  'project.updated':       { action: 'project.update',         entityType: 'project' },
  'project.softDeleted':   { action: 'project.delete',         entityType: 'project' },
  'project.restored':      { action: 'project.restore',        entityType: 'project' },
  'project.statusChanged': { action: 'project.status_change',  entityType: 'project' },

  // Articles
  'article.created':       { action: 'article.create',         entityType: 'article' },
  'article.updated':       { action: 'article.update',         entityType: 'article' },
  'article.softDeleted':   { action: 'article.delete',         entityType: 'article' },
  'article.published':     { action: 'article.publish',        entityType: 'article' },
  'article.unpublished':   { action: 'article.unpublish',      entityType: 'article' },

  // Media
  'media.uploaded':        { action: 'media.upload',           entityType: 'media' },
  'media.softDeleted':     { action: 'media.delete',           entityType: 'media' },
  'media.purged':          { action: 'media.purge',            entityType: 'media' },
  'media.altUpdated':      { action: 'media.update',           entityType: 'media' },

  // Leads
  'lead.created':          { action: 'lead.create',            entityType: 'lead' },
  'lead.statusChanged':    { action: 'lead.status_change',     entityType: 'lead' },

  // Auth (special: actor may not be a tenant user)
  'auth.loginSucceeded':   { action: 'auth.login.success',     entityType: 'session' },
  'auth.loginFailed':      { action: 'auth.login.fail',        entityType: 'session' },
  'auth.passwordChanged':  { action: 'auth.password_change',   entityType: 'user' },

  // Pages
  'page.sectionUpdated':   { action: 'page.section_update',    entityType: 'page_section' },
};

/**
 * Wire all topic→audit mappings to the bus. Idempotent: call once at boot.
 */
export function registerAuditSubscriber() {
  for (const [topic, { action, entityType }] of Object.entries(TOPIC_MAP)) {
    eventBus.on(topic, (payload) => {
      if (!payload?.context) {
        console.warn(`[audit.subscriber] event "${topic}" missing context. Skipping audit.`);
        return;
      }
      recordAudit(payload.context, action, {
        entityType,
        entityId: entityIdOf(payload),
        metadata: payload.metadata || {},
      });
    });
  }
}
