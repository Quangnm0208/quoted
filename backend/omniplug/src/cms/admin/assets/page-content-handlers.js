/**
 * page-content-handlers.js — click/submit wiring for the admin pages
 * rendered in page-content.js (M2).
 *
 * Centralised here so the renderers stay pure HTML-string builders and
 * page-init.js has one well-named hook.
 *
 * Handlers wired:
 *   - `.js-save-section`   → PATCH /api/admin/pages/sections/:id
 *   - `.js-save-site`      → PATCH /api/admin/site/:key
 *
 * Each shows inline feedback (`[data-save-msg]`) + a global toast.
 */

import { api, toast } from './shell.js';

export function bindPageContentHandlers(root) {
  if (!root) return;

  root.addEventListener('click', async (event) => {
    const sectionBtn = event.target.closest('.js-save-section');
    if (sectionBtn) {
      event.preventDefault();
      await handleSaveSection(sectionBtn);
      return;
    }
    const siteBtn = event.target.closest('.js-save-site');
    if (siteBtn) {
      event.preventDefault();
      await handleSaveSiteConfig(siteBtn);
      return;
    }
    const revokeBtn = event.target.closest('.js-revoke-site');
    if (revokeBtn) {
      event.preventDefault();
      await handleRevokeSite(revokeBtn);
      return;
    }
    const articleSaveBtn = event.target.closest('.js-article-save');
    if (articleSaveBtn) {
      event.preventDefault();
      await handleArticleSave(articleSaveBtn);
      return;
    }
    const articleActionBtn = event.target.closest('.js-article-action');
    if (articleActionBtn) {
      event.preventDefault();
      await handleArticleAction(articleActionBtn);
      return;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// Article editor (article-edit.html) — save / publish / schedule / archive
// ─────────────────────────────────────────────────────────────────────

function collectArticleForm() {
  const $ = (id) => document.getElementById(id);
  return {
    title: $('f-title')?.value?.trim() || '',
    slug: $('f-slug')?.value?.trim() || undefined,  // undefined = let server auto-generate
    excerpt: $('f-excerpt')?.value || '',
    content_html: $('f-content')?.value || '',
    cover_media_id: $('f-cover-media-id')?.value ? Number($('f-cover-media-id').value) : null,
    content_type: $('f-content-type')?.value || 'article',
    seo_title: $('f-seo-title')?.value || '',
    seo_description: $('f-seo-description')?.value || '',
    canonical_url: $('f-canonical-url')?.value || '',
    og_title: $('f-og-title')?.value || '',
    og_description: $('f-og-description')?.value || '',
    schema_type: $('f-schema-type')?.value || 'Article',
    robots_index: !!$('f-robots-index')?.checked,
    robots_follow: !!$('f-robots-follow')?.checked,
  };
}

async function handleArticleSave(btn) {
  const form = btn.closest('#article-form') || document.getElementById('article-form');
  const id = form?.getAttribute('data-article-id');
  const mode = btn.getAttribute('data-mode') || 'draft';
  const msg = form?.querySelector('[data-save-msg]');
  const body = collectArticleForm();

  if (!body.title) {
    if (msg) { msg.textContent = 'Title is required.'; msg.style.color = '#c0392b'; }
    toast('Title is required', 'error');
    return;
  }

  setBusy(btn, true);
  if (msg) { msg.textContent = 'Saving…'; msg.style.color = ''; }
  try {
    let saved;
    if (id) {
      saved = await api(`/api/admin/articles/${id}`, { method: 'PATCH', body });
    } else {
      saved = await api('/api/admin/articles', { method: 'POST', body });
    }
    // If user clicked Publish, fire the publish endpoint after save.
    if (mode === 'publish' && saved.id) {
      saved = await api(`/api/admin/articles/${saved.id}/publish`, { method: 'POST' });
    }
    if (msg) {
      msg.textContent = `✓ Saved (status: ${saved.status}). Redirecting…`;
      msg.style.color = '#1f7a3f';
    }
    toast(mode === 'publish' ? 'Published' : 'Saved', 'success');
    // Redirect: if newly created, go to its edit URL so subsequent saves work.
    setTimeout(() => {
      if (saved.id && (!id || mode === 'publish')) {
        window.location.href = `/admin/article-edit.html?id=${saved.id}`;
      }
    }, 500);
  } catch (err) {
    if (msg) { msg.textContent = `Error: ${err.message}`; msg.style.color = '#c0392b'; }
    toast(`Save failed: ${err.message}`, 'error');
  } finally {
    setBusy(btn, false);
  }
}

async function handleArticleAction(btn) {
  const action = btn.getAttribute('data-action');
  const form = btn.closest('#article-form') || document.getElementById('article-form');
  const id = form?.getAttribute('data-article-id');
  const msg = form?.querySelector('[data-save-msg]');
  if (!id) return;

  let body = {};
  if (action === 'schedule') {
    const input = document.getElementById('f-scheduled-at');
    const v = input?.value;  // datetime-local format: "2026-05-30T15:00"
    if (!v) {
      toast('Pick a date/time first', 'error');
      return;
    }
    // datetime-local has no timezone; treat as local time, convert to ISO with Z
    body.scheduled_at = new Date(v).toISOString();
  } else if (action === 'archive') {
    if (!window.confirm('Archive this article? It will be hidden from the public site.')) return;
  }

  setBusy(btn, true);
  if (msg) { msg.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)}ing…`; msg.style.color = ''; }
  try {
    const result = await api(`/api/admin/articles/${id}/${action}`, { method: 'POST', body });
    if (msg) {
      msg.textContent = `✓ Done. New status: ${result.status}. Reloading…`;
      msg.style.color = '#1f7a3f';
    }
    toast(`Article ${action}d`, 'success');
    setTimeout(() => location.reload(), 600);
  } catch (err) {
    if (msg) { msg.textContent = `Error: ${err.message}`; msg.style.color = '#c0392b'; }
    toast(`${action} failed: ${err.message}`, 'error');
    setBusy(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────────────
// WP site revoke (wp-sites.html)
// ─────────────────────────────────────────────────────────────────────

async function handleRevokeSite(btn) {
  const id = btn.getAttribute('data-wp-site-id');
  const row = btn.closest('[data-wp-site-domain]');
  const domain = row?.getAttribute('data-wp-site-domain') || '(this site)';
  const reason = window.prompt(
    `Revoke plugin access for ${domain}?\n\nThis sets the site inactive + clears its JWT.\nThe customer must re-activate their license from the plugin to reconnect.\n\nReason (audit log):`,
    'operator-manual'
  );
  if (reason === null) return;
  setBusy(btn, true);
  try {
    await api(`/api/admin/quoted/wp-sites/${id}/revoke`, { method: 'POST', body: { reason } });
    toast(`Revoked ${domain}`, 'success');
    setTimeout(() => location.reload(), 600);
  } catch (err) {
    toast(`Revoke failed: ${err.message}`, 'error');
    setBusy(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Section save (pages.html, sections.html)
// ─────────────────────────────────────────────────────────────────────

async function handleSaveSection(btn) {
  const card = btn.closest('[data-section-id]');
  if (!card) return;
  const id = card.getAttribute('data-section-id');
  const msg = card.querySelector('[data-save-msg]');

  const titleInput = card.querySelector('input[data-field="title"]');
  const subtitleInput = card.querySelector('input[data-field="subtitle"]');
  const payloadInput = card.querySelector('textarea[data-field="payload"]');
  const visibleInput = card.querySelector('input[data-field="is_visible"]');

  // Parse payload JSON safely — bail out before hitting the API on bad input.
  let payload = {};
  if (payloadInput && payloadInput.value.trim()) {
    try {
      payload = JSON.parse(payloadInput.value);
    } catch (err) {
      if (msg) {
        msg.textContent = `Payload không phải JSON hợp lệ: ${err.message}`;
        msg.style.color = '#c0392b';
      }
      toast('Payload JSON lỗi — xem inline message', 'error');
      return;
    }
  }

  const body = {
    title: titleInput ? titleInput.value : undefined,
    subtitle: subtitleInput ? subtitleInput.value : undefined,
    payload,
    is_visible: visibleInput ? visibleInput.checked : undefined,
  };

  setBusy(btn, true);
  if (msg) { msg.textContent = 'Saving…'; msg.style.color = ''; }
  try {
    const updated = await api(`/api/admin/pages/sections/${id}`, { method: 'PATCH', body });
    if (msg) {
      const stamp = (updated && updated.updated_at) ? updated.updated_at : new Date().toISOString();
      msg.textContent = `✓ Saved at ${stamp}. Frontend cache 60s — hard-refresh (Cmd-Shift-R) để thấy ngay.`;
      msg.style.color = '#1f7a3f';
    }
    toast('Section đã lưu', 'success');
  } catch (err) {
    if (msg) {
      msg.textContent = `Lỗi: ${err.message}`;
      msg.style.color = '#c0392b';
    }
    toast(`Lưu thất bại: ${err.message}`, 'error');
  } finally {
    setBusy(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Site config save (site.html)
// ─────────────────────────────────────────────────────────────────────

async function handleSaveSiteConfig(btn) {
  const row = btn.closest('[data-config-key]');
  if (!row) return;
  const key = row.getAttribute('data-config-key');
  const input = row.querySelector('input[data-field="value"]');
  const msg = row.querySelector('[data-save-msg]');
  if (!input) return;

  setBusy(btn, true);
  if (msg) { msg.textContent = 'Saving…'; msg.style.color = ''; }
  try {
    // Backend uses PUT (full upsert) for site config keys; PATCH is not wired.
    const updated = await api(`/api/admin/site/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { value: input.value },
    });
    if (msg) {
      const stamp = (updated && updated.updated_at) ? updated.updated_at : new Date().toISOString();
      msg.textContent = `✓ Saved at ${stamp}.`;
      msg.style.color = '#1f7a3f';
    }
    toast(`Site config ${key} đã lưu`, 'success');
  } catch (err) {
    if (msg) {
      msg.textContent = `Lỗi: ${err.message}`;
      msg.style.color = '#c0392b';
    }
    toast(`Lưu thất bại: ${err.message}`, 'error');
  } finally {
    setBusy(btn, false);
  }
}

function setBusy(btn, busy) {
  if (busy) {
    btn.setAttribute('disabled', 'disabled');
    btn.dataset.origText = btn.textContent;
    btn.textContent = 'Saving…';
  } else {
    btn.removeAttribute('disabled');
    if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
  }
}
