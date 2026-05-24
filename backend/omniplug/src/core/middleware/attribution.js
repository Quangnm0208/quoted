/**
 * core/middleware/attribution.js — Forced "Powered by OmniPlug" attribution.
 *
 * Tier behavior:
 *   L1 (community)  — X-Powered-By: OmniPlug CMS Core (Community)
 *                     X-Attribution-Url: https://omniplug.com
 *                     Plus: a script tag injected on /admin/ pages to
 *                     show the badge. Cannot be stripped.
 *   L2 (lite)       — X-Powered-By header only, badge optional
 *   L3 (standard)   — Header only, no badge
 *   pro / pro_plus  — Headers stripped entirely
 *
 * Customers on community CAN technically remove the header with their
 * own reverse proxy, but that breaks the license terms. The header is
 * tamper-evident, not tamper-proof.
 */

import { attributionLevel } from '../lib/planQuotas.js';

export function attributionHeaders(req, res, next) {
  // Default plan = community (when no license activated)
  const plan = req.licensePlan || (req.tenant && req.tenant.plan_cached) || 'community';
  const level = attributionLevel(plan);

  if (level === null) {
    // Pro / pro_plus — strip any inherited X-Powered-By
    res.removeHeader('X-Powered-By');
    return next();
  }

  // L1, L2, L3 — set headers
  const planLabel = {
    L1: 'OmniPlug CMS Core (Community)',
    L2: 'OmniPlug CMS Core (Lite)',
    L3: 'OmniPlug CMS Core',
  }[level] || 'OmniPlug CMS Core';

  res.setHeader('X-Powered-By', planLabel);
  res.setHeader('X-Attribution-Url', 'https://omniplug.com');
  res.setHeader('X-Attribution-Level', level);

  next();
}
