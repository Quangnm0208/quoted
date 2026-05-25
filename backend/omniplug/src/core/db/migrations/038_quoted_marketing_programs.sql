-- =====================================================================
-- Migration 038: seed "programs" (promotions) section header on quoted_home.
--
-- Companion to 037. The promotions/programs section at the bottom of
-- frontend/index.html ("Ways to pay less. Sometimes nothing at all.")
-- is now hydratable for its HEADER text (eyebrow chip, heading, lead
-- paragraph). The 6 program CARDS underneath stay static for now — they
-- need a list-renderer in cms.js (deferred to milestone 2).
--
-- Idempotent: INSERT OR IGNORE skips if the row already exists.
-- =====================================================================

INSERT OR IGNORE INTO page_sections
  (tenant_id, page_key, section_key, component_type, title, subtitle, payload_json, sort_order, is_visible)
VALUES
  (1, 'quoted_home', 'programs', 'rich_text',
   'Ways to pay less. Sometimes nothing at all.',
   'Discounts and partnerships we actually mean. No "limited-time offer that resets every Tuesday."',
   '{"eyebrow":"Programs"}',
   90,
   1);
