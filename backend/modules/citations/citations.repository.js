/**
 * citations repository — minimal Phase 0 implementation.
 * Schema is final (see migrations/024_citations.sql); queries grow in Phase 2.
 *
 * @module citations/repository
 */

import { getDb } from '../../../core/db/connection.js';

let stmts = null;

function prepare() {
  if (stmts) return stmts;
  const db = getDb();

  stmts = {
    countActiveSince: db.prepare(`
      SELECT COUNT(*) AS n
      FROM citations
      WHERE tenant_id = ?
        AND status = 'active'
        AND last_seen_at >= ?
        AND confidence >= ?
    `),

    findRecent: db.prepare(`
      SELECT *
      FROM citations
      WHERE tenant_id = ?
        AND status = 'active'
      ORDER BY last_seen_at DESC
      LIMIT ?
    `),
  };

  return stmts;
}

export function countVerifiedSince(tenantId, sinceIso) {
  return prepare().countActiveSince.get(tenantId, sinceIso, 0.85).n;
}

export function countLikelySince(tenantId, sinceIso) {
  return prepare().countActiveSince.get(tenantId, sinceIso, 0.65).n;
}

export function findRecent(tenantId, limit = 20) {
  return prepare().findRecent.all(tenantId, limit);
}
