/**
 * projects/gallery.repository.js — Project gallery sub-resource (v1.4.4 tenant-aware).
 */

import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  listByProject: db.prepare(`
    SELECT g.*, m.filename, m.alt
    FROM project_gallery g
    JOIN media m ON m.id = g.media_id AND m.deleted_at IS NULL
    WHERE g.project_id = ? AND g.tenant_id = ?
    ORDER BY g.sort_order ASC, g.id ASC
  `),
  findById: db.prepare(
    'SELECT * FROM project_gallery WHERE id = ? AND tenant_id = ?'
  ),
  // Verify media exists + belongs to same tenant before inserting a gallery item.
  mediaExists: db.prepare(
    'SELECT 1 FROM media WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL'
  ),
  insert: db.prepare(`
    INSERT INTO project_gallery (tenant_id, project_id, media_id, caption, sort_order)
    VALUES (@tenant_id, @project_id, @media_id, @caption, @sort_order)
  `),
  delete: db.prepare(
    'DELETE FROM project_gallery WHERE id = ? AND tenant_id = ?'
  ),
  deleteByProject: db.prepare(
    'DELETE FROM project_gallery WHERE project_id = ? AND tenant_id = ?'
  ),
}));

// v1.4.3 fix for BUG #21: tenant type guard at every entry point.
function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') {
    throw new Error('gallery.repository: tenantId required (got: ' + typeof tenantId + ')');
  }
  return tenantId;
}

function decorate(row, uploadBaseUrl) {
  return {
    id: row.id, project_id: row.project_id, media_id: row.media_id,
    caption: row.caption, alt: row.alt, sort_order: row.sort_order,
    url: uploadBaseUrl + '/' + row.filename,
    created_at: row.created_at,
  };
}

export const galleryRepository = {
  listByProject(projectId, tenantId, uploadBaseUrl) {
    return stmt().listByProject.all(projectId, requireTenant(tenantId)).map(r => decorate(r, uploadBaseUrl));
  },

  create(projectId, tenantId, input, uploadBaseUrl) {
    requireTenant(tenantId);
    if (!stmt().mediaExists.get(input.media_id, tenantId)) {
      throw new Error(`Media ${input.media_id} không tồn tại hoặc không thuộc tenant`);
    }
    const info = stmt().insert.run({
      tenant_id: tenantId,
      project_id: projectId,
      media_id: input.media_id,
      caption: input.caption || '',
      sort_order: input.sort_order ?? 0,
    });
    return this.listByProject(projectId, tenantId, uploadBaseUrl).find(g => g.id === info.lastInsertRowid);
  },

  delete(id, tenantId) {
    return stmt().delete.run(id, requireTenant(tenantId)).changes > 0;
  },

  replaceAll(projectId, tenantId, items, uploadBaseUrl) {
    requireTenant(tenantId);
    const txn = db.transaction(() => {
      stmt().deleteByProject.run(projectId, tenantId);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!stmt().mediaExists.get(it.media_id, tenantId)) continue;
        stmt().insert.run({
          tenant_id: tenantId,
          project_id: projectId,
          media_id: it.media_id,
          caption: it.caption || '',
          sort_order: it.sort_order ?? i * 10,
        });
      }
    });
    txn();
    return this.listByProject(projectId, tenantId, uploadBaseUrl);
  },
};
