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
  });
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
