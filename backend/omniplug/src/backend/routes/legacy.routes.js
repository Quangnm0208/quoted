/**
 * routes/legacy.routes.js
 *
 * Single boundary for legacy-compatible routes. New code should mount only
 * /api/public/* and /api/admin/*; legacy endpoints stay here until previous release removal.
 */

import { Router } from 'express';

import { requireAuth, optionalAuth } from '../../core/middleware/auth.js';
import { resolveTenantLegacy } from '../../core/middleware/tenant.js';

import { legacyRouter as articlesLegacy } from '../modules/articles/articles.controller.js';
import { legacyRouter as projectsLegacy } from '../modules/projects/projects.controller.js';
import { legacyRouter as siteLegacy } from '../modules/site/site.controller.js';
import { legacyRouter as leadsLegacy } from '../modules/leads/leads.controller.js';
import { legacyRouter as mediaLegacy } from '../modules/media/media.controller.js';
import { publicRouter as pagesPublic } from '../modules/pages/pages.controller.js';
import usersAdmin from '../modules/users/users.controller.js';

export const legacyRouter = Router();

legacyRouter.use(optionalAuth);
legacyRouter.use(resolveTenantLegacy);

legacyRouter.use('/articles', articlesLegacy);
legacyRouter.use('/projects', projectsLegacy);
legacyRouter.use('/site', siteLegacy);
legacyRouter.use('/leads', leadsLegacy);
legacyRouter.use('/media', mediaLegacy);
legacyRouter.use('/pages', pagesPublic);

// Users legacy keeps explicit auth for legacy clients.
legacyRouter.use('/users', requireAuth, usersAdmin);

export default legacyRouter;
