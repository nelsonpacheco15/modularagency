/* ==========================================================================
   Modular V3 — dropdown menu toggle + scroll parallax for the works grid
   ========================================================================== */
(() => {
  if (!document.body.classList.contains('v3')) return;

  const body = document.body;
  const drawer = document.getElementById('v3-drawer');
  const trigger = document.querySelector('[data-v3-menu-open]');
  const scrim = document.querySelector('[data-v3-menu-close]');

  const setOpen = (state) => {
    body.classList.toggle('is-menu-open', state);
    if (drawer) drawer.setAttribute('aria-hidden', state ? 'false' : 'true');
    if (trigger) trigger.setAttribute('aria-expanded', state ? 'true' : 'false');
  };
  const open  = () => setOpen(true);
  const close = () => setOpen(false);
  const toggle = () => setOpen(!body.classList.contains('is-menu-open'));

  if (trigger) trigger.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  if (scrim) scrim.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && body.classList.contains('is-menu-open')) close();
  });

  document.querySelectorAll('.v3-drawer__nav a').forEach(a => {
    a.addEventListener('click', () => setTimeout(close, 60));
  });

  /* ---- Tag filter — click a service tag to reflow the cards ---- */
  const filter = document.querySelector('[data-v3-filter]');
  const items = document.querySelectorAll('.v3-cards-item');
  if (filter && items.length) {
    filter.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tag]');
      if (!btn) return;
      const tag = btn.dataset.tag;
      filter.querySelectorAll('[data-tag]').forEach(b => {
        b.classList.toggle('is-active', b === btn);
      });
      items.forEach(item => {
        const match = (tag === 'all') || item.dataset.service === tag;
        item.classList.toggle('is-out', !match);
      });
    });
  }

  /* ---- Parallax on the works columns + scroll-driven column "breath" ---- */
  const layers = document.querySelectorAll('[data-v3-parallax]');
  const grid = document.querySelector('.v3-cards-grid');
  if (layers.length || grid) {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      layers.forEach(el => {
        const speed = parseFloat(el.dataset.v3Parallax || '0');
        el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
      });

      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---- "o" gravity field — pink+blue diamond inside the brand mark
         tilts toward the cursor with iron-filings physics. */
  const navBrand = document.querySelector('.v3-nav__brand');
  if (navBrand) {
    const pink = navBrand.querySelector('path[fill="#FD007A"]');
    const blue = navBrand.querySelector('path[fill="#0029F5"]');
    if (pink && blue) {
      // CSS hooks so the transforms compose correctly inside the SVG
      [pink, blue].forEach(p => {
        p.style.transformBox = 'fill-box';
        p.style.transformOrigin = 'center';
        p.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      });

      const REACH = 320;          // px — how far the cursor influences
      const STRENGTH_PINK = 6;     // max translate in px (pink leads)
      const STRENGTH_BLUE = 9;     // blue moves a bit more
      const ROT_MAX = 12;          // max rotation in degrees
      let raf = 0;
      let target = { x: 0, y: 0, intensity: 0 };
      let curr   = { x: 0, y: 0, intensity: 0 };

      const lerp = (a, b, t) => a + (b - a) * t;

      const tick = () => {
        curr.x = lerp(curr.x, target.x, 0.18);
        curr.y = lerp(curr.y, target.y, 0.18);
        curr.intensity = lerp(curr.intensity, target.intensity, 0.18);

        const tx = curr.x * curr.intensity;
        const ty = curr.y * curr.intensity;
        const rot = Math.atan2(ty, tx) * 180 / Math.PI * (curr.intensity * 0.18);
        const r = Math.max(-ROT_MAX, Math.min(ROT_MAX, rot));

        pink.style.transform =
          `translate(${tx * STRENGTH_PINK / REACH}px, ${ty * STRENGTH_PINK / REACH}px) rotate(${r * 0.6}deg)`;
        blue.style.transform =
          `translate(${tx * STRENGTH_BLUE / REACH}px, ${ty * STRENGTH_BLUE / REACH}px) rotate(${r}deg)`;

        if (Math.abs(curr.x - target.x) > 0.05 || Math.abs(curr.y - target.y) > 0.05 || Math.abs(curr.intensity - target.intensity) > 0.005) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
        }
      };

      window.addEventListener('mousemove', (e) => {
        const r = navBrand.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        target.x = dx;
        target.y = dy;
        target.intensity = Math.max(0, 1 - dist / REACH);
        if (!raf) raf = requestAnimationFrame(tick);
      }, { passive: true });

      window.addEventListener('mouseleave', () => {
        target.x = 0; target.y = 0; target.intensity = 0;
        if (!raf) raf = requestAnimationFrame(tick);
      });
    }
  }
})();
