(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionAnimations = new Map();
  function animateMotion(element, keyframes, options = {}) {
    if (reduced.matches) return;
    if (window.PortfolioMotion) {
      window.PortfolioMotion.transition(element, { y: 16, opacity: keyframes[0].opacity, duration: (options.duration || 360) / 1000, delay: (options.delay || 0) / 1000 });
      return;
    }
    if (typeof element.animate !== 'function') return;
    motionAnimations.get(element)?.cancel();
    const animation = element.animate(keyframes, { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)', ...options });
    // Interrupted transitions are expected when navigating or changing preferences.
    animation.finished?.catch(() => {});
    motionAnimations.set(element, animation);
    const release = () => { if (motionAnimations.get(element) === animation) motionAnimations.delete(element); };
    animation.addEventListener('finish', release, { once: true });
    animation.addEventListener('cancel', release, { once: true });
    return animation;
  }
  // One visible perspective, with every panel readable when enhancement is absent.
  document.querySelectorAll('[data-view-switcher]').forEach(switcher => {
    const controls = switcher.querySelector('[data-view-controls]');
    const buttons = [...controls.querySelectorAll('[data-view]')];
    const panels = [...switcher.querySelectorAll('[data-view-panel]')];
    let current = buttons[0].dataset.view;
    switcher.dataset.enhanced = 'true';
    controls.hidden = false;
    function show(view, animate = true) {
      if (!panels.some(panel => panel.dataset.viewPanel === view)) return;
      current = view;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
      panels.forEach(panel => {
        const selected = panel.dataset.viewPanel === view;
        panel.style.visibility = selected ? 'visible' : 'hidden';
        panel.setAttribute('aria-hidden', String(!selected));
        panel.inert = !selected;
        if (selected && animate) {
          animateMotion(panel, [{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
          window.PortfolioMotion?.illustrate(panel);
        }
      });
      switcher.querySelectorAll('[data-phase]').forEach(phase => {
        phase.toggleAttribute('data-active',phase.dataset.phase === view);
        phase.removeAttribute('data-preview');
        if (phase.dataset.phase === view && animate) window.PortfolioMotion?.illustrate(phase);
      });
    }
    buttons.forEach((button,index) => {
      button.addEventListener('click', () => { if (button.dataset.view !== current) show(button.dataset.view); });
      button.addEventListener('pointerenter', () => {
        switcher.querySelectorAll('[data-phase]').forEach(phase => phase.toggleAttribute('data-preview', phase.dataset.phase === button.dataset.view));
      });
      button.addEventListener('pointerleave', () => switcher.querySelectorAll('[data-preview]').forEach(phase => phase.removeAttribute('data-preview')));
      button.addEventListener('keydown', event => {
        const directions = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next;
        if (event.key in directions) next = (index + directions[event.key] + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next].focus();
        show(buttons[next].dataset.view);
      });
    });
    switcher.querySelectorAll('[data-phase]').forEach(phase => phase.addEventListener('click', () => {
      const button = buttons.find(item => item.dataset.view === phase.dataset.phase);
      if (!button) return;
      button.focus({ preventScroll: true });
      show(button.dataset.view);
    }));
    show(current,false);
  });
  // The compact Home notes have their own controls and interruptible paper transition.
  document.querySelectorAll('[data-notes]').forEach(notes => {
    const panels = [...notes.querySelectorAll('[data-note]')];
    const controls = notes.querySelector('[data-note-controls]');
    const previous = notes.querySelector('[data-note-prev]');
    const next = notes.querySelector('[data-note-next]');
    const reset = notes.querySelector('[data-note-reset]');
    const count = notes.querySelector('[data-note-count]');
    const status = notes.querySelector('[data-note-status]');
    let current = 0, timeline;
    notes.dataset.enhanced = 'true';
    controls.hidden = false;
    function updateReset() {
      reset.setAttribute('aria-disabled',String(!panels[current].querySelector('input:checked')));
    }
    function paint() {
      panels.forEach((panel,index) => {
        const selected = index === current;
        panel.style.visibility = selected ? 'visible' : 'hidden';
        panel.setAttribute('aria-hidden',String(!selected));
        panel.inert = !selected;
      });
      count.textContent = `${String(current+1).padStart(2,'0')} / ${String(panels.length).padStart(2,'0')}`;
      updateReset();
    }
    function settle() {
      timeline?.kill();
      timeline = undefined;
      if (window.gsap) window.gsap.set(panels,{clearProps:'transform,opacity,zIndex'});
      else panels.forEach(panel => ['transform','opacity','z-index'].forEach(property => panel.style.removeProperty(property)));
      paint();
    }
    function show(index, direction) {
      const target = (index + panels.length) % panels.length;
      if (target === current) return;
      const outgoing = panels[current];
      settle();
      current = target;
      paint();
      const incoming = panels[current];
      status.textContent = `Note ${current+1} of ${panels.length}: ${incoming.dataset.noteLabel}`;
      if (!window.gsap || reduced.matches || document.hidden) return;
      // Only the incoming note is exposed to assistive technology during the overlap.
      outgoing.style.visibility = 'visible';
      outgoing.style.zIndex = '1';
      incoming.style.zIndex = '2';
      timeline = window.gsap.timeline({onComplete:settle});
      timeline.to(outgoing,{x:-direction*26,y:5,scale:.98,opacity:0,duration:.2,ease:'power2.in'},0)
        .fromTo(incoming,{x:direction*34,y:-8,scale:.98,opacity:0},{x:0,y:0,scale:1,opacity:1,duration:.42,ease:'power3.out'},.1);
    }
    previous.addEventListener('click',() => show(current-1,-1));
    next.addEventListener('click',() => show(current+1,1));
    controls.addEventListener('keydown',event => {
      if (event.target === reset) return;
      const directions = {ArrowLeft:-1,ArrowRight:1};
      if (event.key in directions) {
        event.preventDefault();
        show(current+directions[event.key],directions[event.key]);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        show(event.key === 'Home' ? 0 : panels.length-1,event.key === 'Home' ? -1 : 1);
      }
    });
    notes.addEventListener('change',updateReset);
    reset.addEventListener('click',() => {
      if (reset.getAttribute('aria-disabled') === 'true') return;
      panels[current].querySelectorAll('input[type="checkbox"]').forEach(input => {input.checked=false;});
      updateReset();
      status.textContent = `${panels[current].dataset.noteLabel}: checklist reset`;
    });
    reduced.addEventListener('change',settle);
    window.addEventListener('pagehide',settle);
    window.addEventListener('pageshow',settle);
    document.addEventListener('visibilitychange',() => {if(document.hidden) settle();});
    paint();
  });

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
      document.dispatchEvent(new Event('portfolio:ambient'));
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
  // A calm, opt-in auto carousel. Colleague carousels remain entirely manual.
  document.querySelectorAll('[data-mentor-carousel]').forEach(carousel => {
    const slides = [...carousel.querySelectorAll('.mentor-slide')];
    const controls = carousel.querySelector('.mentor-carousel-controls');
    const toggle = carousel.querySelector('[data-mentor-toggle]');
    const count = carousel.querySelector('[data-mentor-count]');
    const announcement = carousel.querySelector('[data-mentor-announcement]');
    let current = 0, timer, inView = false, hovered = false, focusPaused = false, userPaused = false, suspended = false;
    const canPlay = () => inView && !hovered && !focusPaused && !userPaused && !suspended && !document.hidden && !reduced.matches;
    function schedule() {
      clearTimeout(timer);
      toggle.hidden = reduced.matches;
      toggle.setAttribute('aria-label', userPaused ? 'Resume automatic feedback' : 'Pause automatic feedback');
      toggle.innerHTML = userPaused ? 'Resume <span aria-hidden="true">▷</span>' : 'Pause <span aria-hidden="true">Ⅱ</span>';
      carousel.dataset.autoplay = canPlay() ? 'running' : 'paused';
      if (canPlay()) timer = setTimeout(() => {
        if (canPlay()) show(current + 1, false);
        schedule();
      }, 9000);
    }
    function show(next, manual) {
      current = (next + slides.length) % slides.length;
      slides.forEach((slide,index) => {
        const active = index === current;
        slide.style.visibility = active ? 'visible' : 'hidden';
        slide.setAttribute('aria-hidden', String(!active));
        slide.inert = !active;
      });
      count.textContent = `${current + 1} / ${slides.length}`;
      if (manual) {
        userPaused = true;
        announcement.textContent = `Feedback ${current + 1} of ${slides.length}. ${slides[current].querySelector("blockquote").textContent.trim()} ${slides[current].querySelector("figcaption > span").firstChild.textContent.trim()}.`;
      }
      animateMotion(slides[current], [{ opacity: 0 }, { opacity: 1 }], { duration: 550 });
    }
    carousel.dataset.enhanced = 'true';
    controls.hidden = false;
    // Initialise without an entrance or a live announcement.
    slides.forEach((slide,index) => {
      slide.style.visibility = index ? 'hidden' : 'visible';
      slide.setAttribute('aria-hidden', String(index !== 0));
      slide.inert = index !== 0;
    });
    carousel.querySelector('[data-mentor-prev]').addEventListener('click', () => { show(current - 1, true); schedule(); });
    carousel.querySelector('[data-mentor-next]').addEventListener('click', () => { show(current + 1, true); schedule(); });
    toggle.addEventListener('click', () => { userPaused = !userPaused; if (!userPaused) focusPaused = false; schedule(); });
    carousel.addEventListener('pointerenter', () => { hovered = true; schedule(); });
    carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    carousel.addEventListener('focusin', () => { focusPaused = true; schedule(); });
    carousel.addEventListener('focusout', event => { if (!carousel.contains(event.relatedTarget)) { focusPaused = false; schedule(); } });
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', schedule);
    window.addEventListener('pagehide', () => { suspended = true; schedule(); });
    window.addEventListener('pageshow', () => { suspended = false; schedule(); });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; schedule(); }, { threshold: .25 });
      observer.observe(carousel);
    }
    schedule();
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
      document.dispatchEvent(new Event('portfolio:layout'));
      document.querySelector('[data-filter-status]').textContent = `${visible.length} ${visible.length === 1 ? 'project' : 'projects'} shown`;
      if (!reduced.matches) visible.forEach((card, index) => animateMotion(card, [{ opacity: .2, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: Math.min(index, 3) * 60, fill: 'backwards' }));
    }));
  }
  reduced.addEventListener('change', () => { if (reduced.matches) motionAnimations.forEach(animation => animation.cancel()); });
  window.addEventListener('pagehide', () => motionAnimations.forEach(animation => animation.cancel()));
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
  // Initial fragments must use the enhanced panel heights and the loaded font.
  if (location.hash && document.querySelector('[data-view-switcher], [data-notes]')) {
    const initialHash = location.hash;
    let interrupted = false;
    const stop = () => { interrupted = true; };
    const events = ['wheel','touchstart','pointerdown','keydown'];
    events.forEach(event => window.addEventListener(event,stop,{once:true,passive:true}));
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(resolve => window.addEventListener('load',resolve,{once:true}));
    Promise.all([loaded,document.fonts?.ready || Promise.resolve()]).then(() => requestAnimationFrame(() => {
      events.forEach(event => window.removeEventListener(event,stop));
      if (interrupted || location.hash !== initialHash) return;
      let id;
      try { id = decodeURIComponent(initialHash.slice(1)); } catch { return; }
      document.getElementById(id)?.scrollIntoView({block:'start',behavior:'instant'});
      window.PortfolioMotion?.refresh();
    }));
  }
})();
