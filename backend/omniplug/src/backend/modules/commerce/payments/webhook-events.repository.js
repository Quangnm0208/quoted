/**
 * webhook_events repository — idempotency log for LS webhooks.
 *
 * event_id is LS's webhook event UUID, UNIQUE. The handler INSERTs first;
 * duplicate delivery hits the UNIQUE constraint and we short-circuit
 * (already processed → return 200, don't re-run handler logic).
 */

import db from '../../../../core/db/connection.js';
import { lazyPrepare } from '../../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  insertIfNew: db.prepare(`
    INSERT OR IGNORE INTO webhook_events
      (event_id, event_name, signature_valid, raw_payload)
    VALUES (?, ?, ?, ?)
  `),
  findByEventId: db.prepare(`SELECT * FROM webhook_events WHERE event_id = ?`),
  markProcessed: db.prepare(`
    UPDATE webhook_events
    SET processed = 1, processed_at = datetime('now'), error_message = NULL
    WHERE event_id = ?
  `),
  markFailed: db.prepare(`
    UPDATE webhook_events
    SET processed = 0, processed_at = datetime('now'), error_message = ?
    WHERE event_id = ?
  `),
}));

/**
 * Insert if unseen; returns { isNew, row } where row is the existing or
 * just-inserted webhook_events record.
 */
export function recordEventIfNew({ eventId, eventName, signatureValid, rawPayload }) {
  const info = stmt().insertIfNew.run(eventId, eventName, signatureValid ? 1 : 0, rawPayload);
  const row = stmt().findByEventId.get(eventId);
  return { isNew: info.changes > 0, row };
}

export function markProcessed(eventId) {
  stmt().markProcessed.run(eventId);
}

export function markFailed(eventId, message) {
  stmt().markFailed.run(String(message).slice(0, 500), eventId);
}
