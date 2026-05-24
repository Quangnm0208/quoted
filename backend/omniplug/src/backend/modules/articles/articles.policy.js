/**
 * articles/articles.policy.js — Permission rules per action.
 *
 * Centralize quyền cho module Articles. Mỗi action map sang danh sách
 * roles được phép thực hiện.
 *
 * Lookup pattern:
 *   import { articlesPolicy } from './articles.policy.js';
 *   router.delete('/:id', requireAuth, requireRole(...articlesPolicy.delete), handler);
 *
 * Future: nếu phân quyền phức tạp hơn (per-field, per-tenant, per-resource-owner),
 * upgrade thành function: articlesPolicy.canDelete(user, article).
 */

export const articlesPolicy = {
  list:    ['admin', 'editor'],
  read:    ['admin', 'editor'],
  create:  ['admin', 'editor'],
  update:  ['admin', 'editor'],
  publish: ['admin', 'editor'],
  archive: ['admin', 'editor'],
  delete:  ['admin'],
  restore: ['admin'],
  purge:   ['admin'],
};
