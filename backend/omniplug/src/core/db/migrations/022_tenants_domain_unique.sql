-- =====================================================================
-- v1.4.4 — UNIQUE constraint cho tenants.domain (HR-03, Migration 022).
--
-- Audit finding: 2 tenant active có thể share cùng domain → Host header
-- routing không deterministic + license signed_for có thể match nhiều
-- tenant. Cần normalize + UNIQUE active-only (cho phép archived tenant
-- tái sử dụng domain sau khi archive).
--
-- Idempotent: dùng IF NOT EXISTS / DROP IF EXISTS.
-- Fail-fast: nếu detect duplicate sau normalize, CREATE UNIQUE INDEX
-- sẽ throw → migration abort, operator manual resolve.
-- =====================================================================

-- Step 1: normalize existing rows (lowercase, strip scheme/path/www/port).
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

-- Step 2: drop legacy non-unique index, add UNIQUE partial index for active tenants
DROP INDEX IF EXISTS idx_tenants_domain;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_domain_unique
  ON tenants(domain)
  WHERE domain IS NOT NULL AND status = 'active';
