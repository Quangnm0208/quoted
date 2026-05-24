/**
 * core/response.js — Standardized API response shape.
 *
 * Goal: mọi endpoint trả về cùng shape → client dễ parse.
 *
 * Success:
 *   { ok: true, data: ..., meta?: { pagination, ... } }
 *
 * Error (handled trong middleware/error.js):
 *   { ok: false, error: { code, message, details? } }
 *
 * NOTE: This shape áp dụng cho ENDPOINTS MỚI (introduced v1.2, current in v1.4.4).
 * Endpoints cũ (legacy) giữ shape cũ để backward compat — sẽ migrate dần.
 */

export function ok(res, data, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return res.json(body);
}

export function created(res, data, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return res.status(201).json(body);
}

export function paginated(res, rows, { total, limit, offset } = {}) {
  return res.json({
    ok: true,
    data: rows,
    meta: {
      pagination: { total, limit, offset, count: rows.length },
    },
  });
}

export function noContent(res) {
  return res.status(204).end();
}

/** Error helper — usually thrown via errors.js classes. */
export function errorResponse(res, status, code, message, details) {
  const body = { ok: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}
