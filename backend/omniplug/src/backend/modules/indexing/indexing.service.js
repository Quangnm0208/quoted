/**
 * indexing/indexing.service.js — IndexNow submission orchestrator.
 *
 * What IndexNow is:
 *   A protocol jointly supported by Bing and Yandex (and recognized by
 *   several other engines). Submitting a URL pings the engine to recrawl
 *   immediately, typically resulting in indexing within minutes instead
 *   of days. See https://www.indexnow.org/documentation
 *
 * Design choices:
 *   1. Fire-and-forget. submit() returns a Promise but the caller (event
 *      bus subscriber) does NOT await it. This is intentional: an admin
 *      publishing an article must not be delayed by network I/O to a
 *      third-party endpoint that might be slow or down.
 *
 *   2. Throttle per URL. The IndexNow spec recommends not pinging the
 *      same URL more than once every few seconds. We enforce 60s by
 *      checking recent submissions in the log. This means rapid
 *      publish/unpublish/publish does not flood the API.
 *
 *   3. Key persistence. Each tenant gets one key, generated lazily on
 *      first use. The key is stored in site_config and ALSO served at
 *      `/<key>.txt` on the tenant's domain (handled by the controller
 *      route). Bing fetches that file to verify ownership.
 *
 *   4. Best-effort logging. If the indexing_log insert fails for some
 *      reason (DB locked, disk full), we console.warn and skip — never
 *      throw. Indexing is observational; a missing log row must not
 *      prevent the actual submission.
 *
 *   5. No retries. If Bing returns 5xx, we log and move on. Cron-based
 *      retry would need a scheduler — out of scope for v1.4. The next
 *      content edit will re-submit naturally.
 */

import crypto from 'node:crypto';
import { indexingRepository } from './indexing.repository.js';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const THROTTLE_SECONDS = 60;     // do not re-ping same URL within 60s
const REQUEST_TIMEOUT_MS = 5000; // hard timeout — IndexNow should be fast

/**
 * Generate a fresh IndexNow key. Spec requires 8-128 hex/alphanum chars.
 * We use 32 hex chars (128 bits of entropy) — secure and unguessable.
 */
function generateKey() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Get the IndexNow key for a tenant. Creates one if missing.
 *
 * Why lazy: most tenants will trigger this on first article publish.
 * Eagerly generating on tenant creation would mean a key sitting unused
 * (and possibly leaked) before anything is submitted.
 */
function ensureKey(tenantId) {
  let key = indexingRepository.getKey(tenantId);
  if (!key) {
    key = generateKey();
    indexingRepository.setKey(tenantId, key);
  }
  return key;
}

/**
 * Submit a URL (or array of URLs) to IndexNow.
 *
 * @param {object} args
 * @param {number} args.tenantId    — required
 * @param {string} args.host        — tenant host without scheme, e.g. 'futakiman.vn'
 * @param {string|string[]} args.urls — absolute URLs to submit
 * @param {boolean} [args.manual]   — true if triggered by admin button (skips throttle)
 * @returns {Promise<{ok: boolean, submitted: number, throttled: number}>}
 */
