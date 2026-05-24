/**
 * utils/jwt.js — Sign + verify JWT tokens (v1.4.4).
 *
 * Payload includes tenant_id so admin routes know which tenant the user
 * belongs to.
 *
 * Payload shape:
 *   { sub: userId, email, role, tenant_id }
 *
 * Expiry: env.JWT_EXPIRES_IN, default 24h (legacy hardening).
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,    // scope token to tenant
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}
