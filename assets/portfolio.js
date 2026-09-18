(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionAnimations = new Map();
  function animateMotion(element, keyframes, options = {}) {
    if (reduced.matches || typeof element.animate !== 'function') return;
    motionAnimations.get(element)?.cancel();
    const animation = element.animate(keyframes, { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)', ...options });
    motionAnimations.set(element, animation);
    const release = () => { if (motionAnimations.get(element) === animation) motionAnimations.delete(element); };
    animation.addEventListener('finish', release, { once: true });
    animation.addEventListener('cancel', release, { once: true });
    return animation;
  }
  // Ambient movement has an explicit pause control and respects system preferences.
  const motionControl = document.querySelector('[data-motion-toggle]');
  const marquee = document.querySelector('.experience-marquee');
  if (motionControl && marquee) {
    let paused = false;
    function updateMotion() {
      const enabled = !reduced.matches;
      marquee.toggleAttribute('data-motion-ready', enabled);
      motionControl.hidden = !enabled;
      document.body.classList.toggle('ambient-paused', paused || !enabled);
      motionControl.setAttribute('aria-pressed', String(paused));
      const label = paused ? 'Resume ambient motion' : 'Pause ambient motion';
      motionControl.setAttribute('aria-label', label);
      motionControl.querySelector('[data-motion-label]').textContent = label;
      motionControl.querySelector('[data-motion-icon]').textContent = paused ? '▷' : 'Ⅱ';
    }
    motionControl.addEventListener('click', () => { paused = !paused; updateMotion(); });
    reduced.addEventListener('change', updateMotion);
    updateMotion();
  }
  const stages = document.querySelectorAll('[data-quote-stage]');
  stages.forEach(stage => {
    const slides = [...stage.querySelectorAll('.work-feedback-quote')];
    const controls = stage.querySelector('.quote-controls');
    let current = 0;
    // Preserve the tallest quote to keep controls and following sections still.
    stage.dataset.enhanced = 'true';
    function show(next, animate = true) {
      current = (next + slides.length) % slides.length;
      slides.forEach((slide, index) => {
        slide.style.visibility = index === current ? 'visible' : 'hidden';
        slide.setAttribute('aria-hidden', String(index !== current));
        slide.inert = index !== current;
      });
      stage.querySelector('[data-quote-count]').textContent = `${current + 1} / ${slides.length}`;
      if (animate) {
        const announcement = stage.querySelector('[data-quote-announcement]');
        if (announcement) announcement.textContent = `Quote ${current + 1} of ${slides.length}. ${slides[current].textContent.trim()}`;
      }
      if (animate && !reduced.matches) animateMotion(slides[current], [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 480 });
    }
    controls.hidden = false;
    stage.querySelector('[data-quote-prev]').addEventListener('click', () => show(current - 1));
    stage.querySelector('[data-quote-next]').addEventListener('click', () => show(current + 1));
    show(0, false);
  });
  const filters = document.querySelector('[data-work-filters]');
  if (filters) {
    const cards = [...document.querySelectorAll('[data-project-grid] .folio-card')];
    const buttons = [...filters.querySelectorAll('button')];
    filters.hidden = false;
    buttons.forEach(button => button.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      cards.forEach(card => { card.hidden = button.dataset.filter !== 'All projects' && card.dataset.category !== button.dataset.filter; });
      const visible = cards.filter(card => !card.hidden);
      document.querySelector('[data-filter-status]').textContent = `${visible.length} ${visible.length === 1 ? 'project' : 'projects'} shown`;
      if (!reduced.matches) visible.forEach((card, index) => animateMotion(card, [{ opacity: .2, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: Math.min(index, 3) * 60, fill: 'backwards' }));
    }));
  }
  // Entrances follow reading order; larger media responds directly to the scroll position.
  const motionTargets = new Map();
  const revealed = new WeakSet();
  let revealObserver;
  let navigatingToAnchor = false;
  let anchorTimer;
  const compactMotion = matchMedia('(max-width: 700px)');
  const nativeScroll = typeof CSS !== 'undefined'
    && CSS.supports('animation-timeline: view()')
    && CSS.supports('animation-range: entry 0% entry 80%');

  function queueEntrance(element, delay = 0, kind = 'content') {
    if (!element || element.closest('dialog, .legal-copy, details')) return;
    if (!motionTargets.has(element)) motionTargets.set(element, { delay, kind });
  }
  function queueGroup(selector, kind = 'content') {
    document.querySelectorAll(selector).forEach(group => {
      [...group.children].forEach((element, index) => queueEntrance(element, Math.min(index, 3) * 90, kind));
    });
  }
  queueGroup('.hero-copy, .page-opening, .about-heading, .contact-opening, .case-title, .page-intro', 'opening');
  queueEntrance(document.querySelector('.shared-note'), 180, 'object');
  queueGroup('.case-hero-copy, .case-facts, .about-story');
  queueGroup('.chapter-heading, .leadership-points, .process-sequence, .mentor-offers, .lab-companions');
  queueGroup('.decised-banner, .lab-live-body, .closing-composition');
  document.querySelectorAll('.case-section-head').forEach(head => {
    queueEntrance(head.querySelector('.eyebrow'));
    queueEntrance(head.querySelector('h2'), 70);
    queueEntrance(head.querySelector('.case-prose'), 150);
  });
  document.querySelectorAll('.folio-grid').forEach(grid => {
    [...grid.children].forEach((card, index) => queueEntrance(card, (index % 3) * 90, 'card'));
  });
  document.querySelectorAll('.leadership-title, .leadership-endorsement, .leadership-evidence > article, .career-entry, .mentor-invitation > div, .mentoring-main > div, .book-item, .contact-paths > a, .invitation-panel, .quote-heading, .quote-slides, .design-tension, .case-decision-record, .case-results, .case-next, .private-context, .legal-toc').forEach(element => queueEntrance(element));
  document.querySelectorAll('[data-reveal]').forEach(element => {
    // A chapter stays in the document flow; its heading and media move independently.
    if (!element.matches('.case-section, .chapter-heading, .lab-live-feature')) queueEntrance(element);
  });

  const media = [...document.querySelectorAll('.public-cover, .case-cover, .case-figure > button:first-child, .about-person > figure')]
    .filter(element => !element.closest('details, dialog'));
  const surfaces = [...document.querySelectorAll('.product-feature, .lab-live-feature, .quote-stage, .case-outcome-band')];
  media.forEach(element => {
    element.classList.add('motion-media');
    if (!nativeScroll) queueEntrance(element, 0, 'media');
  });
  surfaces.forEach(element => {
    element.classList.add('motion-surface');
    if (!nativeScroll) queueEntrance(element, 0, 'surface');
  });

  // Never put two entrance transforms on the same branch of the reading hierarchy.
  [...motionTargets.keys()].forEach(element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (motionTargets.has(parent)) { motionTargets.delete(element); break; }
    }
  });
  function enter(element, settings) {
    if (revealed.has(element)) return;
    revealed.add(element);
    if (reduced.matches || navigatingToAnchor || element.contains(document.activeElement)) return;
    const distance = compactMotion.matches ? 18 : settings.kind === 'opening' ? 38 : 30;
    const object = ['object', 'media', 'surface'].includes(settings.kind);
    animateMotion(element, [
      { opacity: settings.kind === 'media' ? .7 : .12, transform: `translateY(${distance}px)${object ? ' scale(.96)' : ''}` },
      { opacity: 1, transform: 'none' }
    ], {
      duration: settings.kind === 'opening' || object ? 880 : 720,
      delay: compactMotion.matches ? Math.min(settings.delay, 140) : settings.delay,
      fill: 'backwards'
    });
  }
  if ('IntersectionObserver' in window && typeof Element.prototype.animate === 'function') {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || !entry.target.getClientRects().length) return;
        revealObserver.unobserve(entry.target);
        enter(entry.target, motionTargets.get(entry.target));
      });
    }, { threshold: 0, rootMargin: '0px 0px -48px 0px' });
    motionTargets.forEach((settings, element) => revealObserver.observe(element));
  }
  function settleBranch(target) {
    motionTargets.forEach((settings, element) => {
      if (element === target || target.contains(element) || element.contains(target)) {
        revealed.add(element);
        revealObserver?.unobserve(element);
        motionAnimations.get(element)?.cancel();
      }
    });
    [...media, ...surfaces].forEach(element => {
      if (element === target || target.contains(element) || element.contains(target)) element.classList.add('motion-settled');
    });
  }
  function settleHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = id && document.getElementById(id);
    if (!target) return;
    navigatingToAnchor = true;
    clearTimeout(anchorTimer);
    anchorTimer = setTimeout(() => { navigatingToAnchor = false; }, 1400);
    settleBranch(target);
  }
  document.addEventListener('focusin', event => {
    if (event.target instanceof Element) settleBranch(event.target);
  });
  window.addEventListener('hashchange', settleHash);
  window.addEventListener('pagehide', () => {
    motionAnimations.forEach(animation => animation.cancel());
    clearTimeout(anchorTimer);
  });
  function updateMotionPreference() {
    document.body.toggleAttribute('data-scroll-motion', nativeScroll && !reduced.matches);
    if (reduced.matches) motionAnimations.forEach(animation => animation.cancel());
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted) { navigatingToAnchor = false; updateMotionPreference(); }
  });
  reduced.addEventListener('change', updateMotionPreference);
  updateMotionPreference();
  settleHash();
  // Deep links can point into a disclosure; make the destination available.
  function revealAnchor() {
    let key;
    try { key = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!key) return;
    const target = document.getElementById(key);
    if (!target) return;
    let parent = target.parentElement;
    let changed = false;
    while (parent) {
      if (parent.tagName === 'DETAILS' && !parent.open) {
        parent.open = true;
        parent.querySelector(':scope > summary')?.setAttribute('aria-expanded', 'true');
        changed = true;
      }
      parent = parent.parentElement;
    }
    if (changed) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
  window.addEventListener('hashchange', revealAnchor);
  revealAnchor();
})();
