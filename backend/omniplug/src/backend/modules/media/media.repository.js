/**
 * media/media.repository.js — Tenant-scoped persistence for media.
 *
 * Converted from the flat `mediaRepository = { ... }` object to the capability
 * pattern: tenantId is bound at construction. Caller cannot forget it.
 *
 * Usage:
 *   const repo = MediaRepository.scopeTo(ctx.tenantId);
 *   const row = repo.findById(123);          // tenantId implicit
 *   const list = repo.findMany(20, 0);
 *
 * Statement cache is module-level (shared across all tenants) because
 * prepared statements are stateless — only the bound parameter values differ
 * per tenant. tenantId is supplied at `.get()`/`.run()` time, never compiled in.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';
import { TenantScopedRepository } from '../../../core/db/TenantScopedRepository.js';

const stmt = lazyPrepare(() => ({
  insert: db.prepare(`
    INSERT INTO media
      (tenant_id, filename, original_name, mime_type, size_bytes, width, height, alt, alt_status, alt_suggested, uploaded_by)
    VALUES
      (@tenant_id, @filename, @original_name, @mime_type, @size_bytes, @width, @height, @alt, @alt_status, @alt_suggested, @uploaded_by)
  `),
  findById: db.prepare(
    'SELECT * FROM media WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL'
  ),
  findByIdAny: db.prepare(
    'SELECT * FROM media WHERE id = ? AND tenant_id = ?'
  ),
  findMany: db.prepare(`
    SELECT * FROM media
    WHERE tenant_id = ? AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `),
  countAll: db.prepare(
    'SELECT COUNT(*) AS c FROM media WHERE tenant_id = ? AND deleted_at IS NULL'
  ),
  softDelete: db.prepare(`
    UPDATE media SET deleted_at = datetime('now')
    WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
  `),
  hardDelete: db.prepare(
    'DELETE FROM media WHERE id = ? AND tenant_id = ?'
  ),
  updateAlt: db.prepare(
    'UPDATE media SET alt = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL'
  ),
}));

export class MediaRepository extends TenantScopedRepository {
  /**
   * Insert media row. The payload's tenant_id field is overwritten with the
   * bound tenantId — even if caller passes a different one, the bound scope
   * wins. This is the whole point of the capability pattern.
   */
  insert(payload) {
    return stmt().insert.run({ ...payload, tenant_id: this.tenantId });
  }

  findById(id) {
    return stmt().findById.get(id, this.tenantId);
  }

  /** Includes soft-deleted rows. Used only by the purge flow. */
  findByIdAny(id) {
    return stmt().findByIdAny.get(id, this.tenantId);
  }

  findMany(limit, offset) {
    return stmt().findMany.all(this.tenantId, limit, offset);
  }

  countAll() {
    return stmt().countAll.get(this.tenantId).c;
  }

  softDelete(id) {
    return stmt().softDelete.run(id, this.tenantId);
  }

  hardDelete(id) {
    return stmt().hardDelete.run(id, this.tenantId);
  }

  updateAlt(id, alt) {
    return stmt().updateAlt.run(alt, id, this.tenantId);
  }
}
