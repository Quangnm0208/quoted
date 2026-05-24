/**
 * auth/auth.controller.js — Login + me + change-password (legacy).
 *
 * Changes vs legacy:
 *   - Login rate limit (check trước verify để tiết kiệm bcrypt CPU)
 *   - Audit log mọi login attempt (success + fail)
 *   - 5 fail/15min từ 1 IP → 429
 *   - 10 fail/1h từ 1 email → 429
 */

import { Router } from 'express';
import { verifyPassword, hashPassword } from '../../../core/lib/password.js';
import { signToken } from '../../../core/lib/jwt.js';
import { requireAuth } from '../../../core/middleware/auth.js';
import { asyncHandler, HttpError } from '../../../core/lib/asyncHandler.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { canLogin } from '../../../core/lib/roles.js';
import { checkAuthRateLimit, recordAuthAttempt } from '../../../core/lib/rateLimit.js';
import { authRepository } from './auth.repository.js';

const router = Router();

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    tenant_id: row.tenant_id,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

/**
 * POST /api/auth/login
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const ip = req.ip;
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required', 'VALIDATION_ERROR');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // legacy: Rate limit check TRƯỚC khi bcrypt (tiết kiệm CPU)
  checkAuthRateLimit(normalizedEmail, ip);

  const user = authRepository.findByEmail(normalizedEmail);

  // Constant-time-ish: verify ngay cả khi user không tồn tại
  // để tránh email enumeration via timing attack.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, '$2a$12$' + 'x'.repeat(53));

  if (!user || !ok) {
    // Record fail attempt
    recordAuthAttempt(normalizedEmail, ip, false, userAgent);
    recordAudit(req, 'auth.login.fail', { metadata: { email: normalizedEmail } });
    throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Deactivated user không được login
  if (user.is_active === 0 || user.deleted_at) {
    recordAuthAttempt(normalizedEmail, ip, false, userAgent);
    recordAudit(req, 'auth.login.deactivated', {
      metadata: { email: normalizedEmail, user_id: user.id }
    });
    throw new HttpError(403, 'Tài khoản đã bị vô hiệu hóa', 'ACCOUNT_DEACTIVATED');
  }

  // Tenant của user phải active
  const userTenant = authRepository.tenantStatusById(user.tenant_id);
  if (userTenant && userTenant.status !== 'active') {
    recordAuthAttempt(normalizedEmail, ip, false, userAgent);
    recordAudit(req, 'auth.login.tenant_inactive', {
      metadata: { email: normalizedEmail, tenant_id: user.tenant_id, tenant_status: userTenant.status }
    });
    throw new HttpError(403, `Tenant đang ${userTenant.status}. Liên hệ super admin.`, 'TENANT_INACTIVE');
  }

  // v1.4: block login cho reserved roles (customer/vendor/b2b_partner).
  // Roles nay tao duoc nhung portal logic chua co - enable o v1.5.
  if (!canLogin(user.role)) {
    recordAuthAttempt(normalizedEmail, ip, false, userAgent);
    recordAudit(req, 'auth.login.role_not_enabled', {
      metadata: { email: normalizedEmail, role: user.role },
    });
    throw new HttpError(
      403,
      'Role này chưa được phép đăng nhập trong phiên bản hiện tại',
      'ROLE_LOGIN_NOT_ENABLED'
    );
  }

  // v1.4.3 SECURITY FIX (QA report 2026-05-19 section 8.5 finding #3):
  // Tenant-domain isolation on login. Without this check, a user from tenant A
  // could authenticate via tenant B's domain (Host header) if they knew the
  // credentials. Token would be scoped to tenant A so cross-tenant data leak
  // didn't happen, BUT this still violated the principle that tenant B's
  // login portal should not accept tenant A's users at all (information leak
  // via timing + valid 200 vs 401 response).
  //
  // Rules:
  //   1. If req.tenantId is set (Host or X-Tenant-Slug resolved a tenant)
  //      AND user.tenant_id !== req.tenantId → REJECT
  //   2. Platform admins (role = 'platform_admin') bypass this check —
  //      they need to log in from any host to manage all tenants
  //   3. If req.tenantId is not set (no Host match, dev mode fallback),
  //      legacy behaviour preserved (login allowed) — only relevant in dev
  //      where there is no real Host
  if (req.tenantId && req.tenantId !== user.tenant_id && user.role !== 'platform_admin') {
    recordAuthAttempt(normalizedEmail, ip, false, userAgent);
    recordAudit(req, 'auth.login.wrong_tenant_domain', {
      metadata: {
        email: normalizedEmail,
        user_tenant_id: user.tenant_id,
        request_tenant_id: req.tenantId,
      },
    });
    // Same 401 message as bad credentials — do not leak that this email
    // exists on a DIFFERENT tenant (would be email enumeration vector).
    throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Success
  authRepository.updateLastLogin(user.id);
  recordAuthAttempt(normalizedEmail, ip, true, userAgent);

  // Tạo req.user temp để recordAudit có user_id
  req.user = { id: user.id, email: user.email, role: user.role };
  recordAudit(req, 'auth.login.success');

  const token = signToken(user);

  res.json({
    token,
    user: publicUser(user),
  });
}));

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, asyncHandler((req, res) => {
  const user = authRepository.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
  res.json({ user: publicUser(user) });
}));

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    throw new HttpError(400, 'Current + new password required', 'VALIDATION_ERROR');
  }
  if (new_password.length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters', 'VALIDATION_ERROR');
  }

  // @cross-tenant: password change flow — user.id is verified by requireAuth middleware
  const fullUser = authRepository.findPasswordById(req.user.id);
  if (!fullUser) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');

  const ok = await verifyPassword(current_password, fullUser.password_hash);
  if (!ok) {
    recordAudit(req, 'auth.password.change.fail');
    throw new HttpError(401, 'Current password is incorrect', 'INVALID_CREDENTIALS');
  }

  const newHash = await hashPassword(new_password);
  authRepository.updatePassword(newHash, req.user.id);
  recordAudit(req, 'auth.password.change');
  res.json({ ok: true });
}));

export default router;
