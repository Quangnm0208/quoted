/**
 * Plugin-side JWT signer.
 *
 * The qtd_(live|test)_<jwt> envelope path was removed in v0.4.0 — Lemon
 * Squeezy now owns license issuance (see modules/licenses/). The only
 * remaining helper here is `signPluginJwt`, which mints the JWT the plugin
 * uses as a bearer for /posts/sync, /bot-crawls/batch, /dashboard. It's
 * issued by wp-sites.service.register() AFTER the activation_token has
 * been validated.
 */

import jwt from 'jsonwebtoken';
import { env } from '../../../../core/config/env.js';

export function signPluginJwt(payload, ttlSeconds) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ttlSeconds });
}
