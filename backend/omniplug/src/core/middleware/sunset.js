/**
 * core/middleware/sunset.js — Deprecation + Sunset headers + automatic 410 Gone.
 *
 * Problem this solves:
 *   The triple-router pattern (publicRouter / adminRouter / legacyRouter) was
 *   created to keep old API URLs working while building cleaner ones. But
 *   without a removal mechanism, "legacy" becomes permanent — both paths
 *   accumulate divergent fixes, doubling maintenance.
 *
 *   This middleware:
 *     1. Tells clients (via standard HTTP headers) when an endpoint will be
 *        removed and where to migrate.
 *     2. Hard-fails the endpoint with 410 Gone after the sunset date,
 *        forcing migration to complete.
 *
 * Headers emitted (RFC 8594 / RFC 9745):
 *   - `Sunset: <HTTP-date>` — when endpoint stops working
 *   - `Deprecation: true` — endpoint is deprecated NOW (informational)
 *   - `Link: <successor-url>; rel="successor-version"` — where to go instead
 *
 * Usage:
 *   import { sunset } from '../../../core/middleware/sunset.js';
 *   legacyRouter.get(
 *     '/',
 *     sunset({ date: '2026-09-01', successor: '/api/admin/media' }),
 *     handlers.list,
 *   );
 *
 * After 2026-09-01, requests to this endpoint get 410 Gone with a message
 * pointing to the successor URL. No silent failures.
 */

/**
 * @param {object} opts
 * @param {string} opts.date       - ISO date string (YYYY-MM-DD) for sunset
 * @param {string} opts.successor  - Replacement endpoint path
 * @param {string} [opts.reason]   - Optional reason shown in 410 body
 */
export function sunset({ date, successor, reason }) {
  if (!date || !successor) {
    throw new Error('sunset middleware requires { date, successor }');
  }
  const sunsetMs = new Date(date).getTime();
  if (isNaN(sunsetMs)) {
    throw new Error(`sunset: invalid date "${date}". Use YYYY-MM-DD.`);
  }
  const sunsetHttpDate = new Date(sunsetMs).toUTCString();

  return (req, res, next) => {
    // Always emit deprecation headers, even before the date.
    res.set('Sunset', sunsetHttpDate);
    res.set('Deprecation', 'true');
    res.set('Link', `<${successor}>; rel="successor-version"`);

    if (Date.now() > sunsetMs) {
      return res.status(410).json({
        error: 'GONE',
        code: 'ENDPOINT_SUNSET',
        message:
          reason ||
          `This endpoint was sunset on ${date}. Use ${successor} instead.`,
        successor,
        sunset_date: date,
      });
    }

    next();
  };
}
