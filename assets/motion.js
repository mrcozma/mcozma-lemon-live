/* Shared choreography. Content and controls remain usable without the engine. */
(() => {
  'use strict';
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const preferences = gsap.matchMedia();
  const active = new Map();
  const played = new WeakSet();
  let refreshTimer;
  let destroyed = false;
  let settle = () => {};
  let settleAll = () => {};
  let updateAmbient = () => {};
  const select = selector => [...document.querySelectorAll(selector)];

  // Components request short transitions from the same engine as the page scenes.
  function transition(element, { y = 16, opacity = 0, duration = .5, delay = 0 } = {}) {
    active.get(element)?.kill();
    active.delete(element);
    if (reduced.matches || destroyed) return;
    const tween = gsap.fromTo(element, { y, opacity }, {
      y: 0, opacity: 1, duration, delay, ease: 'power3.out', overwrite: 'auto',
      clearProps: 'transform,opacity', onComplete: () => active.delete(element)
    });
    active.set(element, tween);
  }
  function resize(element, start, end, onComplete) {
    const content = [...element.children].filter(child => child.tagName !== 'SUMMARY');
    if (end > start && !reduced.matches && !destroyed) {
      content.forEach(child => transition(child, { y: 7, opacity: .9, duration: .32, delay: .06 }));
    } else {
      content.forEach(child => {
        active.get(child)?.progress(1).kill();
        active.delete(child);
        gsap.set(child, { clearProps: 'transform,opacity' });
      });
    }
    const tween = gsap.fromTo(element, { height: start }, {
      height: end, duration: .42, ease: 'power3.out', overwrite: 'auto',
      onComplete: () => { onComplete(); refresh(); }
    });
    return { cancel: () => tween.kill() };
  }
  function flushRefresh() {
    if (destroyed) return;
    // A refresh during native smooth navigation can cancel the browser's journey.
    if (ScrollTrigger.isScrolling()) { refreshTimer = setTimeout(flushRefresh, 180); return; }
    ScrollTrigger.refresh();
  }
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(flushRefresh, 180);
  }
  function illustrate(element) {
    if (reduced.matches || destroyed) return;
    const parts = [...element.querySelectorAll('[data-part]')];
    const paths = [...element.querySelectorAll('[data-draw]')].filter(path => typeof path.getTotalLength === 'function');
    const key = element.querySelector('svg') || element;
    active.get(key)?.progress(1).kill();
    const timeline = gsap.timeline({ onComplete: () => active.delete(key) });
    paths.forEach((path,index) => {
      const length = path.getTotalLength();
      timeline.fromTo(path,{ strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: .65, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' },index * .06);
    });
    if (parts.length) timeline.fromTo(parts,{ opacity: .15, y: 6 },{ opacity: 1, y: 0, stagger: .06, duration: .45, ease: 'power3.out', clearProps: 'transform,opacity' },0);
    active.set(key,timeline);
  }
  window.PortfolioMotion = { transition, resize, refresh, illustrate };
  body.dataset.motionEngine = 'gsap';

  preferences.add({ animate: '(prefers-reduced-motion: no-preference)', compact: '(max-width: 700px)' }, context => {
    const { animate, compact } = context.conditions;
    if (!animate) return;
    const scenes = new Map();
    const listeners = [];
    const hoverTargets = [];
    const on = (element, event, handler, options) => {
      element?.addEventListener(event, handler, options);
      if (element) listeners.push(() => element.removeEventListener(event, handler, options));
    };
    body.dataset.motionMode = compact ? 'compact' : 'full';
    const eligible = element => !element.closest('details, dialog, .legal-copy') && element.getClientRects().length;
    const inInitialView = element => {
      const rect = element.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0;
    };
    function addScene(element, tween) {
      if (!scenes.has(element)) scenes.set(element, []);
      scenes.get(element).push(tween);
      return tween;
    }
    function reveal(element, delay = 0) {
      // Primary actions stay fully visible; fading an ancestor also fades its controls.
      if (element.matches('.button, .actions, .closing-actions') || element.querySelector('.button')) return;
      if (!eligible(element) || played.has(element)) return;
      // A navigation arrives at a complete page, never a hidden or displaced header.
      // Scroll entrances add movement below the fold without restructuring text.
      if (inInitialView(element)) { played.add(element); return; }
      const tween = gsap.from(element, {
        y: compact ? 12 : 20, duration: .65, delay, ease: 'power3.out', immediateRender: false,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: element, start: 'top 92%', once: true },
        onComplete: () => played.add(element)
      });
      addScene(element, tween);
    }

    // Native headings retain their exact line wrapping before and after fonts load.
    select('h1, .chapter-heading h2, .leadership-title h2, .quote-heading h2, .closing-section h2, .mentor-invitation h2, .mentoring-main h2, .case-section-head h2').forEach(heading => {
      reveal(heading);
    });
    select('.hero-copy > :not(h1):not(.actions), .page-opening > :not(h1):not(.work-filters), .about-heading > :not(h1), .contact-opening > :not(h1), .case-title > :not(h1), .about-story, .case-hero-copy, .case-facts, .preview-summary').forEach((element, index) => reveal(element, inInitialView(element) ? Math.min(index, 3) * .06 : 0));
    select('.folio-meta, .folio-card h3, .folio-card > a > p, .leadership-endorsement, .leadership-story, .leadership-points > article, .mentor-preview, .mentor-offers > article, .lab-project-panel, .lab-community-resource, .contact-paths > a, .career-entry, .invitation-panel, .case-section-head .case-prose, .case-results, .case-decision-record, .case-next, .private-context').forEach(element => reveal(element));
    // Proof arrives as a small sequence, while every number remains readable.
    select('.leadership-pillars, .outcome-grid').forEach(group => {
      [...group.children].forEach((element,index) => reveal(element, Math.min(index,2) * .07));
    });

    // Media opens into its full canvas. Evidence boards keep their natural ratio.
    select('.folio-visual, .public-cover, .case-cover, .case-figure > button:first-child').forEach(element => {
      if (!eligible(element) || inInitialView(element)) return;
      addScene(element, gsap.fromTo(element,
        { clipPath: `inset(0 ${compact ? 2 : 6}% 0 ${compact ? 2 : 6}% round 12px)` },
        { clipPath: 'inset(0 0% 0 0% round 12px)', ease: 'none',
          scrollTrigger: { trigger: element, start: 'top 94%', end: 'top 57%', scrub: .55, invalidateOnRefresh: true }
        }));
    });
    const process = document.querySelector('.process-studio');
    if (process) reveal(process);
    // Product typography gives the independent work its own visual scale.
    select('.decised-identity, .lab-live-body > div:first-child').forEach(element => {
      if (!eligible(element) || inInitialView(element)) return;
      addScene(element, gsap.from(element, { x: compact ? -12 : -38, duration: 1, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: element, start: 'top 90%', once: true } }));
    });
    select('.closing-actions, .practice-bridge, .decised-invitation, .lab-live-copy').forEach(element => reveal(element));

    // Feedback moves inside the project image; links and buttons remain stationary.
    if (!compact && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      select('.folio-link').forEach(link => {
        const img = link.querySelector('.folio-art img');
        if (!img) return;
        hoverTargets.push(img);
        const enter = () => gsap.to(img, { scale: 1.045, duration: .65, ease: 'power3.out', overwrite: 'auto' });
        const leave = () => gsap.to(img, { scale: 1, duration: .45, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform' });
        on(link, 'pointerenter', enter);
        on(link, 'pointerleave', leave);
        on(link, 'focus', enter);
        on(link, 'blur', leave);
      });
      select('.service-deck-card').forEach(card => {
        hoverTargets.push(card);
        on(card, 'pointerenter', () => gsap.to(card, { y: -4, duration: .35, ease: 'power2.out', overwrite: 'auto' }));
        on(card, 'pointerleave', () => gsap.to(card, { y: 0, duration: .3, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' }));
      });
    }

    // Ambient transforms pause off screen, in background tabs and by explicit choice.
    // Radial fields are painted once; only their transforms move (never blur filters).
    const marquee = document.querySelector('.experience-marquee');
    const track = marquee?.querySelector('.logo-track');
    const field = document.querySelector('.page-home .opening-atmosphere');
    const fields = field ? [...field.querySelectorAll('.atmosphere-field')] : [];
    const orbs = fields.map(element => element.querySelector('.atmosphere-orb'));
    const drifts = orbs.map((orb, index) => gsap.to(orb, {
      xPercent: index ? -10 : 12, yPercent: index ? 8 : -7,
      scale: index ? 1.08 : 1.12, duration: index ? 29 : 24,
      ease: 'sine.inOut', repeat: -1, yoyo: true
    }));
    let loop, near = true, hover = false, fieldNear = true;
    if (track) {
      marquee.dataset.gsapMarquee = '';
      loop = gsap.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: 42, repeat: -1, ease: 'none' });
      const logoVisibility = ScrollTrigger.create({ trigger: marquee, start: 'top bottom', end: 'bottom top', onToggle: self => { near = self.isActive; updateAmbient(); } });
      near = logoVisibility.isActive;
      on(marquee, 'pointerenter', () => { hover = true; updateAmbient(); });
      on(marquee, 'pointerleave', () => { hover = false; updateAmbient(); });
    }
    const pointerX = fields.map(element => gsap.quickTo(element, 'x', { duration: 1.2, ease: 'power2.out' }));
    const pointerY = fields.map(element => gsap.quickTo(element, 'y', { duration: 1.2, ease: 'power2.out' }));
    updateAmbient = () => {
      const paused = destroyed || document.hidden || body.classList.contains('ambient-paused') || body.classList.contains('menu-open');
      loop?.paused(!near || hover || paused);
      drifts.forEach(drift => drift.paused(!fieldNear || paused));
      if (field) field.dataset.ambientRunning = String(fieldNear && !paused);
      if (paused || !fieldNear) {
        [...pointerX,...pointerY].forEach(move => move.tween.pause());
        gsap.set(fields, { x: 0, y: 0 });
      }
    };
    if (field) {
      const fieldVisibility = ScrollTrigger.create({ trigger: document.querySelector('.hero'), start: 'top bottom', end: 'bottom top', onToggle: self => { fieldNear = self.isActive; updateAmbient(); } });
      fieldNear = fieldVisibility.isActive;
      if (!compact && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        on(document, 'pointermove', event => {
          if (event.pointerType === 'touch' || !fieldNear || document.hidden || body.classList.contains('ambient-paused') || body.classList.contains('menu-open')) return;
          const x = Math.max(-1, Math.min(1, event.clientX / innerWidth * 2 - 1));
          const y = Math.max(-1, Math.min(1, event.clientY / Math.min(innerHeight,850) * 2 - 1));
          fields.forEach((element,index) => { pointerX[index](x * (index ? -20 : 30)); pointerY[index](y * (index ? -14 : 20)); });
        }, { passive: true });
        on(document.documentElement, 'pointerleave', () => fields.forEach((element,index) => { pointerX[index](0); pointerY[index](0); }));
      }
    }
    on(document, 'portfolio:ambient', updateAmbient);
    on(document, 'visibilitychange', updateAmbient);
    updateAmbient();

    // Reading progress is quiet, decorative and separate from the chapter links.
    const progress = document.querySelector('[data-reading-progress]');
    if (progress) gsap.fromTo(progress, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.querySelector('main'), start: 'top top', end: 'bottom bottom', scrub: true } });

    // Focus and deep links must never arrive at masked or translated content.
    const finishScene = (tweens, element) => {
      tweens.forEach(tween => {
        tween.progress(1).pause();
        tween.scrollTrigger?.kill(false, true);
        gsap.set(tween.targets(), { clearProps: 'transform,opacity,clipPath' });
      });
      played.add(element);
    };
    settle = target => {
      scenes.forEach((tweens, element) => {
        if (element === target || element.contains(target) || target.contains(element)) {
          finishScene(tweens,element);
        }
      });
    };
    settleAll = () => {
      scenes.forEach(finishScene);
      gsap.killTweensOf(hoverTargets);
      gsap.set(hoverTargets, { clearProps: 'transform' });
    };
    settleHash();
    refresh();
    return () => {
      listeners.forEach(remove => remove());
      if (marquee) delete marquee.dataset.gsapMarquee;
      if (field) delete field.dataset.ambientRunning;
      delete body.dataset.motionMode;
      settle = () => {};
      settleAll = () => {};
      updateAmbient = () => {};
    };
  });

  function settleHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = id && document.getElementById(id);
    if (target) settle(target);
  }
  document.addEventListener('focusin', event => { if (event.target instanceof Element) settle(event.target); });
  window.addEventListener('hashchange', settleHash);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    const target = link?.hash && document.getElementById(link.hash.slice(1));
    if (target) settle(target);
  });
  document.addEventListener('portfolio:layout', refresh);
  document.addEventListener('toggle', event => { if (event.target.matches('details')) refresh(); }, true);
  document.addEventListener('load', event => { if (event.target instanceof HTMLImageElement) refresh(); }, true);
  window.addEventListener('load', refresh);
  document.fonts?.ready.then(refresh);
  reduced.addEventListener('change', () => {
    active.forEach(tween => { tween.progress(1); tween.kill(); }); active.clear();
    gsap.set(select('.work-feedback-quote, .folio-card'), { clearProps: 'transform,opacity' });
    refresh();
  });
  window.addEventListener('pagehide', event => {
    destroyed = true;
    updateAmbient();
    clearTimeout(refreshTimer);
    active.forEach(tween => { tween.progress(1); tween.kill(); }); active.clear();
    settleAll();
    if (!event.persisted) preferences.revert();
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    destroyed = false;
    updateAmbient();
    refresh();
  });
})();
