-- Seed generic demo site configuration.

INSERT OR IGNORE INTO site_config (config_key, config_value, label, description) VALUES
  ('site.title',          '"Demo Project"',                                'Page title',          'Default SEO title for the sample tenant.'),
  ('site.description',    '"A sample landing page powered by OmniPlug CMS Core."', 'SEO description',   'Default SEO description.'),
  ('site.og_title',       '"Demo Project"',                                'OG title',            'Social sharing title.'),
  ('site.og_description', '"Sample tenant content for integration testing."', 'OG description',     'Social sharing description.'),
  ('site.og_image',       '"/uploads/hero-master.webp"',                  'OG image',            'Recommended size: 1200x630.'),

  ('hotline',             '"0900 000 000"',                                'Hotline',             'Displayed by sample frontends.'),

  ('social.facebook',     '"#"',                                           'Facebook URL',        ''),
  ('social.youtube',      '"#"',                                           'YouTube URL',         ''),
  ('social.tiktok',       '"#"',                                           'TikTok URL',          ''),
  ('social.instagram',    '"#"',                                           'Instagram URL',       ''),

  ('hero.eyebrow',        '"OMNIPLUG DEMO"',                               'Hero eyebrow',        ''),
  ('hero.cta_primary',    '"Contact us"',                                  'Primary CTA',         ''),
  ('hero.cta_secondary',  '"View details"',                                'Secondary CTA',       ''),

  ('counters',            '[{"label":"Pages","target":5,"suffix":"+"},{"label":"Articles","target":12,"suffix":"+"},{"label":"Projects","target":3,"suffix":"+"},{"label":"Lead forms","target":1,"suffix":""}]', 'Highlight counters', 'Generic demo counters.'),

  ('footer.address',      '"example.com"',                                 'Footer address',      ''),
  ('footer.copyright',    '"Demo Project © 2026"',                         'Copyright',           ''),
  ('footer.disclaimer',   '"Sample content for demo and integration only."', 'Disclaimer',         '');
