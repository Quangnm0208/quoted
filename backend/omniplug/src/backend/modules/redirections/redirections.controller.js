/**
 * redirections/redirections.controller.js — HTTP layer for redirects.
 *
 * Three exports:
 *
 *   middleware  — mounted EARLY in server.js, before other routes.
 *                 Resolves tenant by Host, looks up rule, redirects if match.
 *                 Designed to be < 200µs end-to-end on cache hit.
 *
 *   adminRouter — mounted at /api/admin/redirections.
 *                 CRUD operations on rules.
 *
 *   subscribeAutoCreate — called once at boot. Listens to article/project
 *                 slug-change events and creates 301 rules automatically.
 *
 * Loop protection:
 *   We track a request-scope counter via the X-Forwarded-Redirect header
 *   to detect A → B → A loops. After 3 redirects the chain is aborted
 *   with a 508 Loop Detected. This is server-side — the browser also has
 *   its own loop detection but better to short-circuit early.
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { ValidationError, NotFoundError } from '../../../core/lib/errors.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { eventBus } from '../../../core/lib/eventBus.js';
import { tenancy } from '../../../core/lib/tenancy.js';
import { redirectionsRepository } from './redirections.repository.js';
import {
  lookup as cacheLookup,
  invalidate as cacheInvalidate,
  recordHit,
  isSafeRegex,
} from './redirections.cache.js';

// =====================================================================
// MIDDLEWARE — runs on every request before content rendering
// =====================================================================

const REDIRECT_HEADER = 'x-omniplug-redirect-count';
const MAX_REDIRECTS = 3;

/**
 * Express middleware. Skips API and admin paths entirely — they should
 * never be redirected. Only public-facing pages go through here.
 *
 * Contract: req.tenantId must already be resolved by an upstream
 * middleware (server.js mounts resolveTenantFromHost before this). If
 * it's not resolved, we silently skip — letting the request flow to
 * its normal terminal handler (which will 404 cleanly).
 *
 * Rationale: this middleware must NEVER be the one that terminates the
 * request with a 404 from a missing tenant. That responsibility belongs
 * to the standard tenant middleware so behavior stays consistent across
 * all routes.
 */
export function middleware(req, res, next) {
  // Bypass non-redirectable paths.
  const path = req.path || req.url || '';
  if (
    path.startsWith('/api/') ||
    path.startsWith('/admin/') ||
    path === '/sitemap.xml' ||
    path === '/robots.txt' ||
    path === '/llms.txt' ||
    path === '/feed.xml' ||
    path.endsWith('.txt')         // IndexNow key file, ads.txt, etc.
  ) {
    return next();
  }

  // Loop protection — count how many redirects this request has already gone
  // through via X-Forwarded-Redirect.
  const seenCount = parseInt(req.headers[REDIRECT_HEADER], 10) || 0;
  if (seenCount >= MAX_REDIRECTS) {
    return res.status(508).type('text/plain').send('Loop detected');
  }

  // If tenant not resolved upstream, skip. The actual tenant middleware
  // (resolveTenantFromHost) will then handle 404 in its normal way.
  if (typeof req.tenantId !== 'number') return next();

  return doRedirectLookup(req, res, next);
}

function doRedirectLookup(req, res, next) {
  if (typeof req.tenantId !== 'number') return next();

  const rule = cacheLookup(req.tenantId, req.path);
  if (!rule) return next();

  // Async hit tracking — does not block the response.
  recordHit(rule.id);

  // 410 Gone: no destination, just terminate.
  if (rule.status_code === 410) {
    res.status(410).type('text/plain').send('Gone');
    return;
  }
  // 451 Unavailable For Legal Reasons.
  if (rule.status_code === 451) {
    res.status(451).type('text/plain').send('Unavailable For Legal Reasons');
    return;
  }

  // Build destination URL. If absolute, use as-is; if relative, prepend nothing
  // (the redirect target is relative to the request's host by default).
  let destination = rule.destination_url || '/';

  // For starts_with rules, preserve the remainder of the path so that
  // /old-prefix/anything → /new-prefix/anything works automatically.
  if (rule.match_type === 'starts_with') {
    const norm = req.path.toLowerCase().replace(/\/$/, '') || '/';
    const src = rule.source_url.toLowerCase().replace(/\/$/, '') || '/';
    if (norm.startsWith(src)) {
      const remainder = req.path.slice(src.length);
      destination = (rule.destination_url || '').replace(/\/$/, '') + remainder;
    }
  }

  // Preserve query string if not already in destination.
  if (req.url.includes('?') && !destination.includes('?')) {
    const qs = req.url.slice(req.url.indexOf('?'));
    destination += qs;
  }

  res.set(REDIRECT_HEADER, String(seenCount(req) + 1));
  res.redirect(rule.status_code || 301, destination);
}

function seenCount(req) {
  return parseInt(req.headers[REDIRECT_HEADER], 10) || 0;
}

// =====================================================================
// ADMIN ROUTER
// =====================================================================

export const adminRouter = Router();
adminRouter.use(requireAuth);

