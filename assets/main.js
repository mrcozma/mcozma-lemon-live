(() => {
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
  document.querySelectorAll('.process-step, .company-services details, .earlier-experience, .reading-more, .case-deep-dive').forEach(details => {
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
      if (reducedMotion.matches || typeof details.animate !== 'function') { finish(); return; }
      details.open = next;
      const end = details.getBoundingClientRect().height;
      // Keep the content rendered until the closing motion completes.
      details.open = true;
      details.style.overflow = 'clip';
      animation = details.animate([{ height: `${start}px` }, { height: `${end}px` }], {
        duration: 280, easing: 'cubic-bezier(.22,.61,.36,1)'
      });
      animation.onfinish = finish;
      animation.oncancel = finish;
    }
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

  const space = document.querySelector('.thinking-space');
  if (space) {
    const canvas = space.querySelector('.note-canvas');
    const note = space.querySelector('[data-note]');
    const handle = space.querySelector('.note-handle');
    const thought = space.querySelector('textarea');
    const checks = [...space.querySelectorAll('.note-check input')];
    const labels = [...space.querySelectorAll('.note-check span')];
    const buttons = [...space.querySelectorAll('button[data-perspective]')];
    const status = space.querySelector('[data-note-status]');
    const presets = {
      users: { text: 'What would help users move forward?', tasks: ['Start with the real need.', 'Find the barriers in the journey.', 'Test whether it helps.'] },
      product: { text: 'Which opportunity is worth pursuing?', tasks: ['Connect the need to the business.', 'Agree what success looks like.', 'Choose what to test first.'] },
      technology: { text: 'How do we make it work in practice?', tasks: ['Understand the constraints.', 'Build and test with engineering.', 'Learn from what gets used.'] }
    };
    let drafts = {};
    let perspective = 'users';
    let x = 0, y = 0, dragging = null, frame = 0;
    function remember() { drafts[perspective] = { text: thought.value, checked: checks.map(c => c.checked) }; }
    function selectPerspective(next, announce = true) {
      if (!presets[next]) return;
      remember();
      perspective = next;
      const draft = drafts[next] || { text: presets[next].text, checked: [false, false, false] };
      thought.value = draft.text;
      labels.forEach((label, i) => { label.textContent = presets[next].tasks[i]; checks[i].checked = draft.checked[i]; });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.perspective === next)));
      space.dataset.perspective = next;
      if (announce && !reducedMotion.matches && typeof note.animate === 'function') {
        space.querySelector('.note-content').animate([{opacity: .55}, {opacity: 1}], {duration: 200, easing: 'ease-out'});
      }
      if (announce) status.textContent = `${next[0].toUpperCase() + next.slice(1)} perspective. ${draft.text}`;
    }
    buttons.forEach(button => button.addEventListener('click', () => selectPerspective(button.dataset.perspective)));
    const clamp = (v, low, high) => Math.max(low, Math.min(v, Math.max(low, high)));
    function move(nextX, nextY) {
      x = clamp(nextX, 8 - note.offsetLeft, canvas.clientWidth - note.offsetWidth - note.offsetLeft - 8);
      y = clamp(nextY, 8 - note.offsetTop, canvas.clientHeight - note.offsetHeight - note.offsetTop - 8);
      note.style.setProperty('--note-x', `${x}px`);
      note.style.setProperty('--note-y', `${y}px`);
    }
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      dragging = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
      handle.setPointerCapture(event.pointerId);
      note.classList.add('dragging');
    });
    handle.addEventListener('pointermove', event => {
      if (!dragging || dragging.id !== event.pointerId) return;
      move(dragging.x + event.clientX - dragging.startX, dragging.y + event.clientY - dragging.startY);
    });
    function stopDrag() { dragging = null; note.classList.remove('dragging'); }
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
    handle.addEventListener('lostpointercapture', stopDrag);
    handle.addEventListener('keydown', event => {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (!directions[event.key]) return;
      event.preventDefault();
      const [dx, dy] = directions[event.key];
      const step = event.shiftKey ? 24 : 12;
      move(x + dx * step, y + dy * step);
    });
    canvas.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType === 'touch' || frame) return;
      const rect = canvas.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width - .5) * 18;
      const py = ((event.clientY - rect.top) / rect.height - .5) * 18;
      frame = requestAnimationFrame(() => {
        canvas.style.setProperty('--pointer-x', `${px}px`);
        canvas.style.setProperty('--pointer-y', `${py}px`);
        frame = 0;
      });
    });
    canvas.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame); frame = 0;
      canvas.style.setProperty('--pointer-x', '0px');
      canvas.style.setProperty('--pointer-y', '0px');
    });
    space.querySelector('[data-reset-note]').addEventListener('click', () => {
      drafts = {};
      perspective = 'users';
      thought.value = presets.users.text;
      checks.forEach(check => { check.checked = false; });
      selectPerspective('users', false);
      move(0, 0);
      stopDrag();
      status.textContent = 'Note reset. Ready for a new thought.';
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => move(x, y)).observe(canvas);
    selectPerspective('users', false);
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

  // Content is visible before enhancement and remains readable if JavaScript fails.
  if ('IntersectionObserver' in window && typeof Element.prototype.animate === 'function') {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (reducedMotion.matches) return;
        entry.target.animate([{ opacity: .45, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 550, easing: 'cubic-bezier(.2,.7,.25,1)'
        });
      });
    }, { threshold: .12 });
    document.querySelectorAll('.project, .belief-list article, .book-item, .mentoring-grid article').forEach(el => observer.observe(el));
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) document.getAnimations().forEach(animation => animation.cancel());
    });
  }
})();
