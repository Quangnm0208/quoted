/* ───────────────────────────────────────────────────────────
 * Quoted — Checkout CTA wiring.
 *
 * Any element with [data-checkout-plan="<plan-id>"] becomes a button
 * that POSTs to {API_BASE_URL}/api/payments/checkout and redirects to
 * the returned hosted Lemon Squeezy checkout URL.
 *
 * Configuration: shared.js exposes window.QuotedSite.apiBaseUrl. If unset,
 * checkout CTAs degrade to their original href (which is the WordPress.org
 * Free install page — safe fallback for "API not configured yet").
 * ─────────────────────────────────────────────────────────── */

(function () {
  const els = document.querySelectorAll('[data-checkout-plan]');
  if (els.length === 0) return;

  const API = (window.QuotedSite && window.QuotedSite.apiBaseUrl) || '';
  if (!API) {
    // No API configured — leave the existing href in place (graceful degrade
    // to the WP.org Free install page).
    return;
  }

  els.forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const plan = el.getAttribute('data-checkout-plan');
      if (!plan) return;

      // Visual feedback — we don't have a spinner library, so we just
      // disable the click for the duration and toggle a class.
      el.classList.add('is-loading');
      const originalText = el.textContent;
      try {
        const res = await fetch(API + '/api/payments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || !body.checkout_url) {
          const code = body && body.error && body.error.code ? body.error.code : `HTTP ${res.status}`;
          el.textContent = `Unavailable (${code})`;
          setTimeout(() => { el.textContent = originalText; el.classList.remove('is-loading'); }, 2500);
          return;
        }
        // Redirect to LS hosted checkout in the same tab.
        window.location.href = body.checkout_url;
      } catch (err) {
        el.textContent = 'Network error';
        setTimeout(() => { el.textContent = originalText; el.classList.remove('is-loading'); }, 2500);
      }
    });
  });
})();
