/* Shared choreography. Content and controls remain usable without the engine. */
(() => {
  'use strict';
  const { gsap, ScrollTrigger, SplitText } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const preferences = gsap.matchMedia();
  const active = new Map();
  const played = new WeakSet();
  let refreshTimer;
  let destroyed = false;
  let settle = () => {};
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
    const tween = gsap.fromTo(element, { height: start }, {
      height: end, duration: .42, ease: 'power3.inOut', overwrite: 'auto',
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
    const splits = [];
    const scenes = new Map();
    const listeners = [];
    const on = (element, event, handler, options) => {
      element?.addEventListener(event, handler, options);
      if (element) listeners.push(() => element.removeEventListener(event, handler, options));
    };
    body.dataset.motionMode = compact ? 'compact' : 'full';
    const eligible = element => !element.closest('details, dialog, .legal-copy') && element.getClientRects().length;
    const inInitialView = element => element.getBoundingClientRect().top < innerHeight && !location.hash;
    function addScene(element, tween) {
      if (!scenes.has(element)) scenes.set(element, []);
      scenes.get(element).push(tween);
      return tween;
    }
    function reveal(element, delay = 0) {
      // Primary actions stay fully visible; fading an ancestor also fades its controls.
      if (element.matches('.button, .actions, .closing-actions') || element.querySelector('.button')) return;
      if (!eligible(element) || played.has(element)) return;
      const tween = gsap.from(element, {
        y: compact ? 14 : 24, opacity: 0, duration: .75, delay, ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: element, start: 'top 95%', once: true },
        onComplete: () => played.add(element)
      });
      addScene(element, tween);
    }

    // Line masks preserve the font pairing and establish the reading order.
    select('h1, .chapter-heading h2, .leadership-title h2, .quote-heading h2, .closing-section h2, .mentor-invitation h2, .mentoring-main h2, .case-section-head h2').forEach(heading => {
      if (!eligible(heading) || played.has(heading)) return;
      // Mixed typefaces retain their natural inline layout; no overlapping masks.
      if (!SplitText || heading.querySelector('.brand-phrase')) { reveal(heading); return; }
      const accessibleName = heading.innerText.replace(/\s+/g, ' ').trim();
      const split = SplitText.create(heading, {
        type: 'lines', mask: 'lines', linesClass: 'motion-line', autoSplit: true, aria: 'auto',
        onSplit(self) {
          heading.setAttribute('aria-label', accessibleName);
          const tween = gsap.from(self.lines, {
            yPercent: 105, duration: compact ? .8 : 1.05, stagger: .085, ease: 'power4.out',
            scrollTrigger: { trigger: heading, start: 'top 96%', once: true },
            onComplete: () => played.add(heading)
          });
          addScene(heading, tween);
          return tween;
        }
      });
      splits.push(split);
    });
    select('.hero-copy > :not(h1):not(.actions), .page-opening > :not(h1):not(.work-filters), .about-heading > :not(h1), .contact-opening > :not(h1), .case-title > :not(h1), .about-story, .case-hero-copy, .case-facts, .preview-summary').forEach((element, index) => reveal(element, inInitialView(element) ? Math.min(index, 3) * .06 : 0));
    select('.folio-meta, .folio-card h3, .folio-card > a > p, .leadership-endorsement, .leadership-story, .leadership-points > article, .mentor-preview, .mentor-offers > article, .lab-project-panel, .lab-community-resource, .contact-paths > a, .career-entry, .invitation-panel, .case-section-head .case-prose, .case-results, .case-decision-record, .case-next, .private-context').forEach(element => reveal(element));

    // Media opens into its full canvas. Evidence boards keep their natural ratio.
    select('.folio-visual, .public-cover, .case-cover, .case-figure > button:first-child').forEach(element => {
      if (!eligible(element)) return;
      addScene(element, gsap.fromTo(element,
        { clipPath: `inset(0 ${compact ? 2 : 6}% 0 ${compact ? 2 : 6}% round 12px)` },
        { clipPath: 'inset(0 0% 0 0% round 12px)', ease: 'none',
          scrollTrigger: { trigger: element, start: 'top 94%', end: 'top 57%', scrub: .55, invalidateOnRefresh: true }
        }));
    });
    const canvas = document.querySelector('.thinking-notes');
    if (canvas) addScene(canvas,gsap.from(canvas, { y: compact ? 14 : 24, opacity: 0, duration: .9, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: canvas, start: 'top 95%', once: true } }));
    const process = document.querySelector('.process-studio');
    if (process) reveal(process);
    // Product typography gives the independent work its own visual scale.
    select('.decised-identity, .lab-live-body > div:first-child').forEach(element => {
      addScene(element, gsap.from(element, { x: compact ? -12 : -38, duration: 1, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: element, start: 'top 90%', once: true } }));
    });
    select('.closing-actions, .practice-bridge, .decised-invitation, .lab-live-copy').forEach(element => reveal(element));

    // Feedback moves inside the project image; links and buttons remain stationary.
    if (!compact && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      select('.folio-link').forEach(link => {
        const img = link.querySelector('.folio-art img');
        if (!img) return;
        const hover = gsap.to(img, { scale: 1.045, duration: .7, ease: 'power3.out', paused: true });
        on(link, 'pointerenter', () => hover.play());
        on(link, 'pointerleave', () => hover.reverse());
        on(link, 'focus', () => hover.play());
        on(link, 'blur', () => hover.reverse());
      });
    }

    // The loop pauses off screen, on hover, in background tabs and by explicit choice.
    const marquee = document.querySelector('.experience-marquee');
    const track = marquee?.querySelector('.logo-track');
    let loop, near = true, hover = false;
    if (track) {
      marquee.dataset.gsapMarquee = '';
      loop = gsap.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: 42, repeat: -1, ease: 'none' });
      updateAmbient = () => loop.paused(!near || hover || document.hidden || body.classList.contains('ambient-paused'));
      ScrollTrigger.create({ trigger: marquee, start: 'top bottom', end: 'bottom top', onToggle: self => { near = self.isActive; updateAmbient(); } });
      on(marquee, 'pointerenter', () => { hover = true; updateAmbient(); });
      on(marquee, 'pointerleave', () => { hover = false; updateAmbient(); });
      on(document, 'portfolio:ambient', updateAmbient);
      on(document, 'visibilitychange', updateAmbient);
      updateAmbient();
    }

    // Reading progress is quiet, decorative and separate from the chapter links.
    const progress = document.querySelector('[data-reading-progress]');
    if (progress) gsap.fromTo(progress, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.querySelector('main'), start: 'top top', end: 'bottom bottom', scrub: true } });

    // Focus and deep links must never arrive at masked or translated content.
    settle = target => {
      scenes.forEach((tweens, element) => {
        if (element === target || element.contains(target) || target.contains(element)) {
          tweens.forEach(tween => {
            tween.progress(1).pause();
            tween.scrollTrigger?.kill(false, true);
            gsap.set(tween.targets(), { clearProps: 'transform,opacity,clipPath' });
          });
          played.add(element);
        }
      });
    };
    settleHash();
    refresh();
    return () => {
      listeners.forEach(remove => remove());
      splits.forEach(split => split.revert());
      if (marquee) delete marquee.dataset.gsapMarquee;
      delete body.dataset.motionMode;
      settle = () => {};
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
    clearTimeout(refreshTimer);
    active.forEach(tween => { tween.progress(1); tween.kill(); }); active.clear();
    if (!event.persisted) preferences.revert();
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    destroyed = false;
    updateAmbient();
    refresh();
  });
})();
