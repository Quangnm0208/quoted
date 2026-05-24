-- =====================================================================
-- Default tenant domain placeholder
--
-- In production, resolveTenantFromHost is strict and does not fallback to
-- tenant 1. v1.2.0 keeps migrations environment-neutral; the runtime
-- migration runner bootstraps tenant 1 from TENANT_DEFAULT_DOMAIN or
-- FLY_APP_NAME after SQL migrations complete.
-- =====================================================================

UPDATE tenants
SET updated_at = updated_at
WHERE id = 1;
