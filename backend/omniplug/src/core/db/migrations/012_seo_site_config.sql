-- =====================================================================
-- v1.4.1 SEO/GEO Site Config Keys (Migration 012)
--
-- Adds optional but recommended site_config keys consumed by the seo module.
-- All values default empty — the SEO generators degrade gracefully when keys
-- are missing (e.g., no logo → no logo in JSON-LD).
--
-- Why seed these as empty rather than NOT INSERT:
--   Admins editing site config in the UI need to see the keys to know they
--   exist. The pages.html admin reads from site_config — empty rows show up
--   as "click to fill in", which is the desired UX.
--
-- Safety: INSERT OR IGNORE preserves any existing per-tenant overrides.
-- For multi-tenant installs this only seeds the default tenant; new tenants
-- created via tenants admin route will get these from the same template.
-- =====================================================================

INSERT OR IGNORE INTO site_config (tenant_id, config_key, config_value, label, description) VALUES
  (1, 'site.name',        '""', 'Tên website',        'Tên hiển thị trong JSON-LD Organization và RSS title'),
  (1, 'site.tagline',     '""', 'Tagline',            'Một câu mô tả ngắn, dùng cho llms.txt header'),
  (1, 'site.description', '""', 'Mô tả site',         'Meta description mặc định + llms.txt body'),
  (1, 'site.logo',        '""', 'URL logo',           'Absolute URL của logo, dùng trong Organization JSON-LD'),
  (1, 'seo.description',  '""', 'SEO description',    'Override khi site.description không phù hợp cho SEO'),
  (1, 'contact.phone',    '""', 'Hotline',            'Số điện thoại chính, dùng trong ContactPoint JSON-LD'),
  (1, 'contact.address',  '""', 'Địa chỉ',            'Địa chỉ trụ sở, dùng trong PostalAddress JSON-LD'),
  (1, 'social.facebook',  '""', 'Facebook URL',       'Link fanpage, dùng trong Organization.sameAs'),
  (1, 'social.zalo',      '""', 'Zalo OA URL',        'Link Zalo Official Account'),
  (1, 'social.youtube',   '""', 'YouTube URL',        'Link kênh YouTube'),
  (1, 'social.linkedin',  '""', 'LinkedIn URL',       'Link LinkedIn company page'),
  (1, 'social.instagram', '""', 'Instagram URL',      'Link Instagram');