export async function submit({ tenantId, host, urls, manual = false }) {
  if (typeof tenantId !== 'number') {
    throw new Error('indexing.service.submit: tenantId required');
  }
  if (!host || typeof host !== 'string') {
    throw new Error('indexing.service.submit: host required');
  }

  // Respect the per-tenant on/off switch (admin can disable temporarily).
  if (!indexingRepository.isEnabled(tenantId)) {
    return { ok: false, submitted: 0, throttled: 0, disabled: true };
  }

  const urlList = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (urlList.length === 0) {
    return { ok: false, submitted: 0, throttled: 0 };
  }

  // v1.4.3 fix for BUG #16 (TOCTOU race):
  // Previous code: recentSubmissionExists() check, then insertLog() if not throttled.
  // Race: 100 concurrent setImmediate(submit) events for same URL all saw
  // "no recent row" → all inserted → 100 fetches to IndexNow → Bing ban.
  //
  // New approach: atomic INSERT...WHERE NOT EXISTS in a single SQL statement.
  // Each tryInsertLog() call either inserts a pending row (returns inserted:true)
  // or returns inserted:false (= throttled). Manual submissions bypass the
  // threshold by passing thresholdSec=0, so they always insert.
  const toSubmit = [];
  const logIds = [];
  let throttled = 0;
  for (const url of urlList) {
    const threshold = manual ? 0 : THROTTLE_SECONDS;
    let result;
    try {
      result = indexingRepository.tryInsertLog(tenantId, url, 'indexnow', manual, threshold);
    } catch (err) {
      console.warn('[indexing] tryInsertLog failed:', err.message);
      // On DB error (e.g. tenant FK fail), skip this URL but don't crash.
      continue;
    }
    if (result.inserted) {
      toSubmit.push(url);
      logIds.push(result.id);
    } else {
      throttled++;
    }
  }
  if (toSubmit.length === 0) {
    return { ok: true, submitted: 0, throttled };
  }

  const key = ensureKey(tenantId);
  const payload = {
    host,
    key,
    keyLocation: 'https://' + host + '/' + key + '.txt',
    urlList: toSubmit,
  };

  // Note: log rows already inserted above as pending. We update them with
  // the result after fetch() completes (or after timeout/error).

  // Send the request. AbortController gives us a hard timeout so a hung
  // IndexNow endpoint cannot pile up requests.
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  let resCode = 0;
  let errMsg = null;
  let ok = false;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'OmniPlug-CMS/1.4.2 IndexNow',
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    resCode = response.status;
    // IndexNow returns 200/202 on success; 4xx on client errors; 429 if throttled.
    ok = resCode >= 200 && resCode < 300;
    if (!ok) {
      // Read body once for the error message; tolerate empty.
      try { errMsg = (await response.text()).slice(0, 500); } catch {}
    }
  } catch (err) {
    errMsg = err.name === 'AbortError' ? 'timeout' : err.message;
  } finally {
    clearTimeout(timeout);
  }

  // Update each log entry with the result. Same status for all URLs in
  // a batch — IndexNow does not return per-URL detail.
  const finalStatus = ok ? 'success' : (resCode === 429 ? 'throttled' : 'failed');
  for (const id of logIds) {
    if (id === null) continue;
    try {
      indexingRepository.updateLogResult(id, finalStatus, resCode, errMsg);
    } catch (err) {
      console.warn('[indexing] log update failed:', err.message);
    }
  }

  return { ok, submitted: toSubmit.length, throttled, statusCode: resCode };
}

/**
 * Read API for the controller: list recent submissions for a tenant.
 * Pure read; no side effects.
 */
export function listRecentSubmissions(tenantId, limit, offset) {
  return {
    rows: indexingRepository.listRecent(tenantId, limit, offset),
    total: indexingRepository.countByTenant(tenantId),
  };
}

/**
 * Get the current key for the keyLocation file (`/<key>.txt` served at
 * the root of the tenant's domain). The IndexNow protocol requires Bing
 * to fetch this file before accepting submissions; the file must contain
 * the key as its plain-text body.
 */
export function getKeyForVerification(tenantId) {
  return ensureKey(tenantId);
}

/**
 * Prune old log entries. Called at startup; same pattern as audit_log.
 */
export function pruneOldLogs(retentionDays = 90) {
  try {
    const r = indexingRepository.prune(retentionDays);
    if (r && r.changes > 0) {
      console.log('[indexing] pruned ' + r.changes + ' log entries older than ' + retentionDays + ' days');
    }
  } catch (err) {
    console.warn('[indexing] prune failed:', err.message);
  }
}

export const indexingService = {
  submit,
  listRecentSubmissions,
  getKeyForVerification,
  pruneOldLogs,
};
