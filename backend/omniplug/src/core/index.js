/**
 * src/core/index.js — Bundle Core barrel export.
 *
 * Boundary rule: Back-end modules MUST import core artifacts via this file,
 * not by reaching into core/lib or core/middleware directly. This keeps the
 * Core surface explicit and lets us reorganize internals without rippling
 * changes across the rest of the codebase.
 *
 * Three sub-bundles re-exported here:
 *   1. lib/        — pure helpers (errors, sanitize, slug, jwt, password, …)
 *   2. middleware/ — Express middleware (auth, rbac, tenant, validate, …)
 *   3. db/         — database client, migrations, and lazyPrepare helper
 *
 * Note: core/config/env.js is intentionally NOT re-exported. Modules that need
 * environment variables import it directly (`from '../../../core/config/env.js'`)
 * so the env dependency stays visible at the call-site.
 */

// ----- lib: errors (HttpError lives in asyncHandler.js for legacy reasons) -----
export {
  BaseHttpError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  TenantError,
} from './lib/errors.js';
export { HttpError, asyncHandler } from './lib/asyncHandler.js';

// ----- lib: pure helpers -----
export { recordAudit, recordSystemAudit, auditQuery } from './lib/audit.js';
export { getMediaUsage, formatUsage } from './lib/mediaUsage.js';
export {
  AUTH_LIMITS,
  checkAuthRateLimit,
  recordAuthAttempt,
  checkGenericLimit,
  pruneOldAttempts,
} from './lib/rateLimit.js';
export { ok, created, paginated, noContent, errorResponse } from './lib/response.js';
export { sanitizeArticleHtml, stripHtml } from './lib/sanitize.js';
export { tenancy, DEFAULT_TENANT_ID, getTenantId } from './lib/tenancy.js';
export { signToken, verifyToken } from './lib/jwt.js';
export { hashPassword, verifyPassword } from './lib/password.js';
export { slugify, ensureUniqueSlug } from './lib/slug.js';

// ----- middleware: Express plumbing -----
export { requireAuth, optionalAuth, isAdmin } from './middleware/auth.js';
export { errorHandler, notFoundHandler } from './middleware/error.js';
export { validateImageBuffer } from './middleware/magicMime.js';
export { requireRole, requireAdmin, requireEditor } from './middleware/rbac.js';
export {
  resolveTenantFromHost,
  resolveTenantFromAuth,
  resolveTenantLegacy,
} from './middleware/tenant.js';
export { validate, validateInline } from './middleware/validate.js';

// ----- db: persistence -----
export { default as db } from './db/connection.js';
export { runMigrations } from './db/migrate.js';
export { lazyPrepare } from './db/lazyPrepare.js';
