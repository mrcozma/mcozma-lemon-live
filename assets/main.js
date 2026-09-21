(() => {
  // Directory indexes keep public and private URLs clean on static hosts.
  if (/^https?:$/.test(location.protocol) && location.pathname.endsWith('/index.html')) {
    location.replace(location.pathname.slice(0, -10) + location.search + location.hash);
    return;
  }
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  const wide = matchMedia('(min-width: 701px)');
  function closeMenu() {
    toggle?.setAttribute('aria-expanded', 'false');
    navigation?.classList.remove('open');
  }
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    navigation?.classList.toggle('open', open);
    if (open && !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof navigation?.animate === 'function') {
      if (window.PortfolioMotion) window.PortfolioMotion.transition(navigation, { y: -10, duration: .3 });
      else navigation.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
  navigation?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  wide.addEventListener('change', closeMenu);
  document.querySelectorAll('[data-year]').forEach(element => { element.textContent = new Date().getFullYear(); });

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Keep native disclosures usable without scripts; enhance their size change.
  const disclosures = new Map();
  document.querySelectorAll('.process-step, .company-services details, .earlier-experience, .reading-more, .case-deep-dive, .story-disclosure').forEach(details => {
    const summary = details.querySelector(':scope > summary');
    if (!summary) return;
    const group = details.getAttribute('name');
    if (group) details.removeAttribute('name');
    let animation = null;
    let expanded = details.open;
    function finish() {
      details.open = expanded;
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      summary.setAttribute('aria-expanded', String(expanded));
      animation = null;
    }
    function setExpanded(next) {
      const start = details.getBoundingClientRect().height;
      if (animation) {
        animation.onfinish = null;
        animation.oncancel = null;
        animation.cancel();
      }
      expanded = next;
      summary.setAttribute('aria-expanded', String(next));
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      if (reducedMotion.matches || (!window.PortfolioMotion && typeof details.animate !== 'function')) { finish(); return; }
      details.open = next;
      const end = details.getBoundingClientRect().height;
      // Keep the content rendered until the closing motion completes.
      details.open = true;
      details.style.overflow = 'clip';
      if (window.PortfolioMotion) { animation = window.PortfolioMotion.resize(details, start, end, finish); return; }
      animation = details.animate([{ height: `${start}px` }, { height: `${end}px` }], {
        duration: 360, easing: 'cubic-bezier(.16,1,.3,1)'
      });
      animation.onfinish = finish;
      animation.oncancel = finish;
    }
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches && animation) { animation.cancel(); finish(); }
    });
    window.addEventListener('pagehide', () => { if (animation) { animation.cancel(); finish(); } });
    disclosures.set(details, { group, setExpanded, isExpanded: () => expanded });
    summary.addEventListener('click', event => {
      event.preventDefault();
      const next = !expanded;
      if (next && group) disclosures.forEach((other, element) => {
        if (element !== details && other.group === group && other.isExpanded()) other.setExpanded(false);
      });
      setExpanded(next);
    });
    summary.setAttribute('aria-expanded', String(expanded));
    details.addEventListener('toggle', () => {
      if (animation) return;
      expanded = details.open;
      summary.setAttribute('aria-expanded', String(expanded));
    });
  });

  // Saved public access links retain only known project context.
  const request = document.querySelector('[data-access-request]');
  if (request) {
    const projects = { google: 'Google', three: 'Three UK', ubs: 'UBS', jlr: 'JLR / Range Rover', 'legal-and-general': 'Legal & General', 'virgin-media': 'Virgin Media', totaljobs: 'Totaljobs' };
    const key = new URLSearchParams(location.search).get('project');
    if (Object.hasOwn(projects, key)) {
      const project = projects[key];
      document.querySelector('[data-access-context]').textContent = `Interested in ${project}? Include a little context about the opportunity or conversation.`;
      request.href = `mailto:mc@mrcozma.com?subject=${encodeURIComponent(project + ' case study access')}&body=${encodeURIComponent("Hi Marian,\n\nI’d like to request access to your " + project + " case study.\n\nName:\nOrganisation:\nReason for request:")}`;
    }
  }

  const recommendations = document.querySelector('.recommendations');
  if (recommendations) {
    const track = recommendations.querySelector('.recommendation-track');
    const controls = [...recommendations.querySelectorAll('[data-review-direction]')];
    recommendations.dataset.enhanced = 'true';
    function updateReviewControls() {
      controls.forEach(button => {
        button.disabled = Number(button.dataset.reviewDirection) < 0
          ? track.scrollLeft <= 2
          : track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      });
    }
    function moveReviews(direction) {
      const card = track.querySelector('.recommendation-card');
      const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
      const distance = card.getBoundingClientRect().width + gap;
      track.scrollBy({ left: direction * distance, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
    controls.forEach(button => button.addEventListener('click', () => moveReviews(Number(button.dataset.reviewDirection))));
    track.addEventListener('keydown', event => {
      if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      moveReviews(event.key === 'ArrowRight' ? 1 : -1);
    });
    track.addEventListener('scroll', updateReviewControls, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(updateReviewControls).observe(track);
    updateReviewControls();
  }

  // The work index reflects reading position without moving the page or focus.
  const workIndex = document.querySelector('[data-work-index]');
  if (workIndex) {
    const links = [...workIndex.querySelectorAll('a')];
    const rows = links.map(link => document.getElementById(link.hash.slice(1)));
    links.forEach(link => { link.dataset.projectLabel = link.textContent; });
    let workFrame = 0;
    function updateWorkIndex() {
      workFrame = 0;
      const line = workIndex.getBoundingClientRect().bottom + 70;
      const current = rows.filter(row => row && row.getBoundingClientRect().top <= line).pop();
      links.forEach(link => {
        if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', () => {
      if (!workFrame) workFrame = requestAnimationFrame(updateWorkIndex);
    }, { passive: true });
    window.addEventListener('resize', updateWorkIndex);
    updateWorkIndex();
  }

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) disclosures.forEach(control => control.setExpanded(control.isExpanded()));
  });
})();
