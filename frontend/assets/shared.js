/* ───────────────────────────────────────────────────────────
 * Quoted — Shared chrome: header, footer, mobile nav, tweaks
 * Standalone — no framework. Re-rendered on every page.
 * ─────────────────────────────────────────────────────────── */

(function() {
  // ── Site config (mirrors content/site.json) ──────────────
  const SITE = {
    name: 'Quoted',
    url: 'https://quotedeasy.com',
    wordpressPluginUrl: 'https://wordpress.org/plugins/quoted/',
    // Header nav — matches user spec
    nav: [
      { label: 'Product',       href: 'index.html#product',       section: 'product'      },
      { label: 'Use Cases',     href: 'index.html#use-cases',     section: 'use-cases'    },
      { label: 'How It Works',  href: 'index.html#how-it-works',  section: 'how-it-works' },
      { label: 'Pricing',       href: 'pricing.html'                                       },
      { label: 'FAQ',           href: 'faq.html'                                           },
      { label: 'Documentation', href: 'docs.html'                                          },
      { label: 'Changelog',     href: 'changelog.html'                                     },
    ],
    // Sitewide promo configuration — surface as both the top bar and the welcome popup.
    promo: {
      code: 'EARLYBIRD30',
      discount: '30%',
      tier: 'Pro',
      claimed: 17,
      total: 100,
      deadline: 'June 30',
      // Promo bar (top, dismissible)
      barEnabled: true,
      // Welcome popup (first-time visitor, dismissible, skipped on /docs)
      popupEnabled: true,
      popupDelayMs: 4500,
    },
    footer: [
      {
        title: 'Product',
        links: [
          { label: 'Features',  href: 'index.html#product' },
          { label: 'Use Cases', href: 'index.html#use-cases' },
          { label: 'Pricing',   href: 'pricing.html' },
          { label: 'Changelog', href: 'changelog.html' },
          { label: 'Download on WordPress.org', href: 'https://wordpress.org/plugins/quoted/', external: true },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'FAQ',           href: 'faq.html' },
          { label: 'Documentation', href: 'docs.html' },
          { label: 'Blog',          href: 'blog.html' },
          { label: 'Support',       href: 'mailto:support@quotedeasy.com' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'Live site', href: 'https://quotedeasy.com', external: true },
          { label: 'Privacy',   href: '#' },
          { label: 'Terms',     href: '#' },
          { label: 'Contact',   href: 'mailto:support@quotedeasy.com' },
        ],
      },
    ],
  };

  const LOGO_SVG = `
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0" y="0" width="32" height="32" rx="7" fill="var(--q-primary)"></rect>
      <circle cx="15" cy="15" r="7.5" fill="none" stroke="#fff" stroke-width="2.4"></circle>
      <path d="M19.2 18.4 c0.9 0.9 1.2 2.1 0.9 3.3 c-0.3 1.2 -1.1 2 -2.3 2.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"></path>
      <circle cx="20.2" cy="19.4" r="1.6" fill="var(--q-primary)"></circle>
    </svg>`;

  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isHome = (here === 'index.html' || here === '');

  // ── Header ───────────────────────────────────────────────
  function renderHeader() {
    const mount = document.querySelector('[data-include="header"]');
    if (!mount) return;

    const navLinks = SITE.nav.map(n => {
      const [pagePart] = n.href.split('#');
      const myPage = pagePart.toLowerCase();
      const active = (myPage === here || (isHome && myPage === 'index.html'));
      const isHashLink = n.href.includes('#');
      // Active on top-level page match (sections handled by scroll observer)
      const cls = active && !isHashLink ? 'active' : '';
      const sec = n.section ? ` data-section="${n.section}"` : '';
      return `<a href="${n.href}" class="${cls}"${sec}>${n.label}</a>`;
    }).join('');

    mount.outerHTML = `
      <header class="site-header">
        <div class="wrap row spread">
          <a href="index.html" class="brand" aria-label="Quoted home">
            ${LOGO_SVG}
            <span>Quoted</span>
          </a>
          <nav id="primary-nav">${navLinks}</nav>
          <div class="cta-row">
            <a href="${SITE.wordpressPluginUrl}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm hide-md">Start free</a>
            <a href="pricing.html" class="btn btn-primary btn-sm">Get Started</a>
            <button class="btn btn-secondary btn-sm mobile-toggle" aria-label="Menu" onclick="document.getElementById('mobile-nav')?.classList.toggle('open')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div id="mobile-nav" style="display:none;border-top:1px solid var(--q-border);padding:8px 24px 16px;">
          ${SITE.nav.map(n => `<a href="${n.href}" style="display:block;padding:12px 0;font-size:15px;color:var(--q-text);border-bottom:1px solid var(--q-border-soft);">${n.label}</a>`).join('')}
          <a href="${SITE.wordpressPluginUrl}" target="_blank" rel="noopener" style="display:block;padding:12px 0;font-size:15px;color:var(--q-primary);font-weight:500;">Start free →</a>
        </div>
      </header>
      <style>
        #mobile-nav.open { display: block !important; }
        @media (max-width: 980px) { .site-header .cta-row a.hide-md { display: none; } }
      </style>
    `;

    setupSmartAnchors();
    if (isHome) setupSectionObserver();
  }

  // Smooth-scroll same-page anchors; let cross-page anchors fall through.
  function setupSmartAnchors() {
    document.querySelectorAll('#primary-nav a[href*="#"], #mobile-nav a[href*="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        const [page, hash] = href.split('#');
        const targetPage = page.toLowerCase() || here;
        if (!hash) return;
        if (targetPage === here || (isHome && targetPage === 'index.html')) {
          // same page — smooth-scroll
          const target = document.getElementById(hash);
          if (target) {
            e.preventDefault();
            const top = target.getBoundingClientRect().top + window.scrollY - 72;
            window.scrollTo({ top, behavior: 'smooth' });
            history.replaceState(null, '', '#' + hash);
            document.getElementById('mobile-nav')?.classList.remove('open');
          }
        }
        // else: cross-page — browser handles navigation + auto-scroll to hash
      });
    });
  }

  // IntersectionObserver: highlight nav based on visible section (home only)
  function setupSectionObserver() {
    const navMap = {};
    document.querySelectorAll('#primary-nav a[data-section]').forEach(a => {
      navMap[a.dataset.section] = a;
    });
    const sections = Object.keys(navMap)
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (!sections.length) return;

    const setActive = (id) => {
      Object.entries(navMap).forEach(([sec, a]) => a.classList.toggle('active', sec === id));
    };

    const io = new IntersectionObserver((entries) => {
      // pick the topmost visible entry
      let best = null;
      entries.forEach(e => {
        if (e.isIntersecting) {
          if (!best || e.boundingClientRect.top < best.boundingClientRect.top) best = e;
        }
      });
      if (best) setActive(best.target.id);
    }, { rootMargin: '-72px 0px -55% 0px', threshold: [0.1, 0.5] });

    sections.forEach(s => io.observe(s));
  }

  // ── Footer ───────────────────────────────────────────────
  function renderFooter() {
    const mount = document.querySelector('[data-include="footer"]');
    if (!mount) return;

    const sections = SITE.footer.map(s => `
      <div>
        <h4>${s.title}</h4>
        <ul>
          ${s.links.map(l => `<li><a href="${l.href}"${l.external ? ' target="_blank" rel="noopener"' : ''}>${l.label}${l.external ? ' <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" style="display:inline;vertical-align:-1px;opacity:0.5;" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7M13 3 4 12"/></svg>' : ''}</a></li>`).join('')}
        </ul>
      </div>
    `).join('');

    mount.outerHTML = `
      <footer class="site-footer">
        <div class="wrap">
          <div class="grid">
            <div class="footer-brand">
              <a href="index.html" class="brand" style="display:inline-flex;align-items:center;gap:10px;font-weight:600;font-size:18px;letter-spacing:-0.02em;color:var(--q-text-strong);">
                ${LOGO_SVG}
                <span>Quoted</span>
              </a>
              <p style="margin-top:14px;max-width:34ch;font-size:14px;color:var(--q-text-muted);line-height:1.55;">
                A lightweight AI visibility layer for WordPress business sites — built to make AI assistants understand your products, services, and FAQs.
              </p>
              <div style="margin-top:18px;display:inline-flex;align-items:center;gap:8px;font-size:13px;padding:8px 12px;border:1px solid var(--q-border);border-radius:var(--q-r-pill);background:var(--q-surface);">
                <span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.18);"></span>
                <a href="${SITE.url}" target="_blank" rel="noopener" style="color:var(--q-text);font-weight:500;font-family:var(--q-font-mono);">${SITE.url.replace('https://','')}</a>
                <span style="color:var(--q-text-faint);">— live</span>
              </div>
              <div style="margin-top:18px;display:flex;gap:8px;">
                <a href="https://wordpress.org/plugins/quoted/" target="_blank" rel="noopener" aria-label="WordPress.org" class="social">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18.3c-4.6 0-8.3-3.7-8.3-8.3 0-1.2.3-2.4.7-3.4l4.6 12.6c-1.7-.8-3-2.7-3-3.2v-.7l4.3-11.7L13 16c0 .1.1.3.1.4-.4 0-1 .1-1.5.4-.4.3-.7.7-.7 1.2 0 .4.3.7.7.7 0 0 .1 0 .1-.1.5-.1 1.3-.5 1.8-.8.4.4 1 .9 1 1.5 0 .3-.3 1.1-.5 1.5h-.1c-.1-.1-.2 0-.2.1 0 .1.1.1.1.1.3 0 .9-.7 1.1-1.3.2-.4.7-1.5.7-1.5l1.2-3.4c1.1-2.7 1.4-4.5 1.4-4.9 0-.3-.1-.5-.2-.7l-.1-.1c1.2 2 1.8 4.3 1.8 6.7.1 4.6-3.6 8.3-8.2 8.3z"/></svg>
                </a>
                <a href="https://github.com/muahangngayvn/quoted" target="_blank" rel="noopener" aria-label="GitHub" class="social">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"/></svg>
                </a>
                <a href="mailto:support@quotedeasy.com" aria-label="Email" class="social">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </a>
              </div>
            </div>
            ${sections}
          </div>

          <div class="footer-cta">
            <div class="footer-cta-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>
            </div>
            <div class="footer-cta-copy">
              <h4>Ready to make your site AI-readable?</h4>
              <p>Install the Free plugin in under 5 minutes — no card, no account.</p>
            </div>
            <a href="${SITE.wordpressPluginUrl}" target="_blank" rel="noopener" class="footer-cta-btn">
              <span>Install free</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7M13 3 4 12"/></svg>
            </a>
          </div>

          <div class="meta">
            <p>© ${new Date().getFullYear()} Quoted. All rights reserved.</p>
            <p style="display:flex;gap:18px;align-items:center;">
              <span>Billing securely handled by Lemon Squeezy.</span>
              <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span>All systems operational</span>
            </p>
          </div>
        </div>
      </footer>
      <style>
        .site-footer .grid { grid-template-columns: 1.6fr 1fr 1fr 1fr; }
        .site-footer .social {
          width: 32px; height: 32px; border-radius: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--q-text-muted);
          background: var(--q-surface);
          border: 1px solid var(--q-border);
          transition: 120ms;
        }
        .site-footer .social:hover { color: var(--q-primary); border-color: var(--q-primary); }
        .site-footer .footer-cta {
          margin-top: 56px;
          padding: 24px 28px;
          background: linear-gradient(135deg, var(--q-primary-soft) 0%, var(--q-bg-soft) 100%);
          border: 1px solid var(--q-border);
          border-radius: var(--q-r-xl);
          display: flex; align-items: center; gap: 20px;
          flex-wrap: wrap;
          position: relative;
          overflow: hidden;
        }
        .site-footer .footer-cta::before {
          content: ""; position: absolute; inset: 0;
          background: radial-gradient(circle at 90% 50%, var(--q-primary-soft) 0%, transparent 60%);
          opacity: 0.6; pointer-events: none;
        }
        .site-footer .footer-cta > * { position: relative; }
        .site-footer .footer-cta-icon {
          width: 48px; height: 48px; flex: 0 0 auto;
          border-radius: 12px;
          background: var(--q-primary); color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px -8px var(--q-accent-ring);
        }
        .site-footer .footer-cta-copy { flex: 1; min-width: 220px; }
        .site-footer .footer-cta-copy h4 {
          font-size: 17px; font-weight: 600; color: var(--q-text-strong);
          margin: 0 0 4px; letter-spacing: -0.015em;
          text-transform: none; font-family: inherit;
        }
        .site-footer .footer-cta-copy p {
          font-size: 14px; color: var(--q-text-muted);
          margin: 0; line-height: 1.5;
        }
        .site-footer .footer-cta-btn {
          display: inline-flex; align-items: center; gap: 8px;
          height: 44px; padding: 0 20px;
          background: var(--q-text); color: var(--q-bg);
          border-radius: var(--q-r-md);
          font-size: 14px; font-weight: 500;
          flex-shrink: 0;
          transition: 160ms;
          box-shadow: 0 4px 12px -4px rgba(15,16,20,0.25);
        }
        [data-theme="dark"] .site-footer .footer-cta-btn { background: var(--q-primary); color: #fff; }
        .site-footer .footer-cta-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 18px -6px rgba(15,16,20,0.3); }
        .site-footer .footer-cta-btn svg { opacity: 0.8; }
        @media (max-width: 880px) {
          .site-footer .grid { grid-template-columns: 1fr 1fr; gap: 32px; }
          .site-footer .footer-brand { grid-column: 1 / -1; }
        }
      </style>
    `;
  }

  // ── Tweaks Panel ─────────────────────────────────────────
  const TWEAKS_KEY = 'quoted_tweaks_v1';
  const DEFAULT_TWEAKS = { accent: 'indigo', theme: 'light', density: 'normal', tilt: 1 };

  function getTweaks() {
    try {
      return Object.assign({}, DEFAULT_TWEAKS, JSON.parse(localStorage.getItem(TWEAKS_KEY) || '{}'));
    } catch (e) { return { ...DEFAULT_TWEAKS }; }
  }
  function setTweaks(patch) {
    const next = { ...getTweaks(), ...patch };
    localStorage.setItem(TWEAKS_KEY, JSON.stringify(next));
    applyTweaks(next);
    renderTweaksPanel();
    return next;
  }
  function applyTweaks(t) {
    const r = document.documentElement;
    if (t.accent === 'indigo') r.removeAttribute('data-accent');
    else r.setAttribute('data-accent', t.accent);
    if (t.theme === 'dark') r.setAttribute('data-theme', 'dark');
    else r.removeAttribute('data-theme');
    if (t.density === 'normal') r.removeAttribute('data-density');
    else r.setAttribute('data-density', t.density);
    r.style.setProperty('--q-tilt-scale', String(t.tilt));
  }
  window.QuotedTweaks = { get: getTweaks, set: setTweaks, apply: applyTweaks };

  function renderTweaksPanel() {
    let panel = document.getElementById('tweaks-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tweaks-panel';
      document.body.appendChild(panel);
    }
    const t = getTweaks();
    const accents = [
      { id: 'indigo', color: '#3b3fbf', label: 'Indigo' },
      { id: 'emerald', color: '#0e9466', label: 'Emerald' },
      { id: 'amber', color: '#b76f0b', label: 'Amber' },
      { id: 'slate', color: '#0f1014', label: 'Mono' },
    ];

    panel.innerHTML = `
      <div class="tweaks-head">
        <strong>Tweaks</strong>
        <button aria-label="Close" onclick="window.parent.postMessage({type:'__edit_mode_dismissed'},'*');document.getElementById('tweaks-panel').classList.remove('open');"
          style="color:var(--q-text-muted);font-size:18px;line-height:1;padding:2px 6px;">×</button>
      </div>

      <h5>Accent</h5>
      <div class="swatch-row">
        ${accents.map(a => `
          <button class="swatch ${t.accent === a.id ? 'active' : ''}" title="${a.label}"
            style="background:${a.color};"
            onclick="QuotedTweaks.set({accent:'${a.id}'})"></button>
        `).join('')}
      </div>

      <h5>Theme</h5>
      <div class="seg">
        <button class="${t.theme === 'light' ? 'active' : ''}" onclick="QuotedTweaks.set({theme:'light'})">Light</button>
        <button class="${t.theme === 'dark' ? 'active' : ''}" onclick="QuotedTweaks.set({theme:'dark'})">Dark</button>
      </div>

      <h5>Density</h5>
      <div class="seg">
        <button class="${t.density === 'cozy' ? 'active' : ''}" onclick="QuotedTweaks.set({density:'cozy'})">Cozy</button>
        <button class="${t.density === 'normal' ? 'active' : ''}" onclick="QuotedTweaks.set({density:'normal'})">Normal</button>
        <button class="${t.density === 'spacious' ? 'active' : ''}" onclick="QuotedTweaks.set({density:'spacious'})">Spacious</button>
      </div>

      <h5>Hero tilt</h5>
      <input type="range" min="0" max="2" step="0.25" value="${t.tilt}"
        oninput="QuotedTweaks.set({tilt: parseFloat(this.value)})"
        style="width:100%;accent-color:var(--q-primary);">
      <div class="row spread" style="font-size:11px;color:var(--q-text-faint);font-family:var(--q-font-mono);margin-top:2px;">
        <span>off</span><span>${t.tilt.toFixed(2)}×</span><span>2.0×</span>
      </div>
    `;
  }

  // Edit-mode protocol
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === '__activate_edit_mode') {
      renderTweaksPanel();
      document.getElementById('tweaks-panel')?.classList.add('open');
    } else if (e.data.type === '__deactivate_edit_mode') {
      document.getElementById('tweaks-panel')?.classList.remove('open');
    }
  });

  // ── Promo Bar (top, sitewide, dismissible) ───────────────
  function renderPromoBar() {
    if (!SITE.promo.barEnabled) return;
    if (localStorage.getItem('quoted_promo_bar_dismissed') === '1') return;

    const bar = document.createElement('div');
    bar.id = 'promo-bar';
    bar.innerHTML = `
      <div class="wrap promo-bar-inner">
        <span class="promo-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          Early-bird
        </span>
        <span class="promo-msg">
          <strong>${SITE.promo.discount} off ${SITE.promo.tier}</strong> for the first ${SITE.promo.total} agencies.
          <span class="promo-progress" aria-hidden="true">
            <span class="promo-progress-bar" style="--p:${(SITE.promo.claimed / SITE.promo.total * 100).toFixed(0)}%"></span>
          </span>
          <span class="promo-count">${SITE.promo.claimed}/${SITE.promo.total} claimed</span>
        </span>
        <span class="promo-code-wrap">
          <span class="promo-code-label">Code</span>
          <button class="promo-code" id="promo-copy" title="Copy code">
            <span>${SITE.promo.code}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </span>
        <a href="pricing.html" class="promo-cta">Claim →</a>
        <button class="promo-close" id="promo-close" aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
    document.body.insertBefore(bar, document.body.firstChild);

    document.getElementById('promo-close').addEventListener('click', () => {
      bar.style.transition = 'transform 240ms var(--q-ease), opacity 240ms var(--q-ease)';
      bar.style.transform = 'translateY(-100%)';
      bar.style.opacity = '0';
      setTimeout(() => bar.remove(), 260);
      localStorage.setItem('quoted_promo_bar_dismissed', '1');
    });
    document.getElementById('promo-copy').addEventListener('click', (e) => {
      navigator.clipboard?.writeText(SITE.promo.code);
      const btn = e.currentTarget;
      const orig = btn.firstElementChild.textContent;
      btn.firstElementChild.textContent = 'Copied ✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.firstElementChild.textContent = orig;
        btn.classList.remove('copied');
      }, 1400);
    });
  }

  // ── Welcome Popup (first visit, lazy) ────────────────────
  function renderWelcomePopup() {
    if (!SITE.promo.popupEnabled) return;
    if (localStorage.getItem('quoted_welcome_dismissed') === '1') return;
    if (here === 'docs.html') return; // skip in docs context
    if (localStorage.getItem('quoted_welcome_subscribed') === '1') return;

    const overlay = document.createElement('div');
    overlay.id = 'welcome-overlay';
    overlay.innerHTML = `
      <div id="welcome-popup" role="dialog" aria-label="Welcome offer">
        <button id="welcome-close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="welcome-art">
          <div class="welcome-mark">${LOGO_SVG}</div>
          <div class="welcome-orbits" aria-hidden="true"></div>
        </div>
        <div class="welcome-body">
          <span class="welcome-eyebrow">EARLY BIRD · ${SITE.promo.total - SITE.promo.claimed} spots left</span>
          <h3>Get ${SITE.promo.discount} off Pro for life.</h3>
          <p>One subscription, up to 5 WordPress sites. Plus a short weekly note on AI search and a heads-up on each release.</p>
          <form id="welcome-form">
            <input type="email" name="email" placeholder="you@company.com" required autocomplete="email">
            <button type="submit" class="btn btn-primary">Claim code</button>
          </form>
          <div id="welcome-success" hidden>
            <div class="success-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <strong>You're in.</strong> Your code:
              <code id="welcome-code">${SITE.promo.code}</code>
              <button id="welcome-copy" type="button" title="Copy">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            <p class="success-note">Apply at checkout on the <a href="pricing.html">Pricing page</a>. We also emailed it to you.</p>
          </div>
          <p class="welcome-fine">No card. Unsubscribe in one click.</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 220);
      localStorage.setItem('quoted_welcome_dismissed', '1');
    };
    document.getElementById('welcome-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && document.getElementById('welcome-overlay')) {
        close(); document.removeEventListener('keydown', esc);
      }
    });

    document.getElementById('welcome-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const success = document.getElementById('welcome-success');
      form.style.display = 'none';
      success.hidden = false;
      localStorage.setItem('quoted_welcome_subscribed', '1');
    });
    document.getElementById('welcome-copy')?.addEventListener('click', (e) => {
      navigator.clipboard?.writeText(SITE.promo.code);
      const btn = e.currentTarget;
      btn.classList.add('copied');
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    });

    // Reveal after delay
    setTimeout(() => overlay.classList.add('open'), SITE.promo.popupDelayMs);
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    applyTweaks(getTweaks());
    renderPromoBar();
    renderHeader();
    renderFooter();
    renderWelcomePopup();
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
