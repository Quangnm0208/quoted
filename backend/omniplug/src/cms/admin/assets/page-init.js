import { renderShell } from './shell.js';
import { bindInteractions } from './interact.js';
import { pageTitle, renderPage } from './page-content.js';

const page = document.body.dataset.page || 'dashboard';
const activeTab = page === 'articleEdit' ? 'articles' : page;
const user = await renderShell(activeTab, pageTitle(page));

if (user) {
  const root = document.getElementById('pageRoot');
  root.innerHTML = renderPage(page);
  bindInteractions();
}
