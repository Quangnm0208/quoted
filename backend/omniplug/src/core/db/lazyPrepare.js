/**
 * lazyPrepare.js — Defer prepared-statement creation until first use.
 *
 * Why this exists:
 *   Calling db.prepare() at module top-level crashes when imported before
 *   migrations have run (table doesn't exist yet). Each module previously
 *   reimplemented the same memoization pattern. This helper centralizes it.
 *
 * Usage:
 *   import db from '../../core/db/connection.js';
 *   import { lazyPrepare } from '../../core/db/lazyPrepare.js';
 *
 *   const stmt = lazyPrepare(() => ({
 *     insert: db.prepare('INSERT INTO foo (...) VALUES (...)'),
 *     findById: db.prepare('SELECT * FROM foo WHERE id = ?'),
 *   }));
 *
 *   // Later, inside a handler:
 *   stmt().findById.get(id);
 */

export function lazyPrepare(factory) {
  let cached = null;
  return function getStatements() {
    if (cached) return cached;
    cached = factory();
    return cached;
  };
}
