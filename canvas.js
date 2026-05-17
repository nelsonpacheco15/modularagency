/* ==========================================================================
   Modular — Infinite 3D drift
   Each tile has its own dynamic Z. Both scroll AND a steady ambient camera
   advance the field forward, so tiles approach even when the user isn't
   scrolling. After a tile passes the camera it wraps to the far distance.
   ========================================================================== */
(() => {
  if (!document.body.classList.contains('canvas')) return;

  const projs = Array.from(document.querySelectorAll('.proj'));
  const hint = document.getElementById('hint');
  if (!projs.length) return;

  // Scene constants
  const CAM_TRAVEL = 9400;       // total z-range a tile traverses before wrapping
  const FADE_START_Z = -180;     // when a tile crosses this it starts fading out (and growing huge)
  const HIDE_Z = 40;             // fully invisible past here — wraps to the back
  const FADE_IN_FROM = -CAM_TRAVEL + 200;   // just-wrapped tiles fade in over this range
  const FADE_IN_TO   = -CAM_TRAVEL + 1000;
  const AMBIENT_SPEED = 60;      // px / sec — slow forward drift even without scroll
  // Each px of scroll drives roughly 1.6 px of camera motion (CAM_TRAVEL ÷ 700vh)
  // — chosen so scrolling produces noticeable approach without being violent.

  const DESIGN_W = 1440;
  const DESIGN_H = 900;
  function coordScale() {
    return {
      x: Math.min(1, window.innerWidth / DESIGN_W),
      y: Math.min(1, window.innerHeight / DESIGN_H),
    };
  }

  function placeholder(seed) {
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/480/480`;
  }

  // ----- Build markup -----
  const items = projs.map((el) => {
    const seed = el.dataset.seed || 'modular';
    const label = el.dataset.label || 'Untitled';
    const cat = el.dataset.cat || 'Project';

    el.innerHTML = `
      <div class="proj__inner">
        <img class="proj__img" alt="${label}" loading="lazy" src="${placeholder(seed)}" />
        <div class="proj__label"><span class="l">${label}</span><span class="r">${cat}</span></div>
      </div>
    `;

    el.style.setProperty('--r', (parseFloat(el.dataset.r) || 0) + 'deg');

    return {
      el,
      x: parseFloat(el.dataset.x) || 0,
      y: parseFloat(el.dataset.y) || 0,
      z0: parseFloat(el.dataset.z) || -3000,
    };
  });

  function layout() {
    const s = coordScale();
    items.forEach(({ el, x, y }) => {
      el.style.setProperty('--x', (x * s.x).toFixed(2) + 'px');
      el.style.setProperty('--y', (y * s.y).toFixed(2) + 'px');
    });
  }
  layout();

  // ----- Camera state -----
  let ambient = 0;        // grows over time at AMBIENT_SPEED
  let lastFrame = performance.now();

  function wrapZ(z) {
    // Map z into the half-open interval (-CAM_TRAVEL, 0]
    let zz = ((z % CAM_TRAVEL) + CAM_TRAVEL) % CAM_TRAVEL; // → [0, CAM_TRAVEL)
    return zz - CAM_TRAVEL;                                // → [-CAM_TRAVEL, 0)
  }

  function opacityFor(z) {
    // Just emerged from the back — fade in
    if (z <= FADE_IN_FROM) return 0;
    if (z <= FADE_IN_TO) return (z - FADE_IN_FROM) / (FADE_IN_TO - FADE_IN_FROM);
    // Fully visible middle distance
    if (z <= FADE_START_Z) return 1;
    // Approaching the camera — fade out as it grows huge
    if (z < HIDE_Z) return Math.max(0, 1 - (z - FADE_START_Z) / (HIDE_Z - FADE_START_Z));
    return 0;
  }

  function update() {
    const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollCam = (window.scrollY / docH) * CAM_TRAVEL;
    const total = scrollCam + ambient;

    items.forEach(({ el, z0 }) => {
      const z = wrapZ(z0 + total);
      el.style.setProperty('--z', z.toFixed(2) + 'px');
      const op = opacityFor(z);
      el.style.opacity = op.toFixed(3);
      el.style.pointerEvents = op > 0.08 && z < FADE_START_Z + 50 ? 'auto' : 'none';
    });

    if (hint) hint.classList.toggle('is-hidden', window.scrollY > window.innerHeight * 0.15);
  }

  // ----- rAF loop — drives the ambient drift AND keeps everything in sync -----
  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    ambient += AMBIENT_SPEED * dt;
    update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Initial layout adjust on resize; scroll-driven updates fold into the rAF loop
  window.addEventListener('resize', layout);

  // ----- Click guard during inertial scroll -----
  let lastScrollAt = 0;
  window.addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true });
  projs.forEach((p) => {
    p.addEventListener('click', (e) => {
      if (performance.now() - lastScrollAt < 120) e.preventDefault();
    });
  });
})();
