/**
 * bot-crawls service — batch ingestion with dedup.
 *
 * @module bot-crawls/service
 */

import * as repo from './bot-crawls.repository.js';

/**
 * Generate a dedup key at minute granularity.
 * Same bot + url + minute = single row.
 */
function buildDedupKey(botName, urlPath, crawledAt) {
  const minute = new Date(crawledAt).toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:MM'
  return `${botName}|${urlPath}|${minute}`;
}

/**
 * Ingest a batch of crawl events.
 * Returns { accepted, deduped, rejected }.
 */
export async function ingestBatch(tenantId, wpSiteId, events) {
  let accepted = 0;
  let deduped = 0;
  let rejected = 0;
  const rejectedReasons = [];

  for (const ev of events) {
    try {
      const dedupKey = buildDedupKey(ev.bot_name, ev.url_path, ev.crawled_at);

      const inserted = repo.insertIfNew({
        tenantId,
        wpSiteId,
        botName:    ev.bot_name,
        urlPath:    ev.url_path,
        userAgent:  ev.user_agent || null,
        ipHash:     ev.ip_hash,
        crawledAt:  ev.crawled_at,
        dedupKey,
      });

      if (inserted) {
        accepted++;
      } else {
        deduped++;
      }
    } catch (err) {
      rejected++;
      rejectedReasons.push({ error: err.message });
    }
  }

  return { accepted, deduped, rejected, rejected_reasons: rejectedReasons };
}
