/**
 * utils/password.js — bcryptjs hash + verify.
 *
 * Bcryptjs vs bcrypt (native):
 *   - bcryptjs là pure JS, không cần build tools (Python/make)
 *   - Chậm hơn ~3x nhưng cho landing CMS với ~3 login/ngày là OK
 *   - 12 rounds: ~600ms/hash trên Node 20 (vs ~200ms native bcrypt)
 *   - Tradeoff: dễ deploy đâu cũng được (Docker slim, Fly free, Railway)
 *
 * Migrate sang bcrypt native nếu cần performance (anh phải install
 * build-essential trong Dockerfile + thay import này).
 *
 * Constant-time compare đã được bcryptjs.compare lo, không cần custom.
 */

import bcryptjs from 'bcryptjs';
import { env } from '../config/env.js';

export async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return bcryptjs.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcryptjs.compare(plain, hash);
}
