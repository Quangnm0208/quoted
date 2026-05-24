/**
 * core/lib/roles.js - RBAC role registry.
 *
 * Single source of truth cho toan bo role logic.
 * Migration 011 da bo DB CHECK. File nay la gate duy nhat.
 *
 * Them role moi: them vao ALL_ROLES. KHONG can migration.
 * Bat login: them vao LOGIN_ENABLED_ROLES sau khi audit cac admin routes.
 * Tat role: bo khoi LOGIN_ENABLED_ROLES, KHONG bo khoi ALL_ROLES.
 */

export const ALL_ROLES = Object.freeze([
  // Active - login enabled
  'admin',           // Tenant admin: full CRUD tren data cua tenant
  'editor',          // Tenant editor: CRUD content, khong quan user/tenant
  'platform_admin',  // OmniPlug operator: quan ly tat ca tenants

  // Reserved - schema-ready, login blocked den v1.5 portal features
  'customer',
  'vendor',
  'b2b_partner',
]);

/**
 * Roles duoc phep login. Roles ngoai list -> 403 o /api/auth/login.
 * KHONG them role moi vao day ma chua audit admin routes.
 */
export const LOGIN_ENABLED_ROLES = Object.freeze([
  'admin',
  'editor',
  'platform_admin',
]);

export const canLogin = (role) => LOGIN_ENABLED_ROLES.includes(role);
export const isValidRole = (role) => ALL_ROLES.includes(role);

// CB-01 (F5): roles requiring platform_admin level to assign. Tenant admin
// MUST NOT be able to escalate themselves or others to these roles.
export const ELEVATED_ROLES = Object.freeze(['platform_admin']);
export const isElevatedRole = (role) => ELEVATED_ROLES.includes(role);
