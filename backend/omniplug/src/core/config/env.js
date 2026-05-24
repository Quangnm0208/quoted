/**
 * config/env.js — Environment variables (validated).
 *
 * Đọc từ process.env (Docker/Fly/Railway/local .env).
 * Validate ngay khi server start — fail-fast nếu thiếu biến quan trọng.
 *
 * Production checklist (BẮT BUỘC override):
 *   - JWT_SECRET: ít nhất 32 ký tự random
 *   - ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD: dùng cho seed user đầu tiên
 *   - CORS_ORIGIN: domain frontend (Vercel URL)
 */

function required(name) {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error('Missing required env var: ' + name);
  }
  return v;
}

function optional(name, defaultValue) {
  const v = process.env[name];
  return v && v.trim() !== '' ? v : defaultValue;
}

function int(name, defaultValue) {
  const v = process.env[name];
  if (!v) return defaultValue;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error('Env var ' + name + ' must be integer, got: ' + v);
  return n;
}

function bool(name, defaultValue) {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === 'true' || v === '1' || v === 'yes';
}

// In development, fall back to safe defaults so anh có thể npm start ngay.
// In production, ENV var được set qua Fly/Railway/Docker.
const isProd = process.env.NODE_ENV === 'production';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: int('PORT', 4000),

  // Industry vertical skin. Determines status enum + transitions on the
  // projects table + admin labels. Default 'real-estate' preserves v1.2
  // behavior. Valid values defined in src/industries/registry.js.
  INDUSTRY: optional('INDUSTRY', 'real-estate'),

  // DB
  DB_PATH: optional('DB_PATH', './data/cms.db'),
  DB_DEBUG: bool('DB_DEBUG', false),

  // Auth
  JWT_SECRET: isProd
    ? required('JWT_SECRET')
    : optional('JWT_SECRET', 'dev-only-secret-CHANGE-IN-PRODUCTION-min-32-chars'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '24h'),
  // 10 rounds: ~150ms tren shared-cpu (vs ~600ms voi 12). Still cryptographically strong.
  // Existing password hashes are NOT affected - bcrypt embeds rounds in hash string.
  BCRYPT_ROUNDS: int('BCRYPT_ROUNDS', 10),

  // Seed admin (chỉ dùng khi DB rỗng — script seed)
  ADMIN_EMAIL: isProd
    ? required('ADMIN_EMAIL')
    : optional('ADMIN_EMAIL', 'admin@omniplug.local'),
  ADMIN_INITIAL_PASSWORD: isProd
    ? required('ADMIN_INITIAL_PASSWORD')
    : optional('ADMIN_INITIAL_PASSWORD', 'ChangeMe123!'),
  ADMIN_DISPLAY_NAME: optional('ADMIN_DISPLAY_NAME', 'Admin'),

  // Upload
  UPLOAD_DIR: optional('UPLOAD_DIR', './uploads'),
  // Default 3 MB cho landing pages (reduced from earlier 10 MB baseline).
  // Có thể override qua env cho dự án nhiều ảnh lớn.
  UPLOAD_MAX_SIZE: int('UPLOAD_MAX_SIZE', 3 * 1024 * 1024),
  UPLOAD_PUBLIC_URL: optional('UPLOAD_PUBLIC_URL', '/uploads'),

  // Backup
  BACKUP_DIR: optional('BACKUP_DIR', './backups'),
  BACKUP_RETENTION_DAYS: int('BACKUP_RETENTION_DAYS', 7),
  AUDIT_LOG_RETENTION_DAYS: int('AUDIT_LOG_RETENTION_DAYS', 180),

  // CORS — comma-separated list. Production: bắt buộc set explicit.
  CORS_ORIGIN: isProd
    ? required('CORS_ORIGIN')
    : optional('CORS_ORIGIN', 'http://localhost:3000,http://localhost:5173,http://localhost:4000'),

  // Optional public backend host for default tenant bootstrap.
  // Example: cms.example.com. Use "skip" to disable runtime bootstrap.
  TENANT_DEFAULT_DOMAIN: optional('TENANT_DEFAULT_DOMAIN', ''),
  TENANT_DEFAULT_SLUG: optional('TENANT_DEFAULT_SLUG', 'demo'),
  TENANT_DEFAULT_NAME: optional('TENANT_DEFAULT_NAME', 'Demo Tenant'),

  // Rate limit cho /api/leads (public endpoint, dễ bị spam)
  LEAD_RATE_LIMIT_PER_HOUR: int('LEAD_RATE_LIMIT_PER_HOUR', 20),

  // Trust proxy headers (Fly/Railway set X-Forwarded-For). Set true khi behind LB.
  TRUST_PROXY: bool('TRUST_PROXY', isProd),

  FEATURE_ARTICLES: bool('FEATURE_ARTICLES', true),
  FEATURE_PROJECTS: bool('FEATURE_PROJECTS', true),
  FEATURE_LEADS: bool('FEATURE_LEADS', true),
  FEATURE_MEDIA: bool('FEATURE_MEDIA', true),
  FEATURE_SDK: bool('FEATURE_SDK', false),
  FEATURE_WEBHOOKS: bool('FEATURE_WEBHOOKS', false),
  FEATURE_API_KEYS: bool('FEATURE_API_KEYS', false),
  FEATURE_CRM: bool('FEATURE_CRM', false),
};

// Validate JWT_SECRET strength in production
if (isProd && env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

if (isProd && env.ADMIN_INITIAL_PASSWORD === 'ChangeMe123!') {
  throw new Error('ADMIN_INITIAL_PASSWORD must not be the default placeholder');
}

if (isProd && env.ADMIN_INITIAL_PASSWORD.length < 12) {
  throw new Error('ADMIN_INITIAL_PASSWORD must be at least 12 characters in production');
}
