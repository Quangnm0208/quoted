-- Seed generic demo page sections.

INSERT OR IGNORE INTO page_sections
  (page_key, section_key, component_type, title, subtitle, payload_json, sort_order)
VALUES
  ('home', 'hero', 'hero_banner',
   'Demo Project',
   'Frontend-agnostic content served by OmniPlug CMS Core',
   '{"eyebrow":"OMNIPLUG DEMO","cta_primary":"Contact us","cta_secondary":"View details","cta_link":"#contact"}',
   10),

  ('home', 'features', 'feature_list',
   'Composable content blocks',
   'A neutral sample tenant for API integration and smoke testing.',
   '{"items":[{"icon":"content","title":"Content API","desc":"Pages, sections and articles for any frontend."},{"icon":"lead","title":"Lead capture","desc":"Public lead submission with tenant isolation."},{"icon":"media","title":"Media library","desc":"Tenant-scoped uploads and usage checks."}]}',
   20),

  ('home', 'stats', 'stat_grid',
   'Demo metrics',
   '',
   '{"counters":[{"label":"Pages","target":5,"suffix":"+"},{"label":"Articles","target":12,"suffix":"+"},{"label":"Projects","target":3,"suffix":"+"},{"label":"Lead forms","target":1,"suffix":""}]}',
   30),

  ('home', 'cta_bottom', 'cta_block',
   'Connect a frontend',
   'Use the public API surface to render this tenant in any UI stack.',
   '{"button_label":"Submit lead","button_link":"#contact"}',
   40);
