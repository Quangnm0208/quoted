import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  listByPagePublic: db.prepare(`
    SELECT * FROM page_sections
    WHERE tenant_id = ? AND page_key = ? AND is_visible = 1
    ORDER BY sort_order ASC, id ASC
  `),
  listByPage: db.prepare(`
    SELECT * FROM page_sections WHERE tenant_id = ? AND page_key = ?
    ORDER BY sort_order ASC, id ASC
  `),
  listAll: db.prepare(`
    SELECT * FROM page_sections WHERE tenant_id = ?
    ORDER BY page_key, sort_order ASC, id ASC
  `),
  findById: db.prepare('SELECT * FROM page_sections WHERE id = ? AND tenant_id = ?'),
  insert: db.prepare(`
    INSERT INTO page_sections
      (tenant_id, page_key, section_key, component_type, title, subtitle, payload_json,
       sort_order, is_visible, updated_by)
    VALUES (@tenant_id, @page_key, @section_key, @component_type, @title, @subtitle,
            @payload_json, @sort_order, @is_visible, @updated_by)
  `),
  update: db.prepare(`
    UPDATE page_sections SET
      section_key = @section_key,
      component_type = @component_type,
      title = @title,
      subtitle = @subtitle,
      payload_json = @payload_json,
      sort_order = @sort_order,
      is_visible = @is_visible,
      updated_by = @updated_by,
      updated_at = datetime('now')
    WHERE id = @id AND tenant_id = @tenant_id
  `),
  updateSort: db.prepare(`
    UPDATE page_sections SET sort_order = ?, updated_at = datetime('now')
    WHERE id = ? AND tenant_id = ?
  `),
  delete: db.prepare('DELETE FROM page_sections WHERE id = ? AND tenant_id = ?'),
  maxSort: db.prepare(`
    SELECT COALESCE(MAX(sort_order), -10) AS max_sort
    FROM page_sections WHERE tenant_id = ? AND page_key = ?
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') throw new Error('pages.repository: tenantId required');
  return tenantId;
}

export const pagesRepository = {
  listByPagePublic(tenantId, pageKey) {
    return stmt().listByPagePublic.all(requireTenant(tenantId), pageKey);
  },

  listByPage(tenantId, pageKey) {
    return stmt().listByPage.all(requireTenant(tenantId), pageKey);
  },

  listAll(tenantId) {
    return stmt().listAll.all(requireTenant(tenantId));
  },

  findById(id, tenantId) {
    return stmt().findById.get(id, requireTenant(tenantId)) || null;
  },

  create(data) {
    return stmt().insert.run(data);
  },

  update(data) {
    requireTenant(data.tenant_id);
    return stmt().update.run(data);
  },

  updateSort(sortOrder, id, tenantId) {
    return stmt().updateSort.run(sortOrder, id, requireTenant(tenantId));
  },

  delete(id, tenantId) {
    return stmt().delete.run(id, requireTenant(tenantId));
  },

  nextSort(tenantId, pageKey) {
    return stmt().maxSort.get(requireTenant(tenantId), pageKey).max_sort + 10;
  },
};
