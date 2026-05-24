-- =====================================================================
-- v1.4.4 hotfix - repair tenant domain normalization after migration 022.
--
-- 022 originally stripped at the first ":" before stripping URL schemes,
-- so values like https://example.com could become "https". This migration
-- is idempotent and keeps the active-domain unique index in place.
-- Rows already reduced to "http"/"https" cannot be reconstructed safely,
-- so they are nulled and must be re-entered by an operator.
-- =====================================================================

DROP INDEX IF EXISTS idx_tenants_domain_unique;

UPDATE tenants SET domain = LOWER(TRIM(domain)) WHERE domain IS NOT NULL;
UPDATE tenants SET domain = SUBSTR(domain, INSTR(domain, '://') + 3)
 WHERE domain IS NOT NULL AND INSTR(domain, '://') > 0;
UPDATE tenants SET domain = SUBSTR(domain, 1, INSTR(domain, '/') - 1)
 WHERE domain IS NOT NULL AND INSTR(domain, '/') > 0;
UPDATE tenants SET domain = SUBSTR(domain, 1, INSTR(domain, '?') - 1)
 WHERE domain IS NOT NULL AND INSTR(domain, '?') > 0;
UPDATE tenants SET domain = SUBSTR(domain, 1, INSTR(domain, '#') - 1)
 WHERE domain IS NOT NULL AND INSTR(domain, '#') > 0;
UPDATE tenants SET domain = SUBSTR(domain, 5)
 WHERE domain IS NOT NULL AND SUBSTR(domain, 1, 4) = 'www.';
UPDATE tenants SET domain = SUBSTR(domain, 1, INSTR(domain, ':') - 1)
 WHERE domain IS NOT NULL AND INSTR(domain, ':') > 0;
UPDATE tenants SET domain = NULL
 WHERE domain IS NOT NULL
   AND (
     TRIM(domain) IN ('', 'http', 'https')
     OR (domain != 'localhost' AND domain NOT LIKE '%.%')
   );

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_domain_unique
  ON tenants(domain)
  WHERE domain IS NOT NULL AND status = 'active';
