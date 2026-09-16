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
      users: { text: 'What do users need to achieve?', tasks: ['Understand the goal.', 'Explore the real journey.', 'Test with the people using it.'] },
      product: { text: 'What is worth building?', tasks: ['Define the opportunity.', 'Agree what success looks like.', 'Choose the next step.'] },
      technology: { text: 'How do we bring it to life?', tasks: ['Understand the constraints.', 'Build and test together.', 'Keep learning after launch.'] }
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
