/* ==========================================================================
   Modular V5 — drag-to-scroll rail, showreel grow-on-scroll, "o" gravity
   ========================================================================== */
(() => {
  if (!document.body.classList.contains('v5')) return;

  /* ---- Drag-to-scroll on the portfolio rail ---- */
  const rail = document.querySelector('[data-v5-rail]');
  const track = document.querySelector('[data-v5-rail-track]');
  if (rail && track) {
    let isDown = false;
    let startX = 0;
    let baseTx = 0;
    let currTx = 0;
    let maxTx = 0;

    const measure = () => {
      maxTx = Math.min(0, rail.clientWidth - track.scrollWidth);
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });

    const setX = (x) => {
      currTx = Math.min(0, Math.max(maxTx, x));
      track.style.transform = `translate3d(${currTx}px, 0, 0)`;
    };

    rail.addEventListener('pointerdown', (e) => {
      isDown = true;
      startX = e.clientX;
      baseTx = currTx;
      rail.classList.add('is-dragging');
      rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      setX(baseTx + (e.clientX - startX));
    });
    const release = (e) => {
      if (!isDown) return;
      isDown = false;
      rail.classList.remove('is-dragging');
      try { rail.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    rail.addEventListener('pointerup', release);
    rail.addEventListener('pointercancel', release);
    rail.addEventListener('pointerleave', release);

    // Also map vertical wheel/trackpad to horizontal rail movement
    rail.addEventListener('wheel', (e) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (dx === 0) return;
      e.preventDefault();
      setX(currTx - dx);
    }, { passive: false });

    // Prevent click after drag
    track.addEventListener('click', (e) => {
      if (Math.abs(currTx - baseTx) > 6) e.preventDefault();
    }, true);
  }

  /* ---- Showreel grow-on-scroll (smooth, progress-driven) ---- */
  const reel = document.querySelector('[data-v5-reel]');
  const reelFrame = reel && reel.querySelector('.v5-reel__frame');
  if (reel && reelFrame) {
    const MIN_W = 56;     // vw at start
    const MAX_W = 95;     // vw at peak
    const MIN_R = 0;
    const MAX_R = 0;
    let ticking = false;
    const update = () => {
      const r = reel.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress 0 → 1 as the reel sticky region scrolls through viewport
      const total = r.height - vh;
      const passed = Math.max(0, -r.top);
      const raw = total > 0 ? passed / total : 0;
      // Grow during the first half of the section, then hold
      const t = Math.max(0, Math.min(1, raw * 2));
      const eased = 1 - Math.pow(1 - t, 3);
      const w = MIN_W + (MAX_W - MIN_W) * eased;
      const rad = MIN_R + (MAX_R - MIN_R) * eased;
      reelFrame.style.width = w.toFixed(2) + 'vw';
      reelFrame.style.borderRadius = rad.toFixed(1) + 'px';
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---- "o" gravity field — pink+blue diamond inside the brand mark ---- */
  const navBrand = document.querySelector('.v5-nav__brand');
  if (navBrand) {
    const pink = navBrand.querySelector('path[fill="#FD007A"]');
    const blue = navBrand.querySelector('path[fill="#0029F5"]');
    if (pink && blue) {
      [pink, blue].forEach(p => {
        p.style.transformBox = 'fill-box';
        p.style.transformOrigin = 'center';
        p.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      });
      const REACH = 320;
      const STRENGTH_PINK = 6;
      const STRENGTH_BLUE = 9;
      const ROT_MAX = 12;
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
        pink.style.transform = `translate(${tx * STRENGTH_PINK / REACH}px, ${ty * STRENGTH_PINK / REACH}px) rotate(${r * 0.6}deg)`;
        blue.style.transform = `translate(${tx * STRENGTH_BLUE / REACH}px, ${ty * STRENGTH_BLUE / REACH}px) rotate(${r}deg)`;
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
