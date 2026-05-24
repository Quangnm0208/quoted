/**
 * middleware/validate.js — Zod-based request validation.
 *
 * Centralize validation logic so controllers don't repeat `safeParse + throw`.
 *
 * Usage in routes:
 *   import { validate } from '../../../core/middleware/validate.js';
 *   import { articleSchema } from './articles.schema.js';
 *
 *   router.post('/', requireAuth, validate({ body: articleSchema }), handler);
 *
 * Validated data attaches to req.validated:
 *   req.validated.body  → parsed body
 *   req.validated.query → parsed query
 *   req.validated.params → parsed params
 *
 * On fail: throws ValidationError (handled by errorHandler).
 */

import { ValidationError } from '../lib/errors.js';

/**
 * @param {Object} schemas — { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */
export function validate(schemas = {}) {
  return (req, res, next) => {
    req.validated = req.validated || {};
    try {
      for (const key of ['body', 'query', 'params']) {
        if (schemas[key]) {
          const result = schemas[key].safeParse(req[key]);
          if (!result.success) {
            return next(new ValidationError(
              `Validation failed (${key})`,
              result.error.flatten()
            ));
          }
          req.validated[key] = result.data;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Helper inline validation (cho code legacy chưa migrate sang middleware).
 *
 * @returns parsed data
 * @throws ValidationError
 */
export function validateInline(schema, data, label = 'data') {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Validation failed (${label})`,
      result.error.flatten()
    );
  }
  return result.data;
}
