/**
 * middleware/error.js — Centralized error handler (v1.4.4).
 *
 * Handle BaseHttpError + descendants từ core/errors.js, cũng support
 * legacy HttpError từ asyncHandler.js (legacy).
 *
 * Response shape (v1.4.4):
 *   { ok: false, error: { code, message, details? } }
 *
 * Backward compat: dev/legacy clients vẫn nhận field `error` + `message`
 * ở top level → keep cả 2 shape trong response.
 */

import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route ' + req.method + ' ' + req.path + ' not found',
    },
    // legacy
    message: 'Route ' + req.method + ' ' + req.path + ' not found',
  });
}

export function errorHandler(err, req, res, next) {
  // Support both: BaseHttpError (current) + HttpError (legacy)
  const status = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log 5xx (server errors), không log 4xx (user mistakes)
  if (status >= 500) {
    console.error('[error]', req.method, req.path, '—', err);
  }

  const errorBody = {
    code,
    message: status < 500 ? err.message : 'Internal server error',
  };

  // Bao gồm details (validation errors, etc.)
  if (err.details !== undefined) errorBody.details = err.details;

  // Dev: expose stack cho 5xx
  if (env.NODE_ENV !== 'production' && status >= 500) {
    errorBody.stack = err.stack;
  }

  res.status(status).json({
    ok: false,
    error: errorBody,
    // legacy top-level fields cho legacy clients
    message: errorBody.message,
  });
}
