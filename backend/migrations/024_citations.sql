-- Migration 024: citations
-- AI citation tracking — populated by Phase 2 polling cron.
-- Schema designed up-front in Phase 0 so we don't migrate later.
--
-- See docs/CITATION-TRACKING-SPEC.md for the full algorithm.
--
-- @author Nguyễn Mạnh Quang
-- @date 2026-05-23

CREATE TABLE IF NOT EXISTS citations (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id            TEXT NOT NULL,
  source               TEXT NOT NULL,  -- 'perplexity'|'tavily'|'serper'|'user_submitted'
  query                TEXT NOT NULL,
  cited_url            TEXT NOT NULL,
  cited_url_canonical  TEXT NOT NULL,
  cited_article_id     INTEGER,        -- nullable; FK to articles when slug matches
  response_excerpt     TEXT,
  confidence           REAL NOT NULL,  -- 0.0 to 1.0
  dedup_key            TEXT NOT NULL,  -- sha256(source|normalized_query|canonical_url)
  status               TEXT NOT NULL DEFAULT 'active',  -- 'active'|'lost'
  first_seen_at        DATETIME NOT NULL,
  last_seen_at         DATETIME NOT NULL,
  lost_at              DATETIME,
  verified             INTEGER NOT NULL DEFAULT 0,
  notified             INTEGER NOT NULL DEFAULT 0,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_citations_tenant_status
  ON citations(tenant_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_citations_tenant_conf
  ON citations(tenant_id, confidence DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_citations_notify_queue
  ON citations(notified, confidence) WHERE notified = 0 AND status = 'active';
