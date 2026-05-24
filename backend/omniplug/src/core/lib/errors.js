/**
 * core/errors.js — Typed error classes.
 *
 * Mục đích: thay vì throw `new HttpError(403, ...)` rải rác trong controller,
 * dùng class chuyên dụng → grep được, IDE autocomplete được, type-safer.
 *
 * Tất cả extend BaseHttpError → middleware/error.js handle 1 chỗ.
 *
 * Backward compat: re-export HttpError từ asyncHandler.js để code legacy không break.
 */

export class BaseHttpError extends Error {
  constructor(statusCode, message, code = 'ERROR', details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class ValidationError extends BaseHttpError {
  constructor(message = 'Validation failed', details) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends BaseHttpError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends BaseHttpError {
  constructor(message = 'Forbidden', details) {
    super(403, message, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends BaseHttpError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(404, message, code);
  }
}

export class ConflictError extends BaseHttpError {
  constructor(message, code = 'CONFLICT', details) {
    super(409, message, code, details);
  }
}

export class RateLimitError extends BaseHttpError {
  constructor(message = 'Too many requests', code = 'RATE_LIMITED') {
    super(429, message, code);
  }
}

export class TenantError extends BaseHttpError {
  constructor(message = 'Tenant resolution failed', code = 'TENANT_ERROR') {
    super(400, message, code);
  }
}
