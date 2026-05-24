/**
 * projects/projects.repository.js — Persistence layer (SQL only).
 *
 * No business logic, no HTTP knowledge. All queries are tenant-scoped: every
 * statement either takes tenant_id as a parameter or has tenant_id in WHERE.
 *
 * Uses the shared lazyPrepare helper so statements are created on first call
 * (after migrations have run) instead of at import time.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  insert: db.prepare(`
    INSERT INTO projects
      (tenant_id, slug, name, description, status, progress_pct, cover_media_id, is_featured)
    VALUES
      (@tenant_id, @slug, @name, @description, @status, @progress_pct, @cover_media_id, @is_featured)
  `),

  findById: db.prepare(
    'SELECT * FROM projects WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL'
  ),
  findBySlug: db.prepare(
    'SELECT * FROM projects WHERE slug = ? AND tenant_id = ? AND deleted_at IS NULL'
  ),
  slugExists: db.prepare(
    'SELECT 1 FROM projects WHERE slug = ? AND tenant_id = ? AND deleted_at IS NULL'
  ),

  findMany: db.prepare(`
    SELECT * FROM projects
    WHERE tenant_id = ? AND deleted_at IS NULL
    ORDER BY is_featured DESC, updated_at DESC
    LIMIT ? OFFSET ?
  `),
  countAll: db.prepare(
    'SELECT COUNT(*) AS c FROM projects WHERE tenant_id = ? AND deleted_at IS NULL'
  ),

  update: db.prepare(`
    UPDATE projects SET
      slug = @slug, name = @name, description = @description, status = @status,
      progress_pct = @progress_pct, cover_media_id = @cover_media_id,
      is_featured = @is_featured, updated_at = datetime('now')
    WHERE id = @id AND tenant_id = @tenant_id AND deleted_at IS NULL
  `),

  softDelete: db.prepare(`
    UPDATE projects SET deleted_at = datetime('now')
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  restore: db.prepare(
    'UPDATE projects SET deleted_at = NULL WHERE id = ? AND tenant_id = ?'
  ),

  // Used by the service to attach cover_url. Kept here so all SQL lives in
  // one place; service layer never calls db.prepare() directly.
  findMediaFilename: db.prepare(
    'SELECT filename FROM media WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL'
  ),
}));

// v1.4.3 fix for BUG #21: tenant type guard, matching the pattern used in
// leads.repository.js, articles.repository.js, indexing.repository.js, etc.
// Previous version had none — if a caller passed `tenantId = undefined`, the
// SQL became `WHERE tenant_id = NULL` and silently returned 0 rows. Admin
// sees "no projects" instead of an error. This adds defense-in-depth.
//
// The insert/update methods take a payload object with tenant_id baked in,
// so they need to check `payload.tenant_id` instead.
function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('projects.repository: tenantId required (got: ' + typeof tenantId + ')');
  }
  return tenantId;
}
function requireTenantInPayload(payload, fieldName = 'tenant_id') {
  if (!payload || typeof payload[fieldName] !== 'number') {
    throw new Error('projects.repository: payload.' + fieldName + ' required (got: ' +
      (payload ? typeof payload[fieldName] : 'no payload') + ')');
  }
  return payload[fieldName];
}

export const projectsRepository = {
  insert(payload) {
    requireTenantInPayload(payload);
    return stmt().insert.run(payload);
  },
  findById(id, tenantId) {
    return stmt().findById.get(id, requireTenant(tenantId));
  },
  findBySlug(slug, tenantId) {
    return stmt().findBySlug.get(slug, requireTenant(tenantId));
  },
  slugExists(slug, tenantId) {
    return !!stmt().slugExists.get(slug, requireTenant(tenantId));
  },
  findMany(tenantId, limit, offset) {
    return stmt().findMany.all(requireTenant(tenantId), limit, offset);
  },
  countAll(tenantId) {
    return stmt().countAll.get(requireTenant(tenantId)).c;
  },
  update(payload) {
    requireTenantInPayload(payload);
    return stmt().update.run(payload);
  },
  softDelete(id, tenantId) {
    return stmt().softDelete.run(id, requireTenant(tenantId));
  },
  restore(id, tenantId) {
    return stmt().restore.run(id, requireTenant(tenantId));
  },
  findMediaFilename(mediaId, tenantId) {
    return stmt().findMediaFilename.get(mediaId, requireTenant(tenantId));
  },
};
