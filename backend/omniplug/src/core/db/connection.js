/**
 * db/connection.js - SQLite singleton (better-sqlite3).
 *
 * SQLite is the only supported database for OmniPlug CMS Core v1.4.4. It keeps
 * the product cheap to run, easy to back up and simple to deploy on Fly.io with
 * a persistent volume.
 *
 * Pragma settings (in execution order):
 *  - WAL: allow readers while writes are pending. Essential for concurrent
 *         public-page reads while admin writes happen.
 *  - foreign_keys ON: enforce FK constraints.
 *  - busy_timeout 5000ms: wait briefly on locks instead of throwing instantly.
 *  - synchronous = NORMAL: WAL guarantees durability across normal crashes
 *         without fsync per write. Power-loss may lose the LAST committed tx;
 *         acceptable for a CMS where idempotent re-submit is fine.
 *  - cache_size = -16000 (16 MB): increases the page cache from the SQLite
 *         default 2 MB. For shared-cpu-1x with 512 MB total, 16 MB headroom
 *         is safe and reduces disk reads dramatically on the article-list
 *         hot path (90 tenants × 5 articles each fits easily in cache).
 *  - mmap_size = 64 MB: lets SQLite mmap the DB file. Read-heavy paths
 *         (article list, lead count) get OS-page-cache-backed reads without
 *         the read() syscall round-trip.
 *  - temp_store = MEMORY: temp tables / sort buffers stay in RAM instead of
 *         spilling to /tmp on the Fly volume (slower disk).
 *
 * Tuning rationale (Fly shared-cpu-1x / 512 MB):
 *   Node process RSS observed: ~125 MB. SQLite pragmas add ~80 MB max (cache
 *   + mmap window). Total ~210 MB — well under the 512 MB budget. The WAL
 *   file capped at ~16 MB during normal operation per checkpoint cadence.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';

const dbPath = path.resolve(env.DB_PATH);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, {
  verbose: env.NODE_ENV === 'development' && env.DB_DEBUG ? console.log : undefined,
});

// Critical SQLite pragmas must be set immediately after opening the connection.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL'); // Practical durability/speed tradeoff for this core.

// v1.4.4 perf tuning — see header comment for rationale. These are tunable
// via env if the deployment has different RAM budget. Negative cache_size
// means "kibibytes" (positive = pages). 16 MB suits the v1.4.4 SLO targets.
const cacheKb  = Number(env.SQLITE_CACHE_KB || 16384);
const mmapBytes = Number(env.SQLITE_MMAP_BYTES || 64 * 1024 * 1024);
db.pragma(`cache_size = -${cacheKb}`);
db.pragma(`mmap_size = ${mmapBytes}`);
db.pragma('temp_store = MEMORY');

// Register an ISO timestamp helper for SQL hooks.
db.function('now_iso', () => new Date().toISOString());

export default db;

/**
 * Wrap multiple operations in one transaction.
 * Usage: transaction(() => { stmt1.run(...); stmt2.run(...); })
 */
export function transaction(fn) {
  return db.transaction(fn)();
}
