-- =====================================================================
-- Migration 037: seed Quoted marketing-site page sections
--
-- The marketing site (frontend/index.html etc.) was static HTML up to
-- v0.4.0. Milestone 1 of the CMS-driven marketing rollout wires the home
-- hero through OmniPlug's existing page_sections engine so the operator
-- can edit copy from /admin/pages without code changes.
--
-- Tenant: id=1. In dev this is the localhost demo tenant; in production
-- it must be set to the marketing domain (see docs/DEPLOYMENT.md +
-- docs/CMS-FRONTEND-INTEGRATION.md).
--
-- Page key convention: `quoted_<route>` so the marketing pages do NOT
-- collide with OmniPlug's demo seed (`home/...` from migration 004).
--
-- Idempotent — uses INSERT OR IGNORE so re-running migrations doesn't
-- overwrite operator edits.
-- =====================================================================

INSERT OR IGNORE INTO page_sections
  (tenant_id, page_key, section_key, component_type, title, subtitle, payload_json, sort_order, is_visible)
VALUES
  -- ── HOME: hero ─────────────────────────────────────────────────────
  (1, 'quoted_home', 'hero', 'hero_banner',
   'When customers ask AI, be in the answer.',
   'Quoted is a small WordPress plugin that prepares your business site for AI search. Your services, FAQs, products, and updates — laid out in the clean structure modern AI assistants need to understand who you are and what you sell.',
   '{"eyebrow":"New · live on WordPress.org","cta_primary_label":"Install free plugin","cta_primary_url":"https://wordpress.org/plugins/quoted/","cta_secondary_label":"See it in action","cta_secondary_url":"#live-demo"}',
   10,
   1);
