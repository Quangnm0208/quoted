/**
 * utils/asyncHandler.js — Wrap async route handlers to auto-catch errors.
 *
 * Without this, every controller needs:
 *   try { ... } catch (err) { next(err); }
 *
 * With this:
 *   router.get('/x', asyncHandler(async (req, res) => { ... }));
 *
 * Errors bubble lên error middleware tự động.
 */

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Custom HTTP error class — set status + safe message.
 */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
  }
}
