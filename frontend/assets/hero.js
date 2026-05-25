/* ───────────────────────────────────────────────────────────
 * Quoted — Hero 3D parallax (cursor tilt + scroll drift)
 * Layered "document → markdown → AI answer" cards.
 *
 * Performance: the mousemove handler + rAF loop are gated behind an
 * IntersectionObserver — they only run while the hero is in the viewport.
 * Scroll past the fold and the loop stops, so mobile battery doesn't burn
 * on a section the user can no longer see.
 * ─────────────────────────────────────────────────────────── */

(function() {
  function init() {
    const stage = document.querySelector('[data-hero-3d]');
    if (!stage) return;
    const cards = stage.querySelectorAll('[data-tilt-layer]');
    if (!cards.length) return;

    const rect = () => stage.getBoundingClientRect();
    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;
    let rafId = null;
    let running = false;

    function tick() {
      curX += (targetX - curX) * 0.08;
      curY += (targetY - curY) * 0.08;
      const t = getComputedStyle(document.documentElement).getPropertyValue('--q-tilt-scale').trim();
      const tilt = parseFloat(t || '1');
      cards.forEach((c) => {
        const depth = parseFloat(c.getAttribute('data-depth') || '1');
        const rx = (-curY * 6 * tilt * depth).toFixed(2);
        const ry = (curX * 8 * tilt * depth).toFixed(2);
        const tx = (curX * 12 * tilt * depth).toFixed(2);
        const ty = (curY * 10 * tilt * depth).toFixed(2);
        const base = c.getAttribute('data-base-transform') || '';
        c.style.transform = `${base} translate3d(${tx}px, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
      rafId = requestAnimationFrame(tick);
    }

    function onMove(e) {
      const r = rect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      targetX = (e.clientX - cx) / (r.width / 2);
      targetY = (e.clientY - cy) / (r.height / 2);
      targetX = Math.max(-1.2, Math.min(1.2, targetX));
      targetY = Math.max(-1.2, Math.min(1.2, targetY));
    }
    function onLeave() {
      targetX = 0; targetY = 0;
    }

    function start() {
      if (running) return;
      running = true;
      window.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseleave', onLeave);
      rafId = requestAnimationFrame(tick);
    }
    function stop() {
      if (!running) return;
      running = false;
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    // Idle float runs as pure CSS animation — no JS cost when off-screen
    // because the browser stops painting hidden compositor layers anyway.
    cards.forEach((c, i) => {
      const delay = (i * 0.6).toFixed(2);
      c.style.animation = `heroFloat 6s ease-in-out ${delay}s infinite`;
    });

    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0.05 });
      io.observe(stage);
    } else {
      // Old browser fallback — match v0.1.0 behavior (always run).
      start();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
