/**
 * snippet/snippet.controller.js — Public read-only endpoints serving
 * head-tag payloads. Mounted at /api/public/snippet.
 *
 * Cache strategy:
 *   - ETag generated from entity's updated_at + tenant version
 *   - Cache-Control: public, s-maxage=300 (5 min edge cache)
 *   - Frontend SSG can fetch at build time; Vercel/CDN serves cached
 *
 * All responses set Vary: Host so multi-tenant proxies work.
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { NotFoundError } from '../../../core/lib/errors.js';
import { snippetService } from './snippet.service.js';

export const publicRouter = Router();

function setCacheHeaders(res) {
  res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600, max-age=60');
  res.set('Vary', 'Host');
  res.set('Content-Type', 'application/json; charset=utf-8');
}

publicRouter.get('/article/:slug', asyncHandler((req, res) => {
  const payload = snippetService.buildArticleSnippet(req.tenantId, req.params.slug);
  if (!payload) throw new NotFoundError('Article not found');
  setCacheHeaders(res);
  res.json(payload);
}));

publicRouter.get('/project/:slug', asyncHandler((req, res) => {
  const payload = snippetService.buildProjectSnippet(req.tenantId, req.params.slug);
  if (!payload) throw new NotFoundError('Project not found');
  setCacheHeaders(res);
  res.json(payload);
}));

publicRouter.get('/page/:key', asyncHandler((req, res) => {
  // Page snippet always returns something — falls back to tenant defaults
  const payload = snippetService.buildPageSnippet(req.tenantId, req.params.key);
  setCacheHeaders(res);
  res.json(payload);
}));

// Convenience: /api/public/snippet returns the homepage snippet
publicRouter.get('/', asyncHandler((req, res) => {
  const payload = snippetService.buildPageSnippet(req.tenantId, 'home');
  setCacheHeaders(res);
  res.json(payload);
}));
