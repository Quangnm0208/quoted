/**
 * middleware/auth.js — JWT verification + DB user check (v1.4.4).
 *
 * Critical: requireAuth doesn't just verify the JWT — it also re-checks the
 * user row in the DB on every request. Reason: a JWT can still be valid
 * (chưa expire) sau khi user đã bị soft-deleted hoặc tenant đã bị archive →
 * token cũ phải bị reject ngay.
 *
 * Performance: 1 SELECT (prepared stmt) thêm mỗi request. better-sqlite3 sync,
 * < 1ms cho query có index. Trade-off chấp nhận được vì security.
 *
 * Optimization: nếu sau này scale lớn → cache (in-memory LRU 30s) hoặc move
 * sang token blacklist. Hiện tại đơn giản nhất là DB check.
 */

import db from '../db/connection.js';
import { verifyToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';

// Prepared statement (cache 1 lần khi module load)
let _userById = null;
function userByIdStmt() {
  if (_userById) return _userById;
  _userById = db.prepare(`
  SELECT u.id, u.email, u.role, u.tenant_id, u.is_active, u.deleted_at,
         t.status AS tenant_status
  FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
  WHERE u.id = ?
`);
  return _userById;
}

/**
 * Decode JWT + verify user vẫn valid trong DB.
 *
 * Rejects nếu:
 *   - Header missing/malformed → 401
 *   - JWT invalid/expired → 401
 *   - User không tồn tại → 401
 *   - User is_active=0 hoặc deleted_at IS NOT NULL → 401 (deactivated)
 *   - Tenant của user không 'active' (archived/suspended) → 401
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }
  const payload = verifyToken(match[1]);
  if (!payload || !payload.sub) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  // DB re-check (see header comment)
  const user = userByIdStmt().get(payload.sub);

  if (!user) {
    return next(new UnauthorizedError('Account no longer exists'));
  }
  if (user.is_active === 0 || user.deleted_at) {
    return next(new UnauthorizedError('Account is deactivated'));
  }
  if (user.tenant_status && user.tenant_status !== 'active') {
    return next(new UnauthorizedError('Tenant is ' + user.tenant_status));
  }

  // Dùng giá trị CURRENT từ DB, không tin JWT (defense-in-depth)
  // Role/tenant_id có thể đã thay đổi sau khi token được issue.
  req.user = {
    id:        user.id,
    email:     user.email,
    role:      user.role,
    tenant_id: user.tenant_id,
  };
  next();
}

/**
 * Optional auth — không reject nếu thiếu token.
 * Vẫn DB-check nếu token có (defense-in-depth giống requireAuth).
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();

  const payload = verifyToken(match[1]);
  if (!payload || !payload.sub) return next();   // Silently skip invalid token

  const user = userByIdStmt().get(payload.sub);
  if (!user || user.is_active === 0 || user.deleted_at) return next();
  if (user.tenant_status && user.tenant_status !== 'active') return next();

  req.user = {
    id:        user.id,
    email:     user.email,
    role:      user.role,
    tenant_id: user.tenant_id,
  };
  next();
}

/** Helper: check user is admin. */
export function isAdmin(req) {
  return req.user?.role === 'admin';
}

// Re-export RBAC for backward compat
export { requireRole } from './rbac.js';
