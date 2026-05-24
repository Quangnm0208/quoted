/**
 * projects/milestones.repository.js — Sub-resource (v1.4.4 tenant-aware).
 *
 * Mỗi milestone gắn với project_id, nhưng cũng có tenant_id denormalized
 * để query nhanh + double-check isolation.
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  listByProject: db.prepare(`
    SELECT m.*, mm.filename AS cover_filename
    FROM project_milestones m
    LEFT JOIN media mm ON mm.id = m.cover_media_id AND mm.tenant_id = m.tenant_id AND mm.deleted_at IS NULL
    WHERE m.project_id = ? AND m.tenant_id = ?
    ORDER BY m.sort_order ASC, m.id ASC
  `),
  findById: db.prepare(
    'SELECT * FROM project_milestones WHERE id = ? AND tenant_id = ?'
  ),
  insert: db.prepare(`
    INSERT INTO project_milestones
      (tenant_id, project_id, title, description, milestone_date, status, sort_order, cover_media_id)
    VALUES
      (@tenant_id, @project_id, @title, @description, @milestone_date, @status, @sort_order, @cover_media_id)
  `),
  update: db.prepare(`
    UPDATE project_milestones SET
      title = @title,
      description = @description,
      milestone_date = @milestone_date,
      status = @status,
      sort_order = @sort_order,
      cover_media_id = @cover_media_id,
      updated_at = datetime('now')
    WHERE id = @id AND tenant_id = @tenant_id
  `),
  delete: db.prepare(
    'DELETE FROM project_milestones WHERE id = ? AND tenant_id = ?'
  ),
  deleteByProject: db.prepare(
    'DELETE FROM project_milestones WHERE project_id = ? AND tenant_id = ?'
  ),
}));

// v1.4.3 fix for BUG #21: tenant type guard at every public entry point.
function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('milestones.repository: tenantId required (got: ' + typeof tenantId + ')');
  }
  return tenantId;
}

function decorate(m, uploadBaseUrl) {
  if (!m) return null;
  return {
    id: m.id, project_id: m.project_id,
    title: m.title, description: m.description, milestone_date: m.milestone_date,
    status: m.status, sort_order: m.sort_order, cover_media_id: m.cover_media_id,
    cover_url: m.cover_filename ? uploadBaseUrl + '/' + m.cover_filename : null,
    created_at: m.created_at, updated_at: m.updated_at,
  };
}

export const milestonesRepository = {
  listByProject(projectId, tenantId, uploadBaseUrl) {
    return stmt().listByProject.all(projectId, requireTenant(tenantId)).map(m => decorate(m, uploadBaseUrl));
  },

  create(projectId, tenantId, input, uploadBaseUrl) {
    requireTenant(tenantId);
    const info = stmt().insert.run({
      tenant_id: tenantId,
      project_id: projectId,
      title: input.title,
      description: input.description || '',
      milestone_date: input.milestone_date || null,
      status: input.status || 'pending',
      sort_order: input.sort_order ?? 0,
      cover_media_id: input.cover_media_id || null,
    });
    return this.findById(info.lastInsertRowid, tenantId, uploadBaseUrl);
  },

  findById(id, tenantId, uploadBaseUrl) {
    const m = stmt().findById.get(id, requireTenant(tenantId));
    if (!m) return null;
    return this.listByProject(m.project_id, tenantId, uploadBaseUrl).find(x => x.id === id) || null;
  },

  update(id, tenantId, input, uploadBaseUrl) {
    requireTenant(tenantId);
    const existing = stmt().findById.get(id, tenantId);
    if (!existing) return null;
    stmt().update.run({
      id, tenant_id: tenantId,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      milestone_date: input.milestone_date !== undefined ? input.milestone_date : existing.milestone_date,
      status: input.status ?? existing.status,
      sort_order: input.sort_order ?? existing.sort_order,
      cover_media_id: input.cover_media_id !== undefined ? input.cover_media_id : existing.cover_media_id,
    });
    return this.findById(id, tenantId, uploadBaseUrl);
  },

  delete(id, tenantId) {
    return stmt().delete.run(id, requireTenant(tenantId)).changes > 0;
  },

  replaceAll(projectId, tenantId, milestones, uploadBaseUrl) {
    requireTenant(tenantId);
    const txn = db.transaction(() => {
      stmt().deleteByProject.run(projectId, tenantId);
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        stmt().insert.run({
          tenant_id: tenantId,
          project_id: projectId,
          title: m.title || 'Untitled',
          description: m.description || '',
          milestone_date: m.milestone_date || null,
          status: m.status || 'pending',
          sort_order: m.sort_order ?? i * 10,
          cover_media_id: m.cover_media_id || null,
        });
      }
    });
    txn();
    return this.listByProject(projectId, tenantId, uploadBaseUrl);
  },
};
