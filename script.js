/* ==========================================================================
   Modular Agency — interactions
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-on');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Showreel: force autoplay (handle blocked policies) ---------- */
  const showreelVideo = document.querySelector('.showreel__frame video');
  if (showreelVideo) {
    showreelVideo.muted = true;
    showreelVideo.defaultMuted = true;
    showreelVideo.playsInline = true;
    showreelVideo.setAttribute('muted', '');
    showreelVideo.setAttribute('playsinline', '');

    const tryPlay = () => {
      const p = showreelVideo.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // autoplay blocked — wake on first user gesture
          const wake = () => {
            showreelVideo.play().catch(() => {});
            document.removeEventListener('click', wake);
            document.removeEventListener('touchstart', wake);
            document.removeEventListener('scroll', wake);
            document.removeEventListener('keydown', wake);
          };
          document.addEventListener('click', wake, { once: true });
          document.addEventListener('touchstart', wake, { once: true, passive: true });
          document.addEventListener('scroll', wake, { once: true, passive: true });
          document.addEventListener('keydown', wake, { once: true });
        });
      }
    };

    if (showreelVideo.readyState >= 2) {
      tryPlay();
    } else {
      showreelVideo.addEventListener('loadeddata', tryPlay, { once: true });
      // belt + braces — also try on canplay and after a small delay
      showreelVideo.addEventListener('canplay', tryPlay, { once: true });
      setTimeout(tryPlay, 200);
    }
  }

  /* ---------- Showreel: sticky scaling video ---------- */
  const showreel = document.getElementById('showreel');
  const frame = document.getElementById('showreel-frame');

  if (showreel && frame) {
    const partnersList = showreel.querySelector('[data-partners-list]');
    const partners = partnersList ? Array.from(partnersList.querySelectorAll('.partner')) : [];
    const N = partners.length;

    // scroll phases (as % of total section scroll)
    const GROW_END = 0.28;          // 0 → 0.28 : video grows
    const PARTNER_START = 0.32;     // breath before partners tape starts
    const PARTNER_END = 0.96;       // last partner finishes
    const partnerSpan = PARTNER_END - PARTNER_START;

    const update = () => {
      // On phones the video is static — no sticky, no grow. Bail out so the
      // inline width/border-radius styles never override the CSS.
      if (window.matchMedia('(max-width: 720px)').matches) {
        frame.style.width = '';
        frame.style.borderRadius = '';
        showreel.classList.remove('is-full');
        return;
      }

      const rect = showreel.getBoundingClientRect();
      const total = showreel.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const progress = total > 0 ? scrolled / total : 0;

      // ---- video grow phase ----
      const grow = Math.min(progress / GROW_END, 1);
      const eased = 1 - Math.pow(1 - grow, 3);
      // Allow CSS to set the starting width per breakpoint via --start-width
      const startW = parseFloat(getComputedStyle(frame).getPropertyValue('--start-width')) || 56;
      const w = startW + (100 - startW) * eased;
      const r = 14 + (0 - 14) * eased;
      frame.style.width = w + 'vw';
      frame.style.borderRadius = r + 'px';

      // ---- full-bleed flag ----
      showreel.classList.toggle('is-full', progress >= GROW_END - 0.02);

      // ---- partners logo carousel ----
      if (N > 0) {
        const t = Math.max(0, Math.min((progress - PARTNER_START) / partnerSpan, 1));
        const activeIndex = Math.min(Math.floor(t * N), N - 1);
        partners.forEach((p, i) => {
          p.classList.toggle('is-active', i === activeIndex);
        });
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---------- Team photo: face detection auto-tags ----------
     When a new team photo is dropped in, the pins find the faces
     automatically — no manual X/Y editing needed. Falls back to
     manual `style="left:X%; top:Y%"` positions in the HTML if the
     model can't load or detects no faces. */
  const teamImg = document.querySelector('[data-team-photo]');
  if (teamImg) {
    const tags = Array.from(document.querySelectorAll('.team__photo .tag'));

    // Show pins after a 5s timeout regardless — fallback for slow nets
    const fallbackTimer = setTimeout(() => {
      tags.forEach((t) => t.classList.add('is-detected'));
    }, 5000);

    const placePins = async () => {
      if (typeof faceapi === 'undefined') return false;

      try {
        // Load the lightest face detector (~190KB, cached after first load)
        await faceapi.nets.tinyFaceDetector.loadFromUri(
          'https://justadudewhohacks.github.io/face-api.js/models'
        );

        // Wait for the image to be ready
        if (!teamImg.complete || !teamImg.naturalWidth) {
          await new Promise((resolve, reject) => {
            teamImg.addEventListener('load', resolve, { once: true });
            teamImg.addEventListener('error', reject, { once: true });
          });
        }

        // Detect — TinyFaceDetector with 416 input size = good balance
        const opts = new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.45,
        });
        const detections = await faceapi.detectAllFaces(teamImg, opts);
        if (!detections || detections.length === 0) return false;

        // Sort detected faces left-to-right (so HTML order matches photo order)
        const boxes = detections
          .map((d) => d.box)
          .sort((a, b) => a.x - b.x);

        // Place each pin on the corresponding detected face's centre
        tags.forEach((tag, i) => {
          const box = boxes[i];
          if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            const xPct = (cx / teamImg.naturalWidth) * 100;
            const yPct = (cy / teamImg.naturalHeight) * 100;
            tag.style.left = xPct + '%';
            tag.style.top = yPct + '%';
            tag.classList.add('is-detected');
          } else {
            // More HTML tags than detected faces — hide the extras
            tag.style.display = 'none';
          }
        });

        clearTimeout(fallbackTimer);
        return true;
      } catch (err) {
        console.warn('[team] face detection unavailable — using manual positions', err);
        return false;
      }
    };

    placePins();
  }

  /* ---------- Site-header: scroll-driven state ----------
     - .in-hero  : while in the hero section (controls brand size)
     - .over-dark: while the menu overlaps a dark section (flips text to white)
       The only dark section on the page is the showreel when full-bleed. */
  const siteHeader = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const showreelEl = document.getElementById('showreel');
  if (siteHeader) {
    const onScroll = () => {
      // in-hero
      if (hero) {
        const heroBottom = hero.offsetTop + hero.offsetHeight;
        const scrolled = window.scrollY + 80;
        siteHeader.classList.toggle('in-hero', scrolled < heroBottom);
      }

      // over-dark — only true while the showreel video is full-bleed AND the
      // menu's vertical band is inside the showreel section
      if (showreelEl) {
        const headerH = siteHeader.offsetHeight || 60;
        const r = showreelEl.getBoundingClientRect();
        const overlapping = r.top < headerH && r.bottom > 0;
        const isFullBleed = showreelEl.classList.contains('is-full');
        siteHeader.classList.toggle('over-dark', overlapping && isFullBleed);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  /* ---------- Venn diagram: click the Modular icon → reveal story + sparks ---------- */
  const venn = document.querySelector('[data-venn]');
  const vennTrigger = document.getElementById('venn-trigger');
  if (venn && vennTrigger) {
    vennTrigger.addEventListener('click', () => {
      // toggle so a second click resets
      const wasActive = venn.classList.contains('is-active');
      venn.classList.remove('is-active');
      // re-trigger sparks animation by removing then re-adding next frame
      requestAnimationFrame(() => {
        if (!wasActive) venn.classList.add('is-active');
      });
    });

    // click outside the venn closes the story
    document.addEventListener('click', (e) => {
      if (!venn.contains(e.target)) venn.classList.remove('is-active');
    });
  }

  /* ---------- (legacy) Intersection: keyword cloud burst ---------- */
  const stage = document.querySelector('[data-stage]');
  const centerBtn = document.getElementById('center');

  if (stage) {
    const circles = stage.querySelectorAll('.circle');
    const clouds = {
      left:  stage.querySelector('[data-cloud="left"]'),
      right: stage.querySelector('[data-cloud="right"]'),
    };

    let activeSide = null;

    const burst = (side) => {
      const circle = stage.querySelector(`.circle--${side}`);
      const cloud = clouds[side];
      if (!circle || !cloud) return;

      cloud.innerHTML = '';

      const stageRect = stage.getBoundingClientRect();
      const circleRect = circle.getBoundingClientRect();
      const cx = circleRect.left + circleRect.width / 2 - stageRect.left;
      const cy = circleRect.top + circleRect.height / 2 - stageRect.top;
      const radius = circleRect.width / 2;

      const words = (circle.dataset.keywords || '')
        .split(',').map((w) => w.trim()).filter(Boolean);

      // direction bias: left-side cloud blooms outward to the left, right to the right
      // baseAngle in radians: π = pointing left, 0 = pointing right
      const baseAngle = side === 'left' ? Math.PI : 0;

      words.forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'keyword';

        // ~30% large, ~50% normal, ~20% small — varied hierarchy
        const r = Math.random();
        if (r < 0.25) span.classList.add('size-lg');
        else if (r > 0.78) span.classList.add('size-sm');

        span.textContent = word;

        // polar scatter — wider cone outward (±100°), pulled distance varies
        const spread = (Math.PI * 1.05);
        const angle = baseAngle + (Math.random() - 0.5) * spread;
        // distance: just outside circle edge to ~1.7× radius
        const dist = radius * (1.02 + Math.random() * 0.6);

        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        // slight rotation for organic feel
        const rot = (Math.random() - 0.5) * 8; // ±4°

        span.style.left = x + 'px';
        span.style.top = y + 'px';
        span.style.setProperty('--rot', rot + 'deg');
        span.style.transitionDelay = (i * 22) + 'ms';

        cloud.appendChild(span);
      });

      // trigger animation in next frame so transitions apply
      requestAnimationFrame(() => {
        cloud.querySelectorAll('.keyword').forEach((k) => k.classList.add('is-on'));
      });
    };

    const clear = (side) => {
      const cloud = clouds[side];
      if (!cloud) return;
      cloud.querySelectorAll('.keyword').forEach((k, i) => {
        k.style.transitionDelay = (i * 12) + 'ms';
        k.classList.remove('is-on');
      });
      // remove DOM after fade
      setTimeout(() => { cloud.innerHTML = ''; }, 700);
    };

    const clearAll = () => {
      circles.forEach((c) => c.classList.remove('is-active'));
      clear('left');
      clear('right');
      activeSide = null;
    };

    const setSide = (side) => {
      if (side === 'both') {
        circles.forEach((c) => c.classList.add('is-active'));
        burst('left');
        burst('right');
        activeSide = 'both';
      } else {
        // turning on one side, clear the other
        const other = side === 'left' ? 'right' : 'left';
        circles.forEach((c) => c.classList.toggle('is-active', c.dataset.side === side));
        clear(other);
        burst(side);
        activeSide = side;
      }
    };

    circles.forEach((circle) => {
      circle.addEventListener('click', (e) => {
        e.stopPropagation();
        const side = circle.dataset.side;
        if (activeSide === side) clearAll();
        else setSide(side);
      });
    });

    if (centerBtn) {
      centerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeSide === 'both') clearAll();
        else setSide('both');
      });
    }

    // click empty area within section closes
    document.querySelector('.intersection')?.addEventListener('click', (e) => {
      if (e.target.closest('.circle, .intersection__center, .keyword, a')) return;
      if (activeSide) clearAll();
    });

    // re-burst on window resize (positions are pixel-based)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (activeSide && activeSide !== 'both') {
          burst(activeSide);
        } else if (activeSide === 'both') {
          burst('left');
          burst('right');
        }
      }, 160);
    });
  }

  /* ---------- Portfolio category tiles ---------- */
  const filterWrap = document.querySelector('[data-categories], [data-filters]');
  if (filterWrap) {
    const buttons = filterWrap.querySelectorAll('.category, .filter');
    // Card container: rail on the home page, grid on the portfolio page
    const container = document.querySelector('[data-rail], [data-grid]');
    const cards = container ? container.querySelectorAll('.card') : [];
    const emptyState = document.querySelector('[data-empty]');

    const applyFilter = (filter) => {
      let visibleCount = 0;
      cards.forEach((card) => {
        const match = filter === 'all' || card.dataset.cat === filter;
        card.classList.toggle('is-hidden', !match);
        if (match) visibleCount++;
      });
      if (emptyState) {
        if (visibleCount === 0) {
          emptyState.removeAttribute('hidden');
          if (container) container.style.display = 'none';
        } else {
          emptyState.setAttribute('hidden', '');
          if (container) container.style.display = '';
        }
      }
      if (container && container.matches('[data-rail]')) container.scrollLeft = 0;
    };

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
        applyFilter(btn.dataset.filter);
      });
    });

    // Run the initial filter so the active button's state is reflected on load
    const initial = filterWrap.querySelector('.category.is-active, .filter.is-active') || buttons[0];
    if (initial) applyFilter(initial.dataset.filter);
  }

  /* ---------- Portfolio rails: pointer-drag horizontal scroll w/ momentum ---------- */
  document.querySelectorAll('[data-rail]').forEach((rail) => {
    let pointerId = null;
    let startX = 0;
    let startScroll = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;             // px per frame (60fps)
    let momentumRAF = 0;
    let moved = false;
    const DRAG_THRESHOLD = 6;
    const MOMENTUM_DECAY = 0.94;  // velocity multiplier per frame
    const MIN_VELOCITY = 0.4;     // stop momentum below this

    // Block native HTML5 drag on cards/imgs so the rail drag stays clean
    rail.querySelectorAll('img, a').forEach((el) => {
      el.setAttribute('draggable', 'false');
      el.addEventListener('dragstart', (e) => e.preventDefault());
    });

    const cancelMomentum = () => {
      if (momentumRAF) {
        cancelAnimationFrame(momentumRAF);
        momentumRAF = 0;
      }
    };

    const runMomentum = () => {
      if (Math.abs(velocity) < MIN_VELOCITY) {
        momentumRAF = 0;
        return;
      }
      rail.scrollLeft -= velocity;
      velocity *= MOMENTUM_DECAY;
      momentumRAF = requestAnimationFrame(runMomentum);
    };

    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'touch') return;     // touch keeps native scrolling

      cancelMomentum();
      pointerId = e.pointerId;
      moved = false;
      startX = e.pageX;
      lastX = e.pageX;
      lastTime = performance.now();
      velocity = 0;
      startScroll = rail.scrollLeft;
      rail.classList.add('is-dragging');
      rail.setPointerCapture(pointerId);
    };

    const onMove = (e) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.pageX - startX;
      if (!moved && Math.abs(dx) > DRAG_THRESHOLD) moved = true;
      if (moved) {
        e.preventDefault();
        rail.scrollLeft = startScroll - dx;

        // Track instantaneous velocity for momentum on release.
        // Normalize to "px per frame" so MOMENTUM_DECAY behaves consistently.
        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 0) {
          const frameDx = (e.pageX - lastX) * (16.67 / dt);
          // Light low-pass filter so a single jittery sample doesn't dominate
          velocity = velocity * 0.4 + frameDx * 0.6;
        }
        lastX = e.pageX;
        lastTime = now;
      }
    };

    const onUp = (e) => {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      try { rail.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null;
      rail.classList.remove('is-dragging');
      // Kick off momentum if the user flicked
      if (Math.abs(velocity) >= MIN_VELOCITY) {
        momentumRAF = requestAnimationFrame(runMomentum);
      }
    };

    rail.addEventListener('pointerdown', onDown);
    rail.addEventListener('pointermove', onMove);
    rail.addEventListener('pointerup', onUp);
    rail.addEventListener('pointercancel', onUp);
    // Stop momentum if the user starts scrolling another way
    rail.addEventListener('wheel', cancelMomentum, { passive: true });

    // Suppress the click that fires after a drag
    rail.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      });
    });

    // Trackpad horizontal swipes & touch scroll natively — no JS needed.
    // Vertical wheel always passes through to page scroll — never hijacked.
  });

  /* ---------- Team-room object drag ---------- */
  document.querySelectorAll('.object').forEach((obj) => {
    let dragging = false;
    let startX = 0, startY = 0;
    let baseX = 0, baseY = 0;

    obj.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = obj.getBoundingClientRect();
      const parentRect = obj.parentElement.getBoundingClientRect();
      baseX = rect.left - parentRect.left;
      baseY = rect.top - parentRect.top;
      obj.style.transition = 'none';
      obj.style.zIndex = 10;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      obj.style.left = (baseX + dx) + 'px';
      obj.style.top = (baseY + dy) + 'px';
      obj.style.right = 'auto';
      obj.style.bottom = 'auto';
      obj.style.transform = 'rotate(0deg)';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      obj.style.transition = '';
    });
  });

})();
