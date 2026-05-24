-- Migration 027: quoted_citations
--
-- AI citation tracking — schema defined now (Phase 0), populated by
-- Phase 2 polling cron. See docs/CITATION-TRACKING-SPEC.md for the algorithm.
--
-- tenant_id INTEGER (matches OmniPlug tenants(id)).

CREATE TABLE IF NOT EXISTS citations (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id            INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source               TEXT    NOT NULL,  -- 'perplexity'|'tavily'|'serper'|'user_submitted'
  query                TEXT    NOT NULL,
  cited_url            TEXT    NOT NULL,
  cited_url_canonical  TEXT    NOT NULL,
  cited_article_id     INTEGER,           -- nullable; FK to quoted_posts when slug matches
  response_excerpt     TEXT,
  confidence           REAL    NOT NULL,  -- 0.0 to 1.0
  dedup_key            TEXT    NOT NULL,  -- sha256(source|normalized_query|canonical_url)
  status               TEXT    NOT NULL DEFAULT 'active',  -- 'active'|'lost'
  first_seen_at        TEXT    NOT NULL,
  last_seen_at         TEXT    NOT NULL,
  lost_at              TEXT,
  verified             INTEGER NOT NULL DEFAULT 0,
  notified             INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_citations_tenant_status
  ON citations(tenant_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_citations_tenant_conf
  ON citations(tenant_id, confidence DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_citations_notify_queue
  ON citations(notified, confidence) WHERE notified = 0 AND status = 'active';