const createSchema = z.object({
  source_url: z.string().min(1).max(500),
  match_type: z.enum(['exact', 'starts_with', 'regex']).optional(),
  destination_url: z.string().max(500).optional(),
  status_code: z.union([
    z.literal(301), z.literal(302), z.literal(307), z.literal(308),
    z.literal(410), z.literal(451),
  ]).optional(),
  is_active: z.boolean().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

adminRouter.get('/',
  requireRole('admin', 'editor', 'platform_admin'),
  asyncHandler((req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    res.json(redirectionsRepository.listAdminPaginated(req.tenantId, limit, offset));
  }),
);

adminRouter.get('/:id',
  requireRole('admin', 'editor', 'platform_admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const row = redirectionsRepository.findById(req.validated.params.id, req.tenantId);
    if (!row) throw new NotFoundError('Redirection not found');
    res.json(row);
  }),
);

adminRouter.post('/',
  requireRole('admin', 'platform_admin'),
  validate({ body: createSchema }),
  asyncHandler((req, res) => {
    const input = req.validated.body;
    if (input.match_type === 'regex' && !isSafeRegex(input.source_url)) {
      throw new ValidationError('Regex pattern rejected: too complex or unsafe');
    }
    // 410/451 don't need destination; everything else does.
    const sc = input.status_code || 301;
    if (![410, 451].includes(sc) && !input.destination_url) {
      throw new ValidationError('destination_url required for ' + sc + ' redirects');
    }
    const r = redirectionsRepository.create(req.tenantId, input, req.user.id);
    recordAudit(req, 'redirection.create', {
      entityType: 'redirection',
      entityId: r.lastInsertRowid,
      metadata: { source_url: input.source_url, status_code: sc },
    });
    eventBus.emit('redirection.changed', { tenant_id: req.tenantId });
    res.status(201).json({ id: r.lastInsertRowid });
  }),
);

adminRouter.put('/:id',
  requireRole('admin', 'platform_admin'),
  validate({ params: idParam, body: createSchema }),
  asyncHandler((req, res) => {
    const input = req.validated.body;
    if (input.match_type === 'regex' && !isSafeRegex(input.source_url)) {
      throw new ValidationError('Regex pattern rejected: too complex or unsafe');
    }
    const r = redirectionsRepository.update(req.validated.params.id, req.tenantId, input);
    if (r.changes === 0) throw new NotFoundError('Redirection not found');
    recordAudit(req, 'redirection.update', {
      entityType: 'redirection',
      entityId: req.validated.params.id,
    });
    eventBus.emit('redirection.changed', { tenant_id: req.tenantId });
    res.json({ ok: true });
  }),
);

adminRouter.delete('/:id',
  requireRole('admin', 'platform_admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const r = redirectionsRepository.softDelete(req.validated.params.id, req.tenantId);
    if (r.changes === 0) throw new NotFoundError('Redirection not found');
    recordAudit(req, 'redirection.delete', {
      entityType: 'redirection',
      entityId: req.validated.params.id,
    });
    eventBus.emit('redirection.changed', { tenant_id: req.tenantId });
    res.json({ ok: true });
  }),
);

// =====================================================================
// EVENT SUBSCRIBER — auto-create 301 on slug change
// =====================================================================

/**
 * When an article or project changes slug, automatically create a 301
 * from the old slug to the new one. This protects backlinks and social
 * shares from breaking.
 *
 * Listens to two contract topics:
 *   - article.slug_changed   payload: { tenant_id, entity_id, old_slug, new_slug }
 *   - project.slug_changed   payload: { tenant_id, entity_id, old_slug, new_slug }
 *
 * Tolerates events from existing modules that may not yet emit these
 * topics — see kb/11_redirections_module.md for the contract.
 */
function handleSlugChange(entityKind, urlPrefix) {
  return (payload) => {
    try {
      if (!payload || typeof payload.tenant_id !== 'number') return;
      if (!payload.old_slug || !payload.new_slug) return;
      if (payload.old_slug === payload.new_slug) return;

      const oldUrl = urlPrefix + payload.old_slug;
      const newUrl = urlPrefix + payload.new_slug;

      // Skip if a rule with the same source already exists.
      const existing = redirectionsRepository.findBySource(payload.tenant_id, oldUrl, 'exact');
      if (existing) return;

      redirectionsRepository.create(payload.tenant_id, {
        source_url: oldUrl,
        match_type: 'exact',
        destination_url: newUrl,
        status_code: 301,
        is_active: true,
        auto_created: true,
        source_entity: entityKind,
        source_entity_id: payload.entity_id || null,
      }, null);

      cacheInvalidate(payload.tenant_id);
    } catch (err) {
      console.warn('[redirections.subscriber] auto-create failed:', err.message);
    }
  };
}

export function subscribeAutoCreate() {
  for (const topic of ['article.slug_changed', 'project.slug_changed', 'redirection.changed']) {
    try { eventBus.registerTopic(topic); } catch {}
  }
  eventBus.on('article.slug_changed', handleSlugChange('article', '/articles/'));
  eventBus.on('project.slug_changed', handleSlugChange('project', '/projects/'));
  eventBus.on('redirection.changed', (p) => {
    if (p && typeof p.tenant_id === 'number') cacheInvalidate(p.tenant_id);
  });
}
