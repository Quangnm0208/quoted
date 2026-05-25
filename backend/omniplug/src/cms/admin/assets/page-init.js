/**
 * page-init.js — bootstraps every admin HTML shell (/admin/*.html).
 *
 * 1. Resolve <body data-page=…> → page key
 * 2. Render the chrome (header/sidebar) via renderShell
 * 3. Await the async renderer for the page → inject HTML
 * 4. Wire interactive handlers (Save buttons, theme toggle, logout)
 *
 * Async note (M2): renderers used to be sync (string returns of mock
 * data). They are now async because each fetches from /api/admin/* —
 * `await renderPage(page)` is mandatory.
 */

import { renderShell } from './shell.js';
import { bindInteractions } from './interact.js';
import { pageTitle, renderPage } from './page-content.js';
import { bindPageContentHandlers } from './page-content-handlers.js';

const page = document.body.dataset.page || 'dashboard';
const activeTab = page === 'articleEdit' ? 'articles' : page;
const user = await renderShell(activeTab, pageTitle(page));

if (user) {
  const root = document.getElementById('pageRoot');
  // Show a loading state while the renderer fetches from /api/admin.
  root.innerHTML = '<div class="panel" style="text-align:center;padding:48px;color:var(--muted,#666);">Loading…</div>';
  try {
    root.innerHTML = await renderPage(page);
  } catch (err) {
    console.error('[page-init] renderer threw:', err);
    root.innerHTML = `<div class="panel" style="border-left:4px solid #d33;padding:16px;"><strong style="color:#d33;">Render error:</strong> ${err.message}</div>`;
  }
  bindInteractions();
  bindPageContentHandlers(root);
}
