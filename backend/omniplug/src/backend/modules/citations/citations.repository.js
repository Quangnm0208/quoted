/**
 * citations repository — minimal Phase 0 implementation.
 * Schema is final (see migration 027); queries grow in Phase 2.
 *
 * `countVerifiedSince`, `countLikelySince`, `findRecent` are exported now
 * so the Phase 2 dashboard wiring is a one-line change. They are NOT
 * called in Phase 0 (the dashboard summary stubs citation counts as 0).
 * Removing them would force Phase 2 to redesign the repo from scratch.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  countActiveSince: db.prepare(`
    SELECT COUNT(*) AS n FROM citations
    WHERE tenant_id = ? AND status = 'active'
      AND last_seen_at >= ? AND confidence >= ?
  `),

  findRecent: db.prepare(`
    SELECT * FROM citations
    WHERE tenant_id = ? AND status = 'active'
    ORDER BY last_seen_at DESC LIMIT ?
  `),
}));

export function countVerifiedSince(tenantId, sinceIso) {
  return stmt().countActiveSince.get(tenantId, sinceIso, 0.85).n;
}

export function countLikelySince(tenantId, sinceIso) {
  return stmt().countActiveSince.get(tenantId, sinceIso, 0.65).n;
}

export function findRecent(tenantId, limit = 20) {
  return stmt().findRecent.all(tenantId, limit);
}
