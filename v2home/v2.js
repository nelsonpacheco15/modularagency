/* ==========================================================================
   Modular V2 — scroll-driven motion + preview interactions
   ========================================================================== */
(() => {
  if (!document.body.classList.contains('v2')) return;

  /* ---- Reveal on scroll ---- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  document.querySelectorAll('[data-v2-reveal]').forEach(el => io.observe(el));

  /* ---- Scroll-driven horizontal rails (mill3 style) ----
     Each rail moves opposite directions as you scroll past it. */
  const rails = document.querySelectorAll('[data-v2-rail]');
  if (rails.length) {
    const onScroll = () => {
      const vh = window.innerHeight;
      rails.forEach(rail => {
        const rect = rail.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        // -1 .. 1 progress through viewport
        const progress = (vh / 2 - center) / (vh / 2 + rect.height / 2);
        const dir = parseFloat(rail.dataset.v2Rail || '1');
        const range = parseFloat(rail.dataset.v2RailRange || '40'); // % of track
        const track = rail.querySelector('.v2-rail__track');
        if (!track) return;
        const tx = -progress * range * dir;
        track.style.transform = `translate3d(${tx}%, 0, 0)`;
      });
    };
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => { onScroll(); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
    onScroll();
  }

  /* ---- Hero clock ---- */
  const clock = document.querySelector('[data-v2-clock]');
  if (clock) {
    const tick = () => {
      const d = new Date();
      const tw = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(d);
      clock.textContent = `${tw} · GMT+8 · Taipei`;
    };
    tick();
    setInterval(tick, 30 * 1000);
  }

  /* ---- Project list: cursor-following preview thumbnail (appart style) ---- */
  const list = document.querySelector('[data-v2-list]');
  const preview = document.querySelector('[data-v2-list-preview]');
  if (list && preview) {
    const img = preview.querySelector('img');
    const rows = list.querySelectorAll('[data-v2-list-row]');
    let raf = 0;
    let targetX = 0, targetY = 0, currX = 0, currY = 0;

    const lerp = () => {
      currX += (targetX - currX) * 0.18;
      currY += (targetY - currY) * 0.18;
      preview.style.left = currX + 'px';
      preview.style.top  = currY + 'px';
      raf = requestAnimationFrame(lerp);
    };

    rows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        const src = row.dataset.preview;
        if (src && img.src !== src) img.src = src;
        preview.classList.add('is-active');
        if (!raf) raf = requestAnimationFrame(lerp);
      });
      row.addEventListener('mouseleave', () => {
        preview.classList.remove('is-active');
        cancelAnimationFrame(raf); raf = 0;
      });
      row.addEventListener('mousemove', (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
        if (!currX) { currX = targetX; currY = targetY; }
      });
    });
  }

  /* ---- Modular hero grid: mouse-draw / trail reveal (springboards-style) ----
     Cells fade in as the mouse enters them, then fade back along a trail.
     We track timestamps on each cell and decay opacity over a window. */
  const grid = document.querySelector('[data-v2-grid]');
  if (grid) {
    const cells = Array.from(grid.querySelectorAll('.v2-cell'));
    const TRAIL_MS = 1400;            // how long a cell stays "lit" after leaving
    const recents = new Map();        // cell -> last-active timestamp

    const setTrail = (cell, value) => {
      if (value <= 0) {
        cell.classList.remove('is-trailing');
        cell.style.removeProperty('--trail');
      } else {
        cell.classList.add('is-trailing');
        cell.style.setProperty('--trail', value.toFixed(3));
      }
    };

    cells.forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        cell.classList.add('is-active');
        cell.classList.remove('is-trailing');
        cell.style.removeProperty('--trail');
        recents.set(cell, performance.now());
      });
      cell.addEventListener('mouseleave', () => {
        cell.classList.remove('is-active');
        recents.set(cell, performance.now());
      });
    });

    // Decay loop: fade out cells over TRAIL_MS after their last activity
    const tick = () => {
      const now = performance.now();
      recents.forEach((ts, cell) => {
        if (cell.classList.contains('is-active')) return;
        const elapsed = now - ts;
        const v = Math.max(0, 1 - elapsed / TRAIL_MS);
        if (v <= 0) {
          setTrail(cell, 0);
          recents.delete(cell);
        } else {
          setTrail(cell, v);
        }
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---- (legacy) per-tile parallax kept for any remaining .v2-tile users ---- */
  const tiles = document.querySelectorAll('.v2-tile');
  tiles.forEach(tile => {
    const media = tile.querySelector('img,video');
    if (!media) return;
    tile.addEventListener('mousemove', (e) => {
      const r = tile.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      media.style.transform = `scale(1.06) translate(${x * -8}px, ${y * -8}px)`;
    });
    tile.addEventListener('mouseleave', () => {
      media.style.transform = '';
    });
  });
})();
