/**
 * redirections/redirections.repository.js — Tenant-scoped redirect rules.
 *
 * The hot read path does NOT call this repository directly — see
 * redirections.cache.js for the per-request lookup. This repository is
 * for: admin CRUD, batch hit counter flush, and initial cache load.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  // Cache load: every active rule for a tenant. Returned in priority order
  // — exact first, starts_with second, regex last. Reason: exact match is
  // O(1) hashable; starts_with is short-circuit; regex is the slowest, so
  // we put it last to minimize work on average.
  listActiveForCache: db.prepare(`
    SELECT id, source_url, match_type, destination_url, status_code
    FROM redirections
    WHERE tenant_id = ?
      AND is_active = 1
      AND deleted_at IS NULL
    ORDER BY CASE match_type
      WHEN 'exact' THEN 1
      WHEN 'starts_with' THEN 2
      WHEN 'regex' THEN 3
      ELSE 4
    END, id ASC
  `),

  listAdminPaginated: db.prepare(`
    SELECT * FROM redirections
    WHERE tenant_id = ? AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `),

  countAdminActive: db.prepare(`
    SELECT COUNT(*) AS c FROM redirections
    WHERE tenant_id = ? AND deleted_at IS NULL
  `),

  findById: db.prepare(`
    SELECT * FROM redirections
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),

  findBySource: db.prepare(`
    SELECT * FROM redirections
    WHERE tenant_id = ? AND source_url = ? AND match_type = ?
      AND deleted_at IS NULL
  `),

  insert: db.prepare(`
    INSERT INTO redirections
      (tenant_id, source_url, match_type, destination_url, status_code,
       is_active, auto_created, source_entity, source_entity_id, created_by)
    VALUES
      (@tenant_id, @source_url, @match_type, @destination_url, @status_code,
       @is_active, @auto_created, @source_entity, @source_entity_id, @created_by)
  `),

  update: db.prepare(`
    UPDATE redirections SET
      source_url = @source_url,
      match_type = @match_type,
      destination_url = @destination_url,
      status_code = @status_code,
      is_active = @is_active,
      updated_at = datetime('now')
    WHERE id = @id AND tenant_id = @tenant_id AND deleted_at IS NULL
  `),

  softDelete: db.prepare(`
    UPDATE redirections SET deleted_at = datetime('now')
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),

  // Hit counter flush: increment hits + bump last_accessed_at for many rules
  // at once. Called every 60s by the middleware's flush timer.
  bumpHit: db.prepare(`
    UPDATE redirections SET
      hits = hits + ?,
      last_accessed_at = datetime('now')
    WHERE id = ?
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('redirections.repository: tenantId required');
  }
  return tenantId;
}

export const redirectionsRepository = {
  listActiveForCache(tenantId) {
    return stmt().listActiveForCache.all(requireTenant(tenantId));
  },

  listAdminPaginated(tenantId, limit = 50, offset = 0) {
    return {
      rows: stmt().listAdminPaginated.all(
        requireTenant(tenantId),
        Math.min(limit, 200),
        Math.max(offset, 0),
      ),
      total: stmt().countAdminActive.get(requireTenant(tenantId)).c,
    };
  },

  findById(id, tenantId) {
    return stmt().findById.get(id, requireTenant(tenantId)) || null;
  },

  findBySource(tenantId, sourceUrl, matchType) {
    return stmt().findBySource.get(requireTenant(tenantId), sourceUrl, matchType) || null;
  },

  create(tenantId, input, createdBy) {
    return stmt().insert.run({
      tenant_id: requireTenant(tenantId),
      source_url: input.source_url,
      match_type: input.match_type || 'exact',
      destination_url: input.destination_url || '',
      status_code: input.status_code || 301,
      is_active: input.is_active === false ? 0 : 1,
      auto_created: input.auto_created ? 1 : 0,
      source_entity: input.source_entity || null,
      source_entity_id: input.source_entity_id || null,
      created_by: createdBy || null,
    });
  },

  update(id, tenantId, input) {
    return stmt().update.run({
      id,
      tenant_id: requireTenant(tenantId),
      source_url: input.source_url,
      match_type: input.match_type,
      destination_url: input.destination_url,
      status_code: input.status_code,
      is_active: input.is_active ? 1 : 0,
    });
  },

  softDelete(id, tenantId) {
    return stmt().softDelete.run(id, requireTenant(tenantId));
  },

  /**
   * Batch hit flush. Takes an array of { id, count } objects.
   * Wrapped in a transaction so partial failure rolls back cleanly.
   */
  flushHits(entries) {
    if (!entries || entries.length === 0) return;
    const tx = db.transaction((items) => {
      for (const it of items) {
        stmt().bumpHit.run(it.count, it.id);
      }
    });
    tx(entries);
  },
};
