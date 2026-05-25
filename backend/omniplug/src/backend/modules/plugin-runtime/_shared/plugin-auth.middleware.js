/**
 * Plugin-JWT auth middleware.
 *
 * The Quoted WP plugin authenticates to /api/v1/wp-sites/*, /bot-crawls/*,
 * /citations/*, /live-test/* via the HS256 JWT minted at /wp-sites/register
 * (see quoted-licenses.signPluginJwt). The shape is:
 *
 *   { sub: "wp_site:<id>", tenant_id, wp_site_id, plan, domain, iat, exp }
 *
 * On success we attach `req.auth = { tenantId, wpSiteId, plan, domain }`.
 *
 * Separate from OmniPlug's core `requireAuth` because the upstream middleware
 * expects an admin-user JWT (sub=userId, role, email) and looks the user up in
 * the users table — neither of which apply to a WP-plugin Bearer.
 */

import jwt from 'jsonwebtoken';
import { env } from '../../../../core/config/env.js';

function reject(res, code, message, status = 401) {
  return res.status(status).json({ error: { code, message } });
}

export function authPluginJwt(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return reject(res, 'JWT_MISSING', 'Authorization: Bearer <token> required');
  }
  const token = header.slice(7).trim();
  if (!token) return reject(res, 'JWT_MISSING', 'Empty bearer token');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return reject(res, 'JWT_EXPIRED', 'Token has expired; re-register with license key');
    }
    return reject(res, 'JWT_INVALID', 'Invalid or malformed token');
  }

  if (!payload || typeof payload.tenant_id !== 'number' || typeof payload.wp_site_id !== 'number') {
    return reject(res, 'JWT_INVALID', 'Token missing tenant_id/wp_site_id');
  }

  req.auth = {
    tenantId: payload.tenant_id,
    wpSiteId: payload.wp_site_id,
    plan:     payload.plan || 'free',
    domain:   payload.domain || null,
  };
  // Set req.tenantId too so downstream middleware/queries that read it work.
  req.tenantId = payload.tenant_id;
  next();
}
