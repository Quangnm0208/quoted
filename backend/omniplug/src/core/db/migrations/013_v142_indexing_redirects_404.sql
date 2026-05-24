-- =====================================================================
-- v1.4.2 — IndexNow / Redirections / 404 Monitor / Media SEO Schema
--
-- Four new tables, all tenant-scoped via tenant_id with ON DELETE CASCADE.
-- All columns are minimal at first; later versions can ADD COLUMN.
--
-- Performance principles applied here:
--   - Tight indexes only on hot-read paths.
--   - integer/text only; no BLOB or large TEXT.
--   - Soft-delete pattern (deleted_at) reused only for redirections because
--     URL rules sometimes need archive + restore. 404 logs and indexing logs
--     are deleted hard after retention window.
--
-- Why these tables in one migration instead of four:
--   They ship together in v1.4.2. Splitting would mean four migrate steps
--   for the same release, more state-machine risk, no rollback benefit.
-- =====================================================================

-- =====================================================================
-- 1. INDEXING_LOG — IndexNow submission audit trail
-- =====================================================================
-- Why a log table at all:
--   IndexNow is fire-and-forget. Without a log, admins have no idea
--   whether the URL was actually pushed or whether Bing rejected it.
--   Keeping a log lets the admin UI show "last 50 submissions, status".
--
-- Retention: pruned at startup based on INDEXING_LOG_RETENTION_DAYS
-- (same pattern as audit_log; default 90 days).
CREATE TABLE IF NOT EXISTS indexing_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url             TEXT    NOT NULL,
  provider        TEXT    NOT NULL DEFAULT 'indexnow',  -- 'indexnow' | future 'google' | 'bing'
  status_code     INTEGER,                              -- HTTP code from provider (200/202/400/429/...)
  status          TEXT    NOT NULL DEFAULT 'pending'    -- 'pending' | 'success' | 'failed' | 'throttled'
                  CHECK (status IN ('pending','success','failed','throttled')),
  error_message   TEXT,
  is_manual       INTEGER NOT NULL DEFAULT 0,           -- 0 = automatic on publish, 1 = admin button
  submitted_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  responded_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_indexing_log_tenant_time
  ON indexing_log(tenant_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_indexing_log_url
  ON indexing_log(tenant_id, url);

-- =====================================================================
-- 2. REDIRECTIONS — 301/302/307/308/410/451 rules
-- =====================================================================
-- Why match_type instead of pure regex:
--   regex is powerful but two practical risks:
--     1. ReDoS — a malicious admin (or copy-paste mistake) can write a
--        catastrophic-backtracking pattern that hangs the redirect
--        middleware on every request.
--     2. Confusion — most admins want "from /old to /new", not regex.
--   So we expose three match types, with regex gated behind a permission
--   in the controller. exact/starts_with handle 95% of real cases.
--
-- hits + last_accessed_at:
--   Lets admins find unused rules to clean up. Updated lazily (batched
--   every 60s in the redirections middleware) so reads do not block on
--   writes. Same pattern as 404 monitor below.
--
-- destination_url can be relative ("/du-an/new-slug") or absolute
-- ("https://example.com"). The middleware does NOT verify the
-- destination is alive; that is a v1.6 feature (link checker).
CREATE TABLE IF NOT EXISTS redirections (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_url        TEXT    NOT NULL,
  match_type        TEXT    NOT NULL DEFAULT 'exact'
                    CHECK (match_type IN ('exact','starts_with','regex')),
  destination_url   TEXT    NOT NULL DEFAULT '',
  status_code       INTEGER NOT NULL DEFAULT 301
                    CHECK (status_code IN (301,302,307,308,410,451)),
  is_active         INTEGER NOT NULL DEFAULT 1,
  hits              INTEGER NOT NULL DEFAULT 0,
  last_accessed_at  TEXT,
  -- auto_created = 1 when the system inserted this rule from a slug change
  -- on an article or project. Admins can still edit/delete; the flag is
  -- only used to show "Created automatically" in the UI.
  auto_created      INTEGER NOT NULL DEFAULT 0,
  source_entity     TEXT,                                 -- 'article' | 'project' | null
  source_entity_id  INTEGER,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at        TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, source_url, match_type)
);

CREATE INDEX IF NOT EXISTS idx_redirections_active
  ON redirections(tenant_id, is_active, match_type)
  WHERE deleted_at IS NULL AND is_active = 1;

-- =====================================================================
-- 3. ERROR_404_LOG — Aggregated 404 event log
-- =====================================================================
-- AGGREGATED, not per-event. Storing every 404 is wasteful (bot scans
-- send hundreds of `/wp-admin`, `/.env`, `/.git/config` requests per
-- minute). The middleware aggregates by (tenant, uri) and increments
-- hits + bumps last_seen_at. The hot path becomes ONE UPDATE not many
-- INSERTs.
--
-- referer + user_agent are saved from the most recent hit only — useful
-- enough to know who is sending the broken link, not enough to bloat the
-- table.
--
-- ignored: an admin can mark a row as ignored (favicon, /.well-known/...)
-- so it stops showing in the dashboard but the hit counter still grows.
CREATE TABLE IF NOT EXISTS error_404_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uri             TEXT    NOT NULL,
  hits            INTEGER NOT NULL DEFAULT 1,
  last_referer    TEXT,
  last_user_agent TEXT,
  is_ignored      INTEGER NOT NULL DEFAULT 0,
  first_seen_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, uri)
);

CREATE INDEX IF NOT EXISTS idx_error_404_recency
  ON error_404_log(tenant_id, is_ignored, last_seen_at DESC);

-- =====================================================================
-- 4. MEDIA SEO — extend the existing media table
-- =====================================================================
-- We do NOT add a new table; we extend `media` with two columns:
--   alt_status     — 'missing' | 'auto' | 'manual'
--   alt_suggested  — pre-computed suggestion from filename or title
--
-- Rationale:
--   - 1-to-1 with media → join cost zero.
--   - alt_status lets the admin UI badge images that still need work.
--   - alt_suggested is filled at upload time from filename + tenant name;
--     admin can accept (1-click) or override.
--
-- Both columns nullable so existing rows are unaffected.
ALTER TABLE media ADD COLUMN alt_status TEXT NOT NULL DEFAULT 'missing'
  CHECK (alt_status IN ('missing','auto','manual'));
ALTER TABLE media ADD COLUMN alt_suggested TEXT NOT NULL DEFAULT '';

-- Backfill: rows that already have non-empty alt are 'manual'.
UPDATE media SET alt_status = 'manual' WHERE alt != '';

-- =====================================================================
-- 5. SITE_CONFIG — seed IndexNow key placeholder for default tenant
-- =====================================================================
-- The IndexNow key is generated at first use (see indexing.service.js).
-- We seed an empty row so the admin sees the key in the UI.
INSERT OR IGNORE INTO site_config (tenant_id, config_key, config_value, label, description) VALUES
  (1, 'indexnow.key', '""', 'IndexNow API key',
     'Auto-generated 32-char key. Do not change unless rotating after a leak.'),
  (1, 'indexnow.enabled', 'true', 'Bật IndexNow',
     'Tự động submit URL mới publish lên Bing/Yandex.'),
  (1, 'indexing.auto_on_publish', 'true', 'Tự ping khi publish',
     'Article/project chuyển sang published → submit ngay.');
