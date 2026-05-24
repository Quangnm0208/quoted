/**
 * middleware/rbac.js — Role-Based Access Control.
 *
 * Tách khỏi auth.js để keep concerns separate:
 *   - auth.js: WHO are you (authentication)
 *   - rbac.js: WHAT can you do (authorization)
 *
 * Usage:
 *   router.get('/x',    requireAuth, handler)                      // any authed
 *   router.delete('/x', requireAuth, requireRole('admin'), h)      // admin only
 *   router.post('/x',   requireAuth, requireRole('admin', 'editor'), h)
 *
 * Policy decisions live in controller code (simple, dễ grep).
 * Nếu ngày càng nhiều role / permission → move sang policy files per-module.
 */

import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

/**
 * Require user có 1 trong các role được allow.
 *
 * @param  {...string} allowedRoles  e.g. ('admin') hoặc ('admin', 'editor')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(
        `Cần quyền: ${allowedRoles.join(' hoặc ')}. Tài khoản của bạn là: ${req.user.role}`,
      ));
    }
    next();
  };
}

/**
 * Require admin role specifically (alias).
 */
export const requireAdmin = requireRole('admin');

/**
 * Require admin OR editor (alias).
 */
export const requireEditor = requireRole('admin', 'editor');
