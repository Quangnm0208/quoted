-- Migration 036: link wp_sites to commercial layer
--
-- wp_sites was originally tenant-scoped only (per the Phase 0 design where
-- license = qtd_live_* envelope). The commercial layer adds:
--   customer_id  — which LS customer owns this WP install
--   license_id   — which license activation registered this site
-- Both nullable so the column can be backfilled on first activate.
--
-- SQLite has no "ADD COLUMN IF NOT EXISTS" — the migrate.js transaction
-- guarantees this runs exactly once (tracked in schema_migrations).

ALTER TABLE wp_sites ADD COLUMN customer_id         INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE wp_sites ADD COLUMN customer_license_id INTEGER REFERENCES customer_licenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wp_sites_customer ON wp_sites(customer_id);
CREATE INDEX IF NOT EXISTS idx_wp_sites_license  ON wp_sites(customer_license_id);
