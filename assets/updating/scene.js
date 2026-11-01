(() => {
  'use strict';
  const root = document.documentElement;
  const journey = document.querySelector('.journey');
  const viewport = document.querySelector('.viewport');
  const hero = document.querySelector('.hero');
  const update = document.querySelector('.update');
  const cue = document.querySelector('.scroll-cue');
  const cueLabel = cue.querySelector('.cue-label');
  const pageNumber = document.querySelector('#current-step');
  const pageLinks = document.querySelectorAll('.chapter-nav a');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  let frame = 0, currentChapter = -1, cancelPendingFocus = null;
  document.querySelector('#year').textContent = new Date().getFullYear();

  function updateNavigation(progress) {
    const chapter = progress > .5 ? 1 : 0;
    if (chapter === currentChapter) return;
    currentChapter = chapter;
    pageNumber.textContent = chapter ? '02' : '01';
    pageLinks.forEach((link, index) => {
      if (index === chapter) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    cue.href = chapter ? '#top' : '#updating';
    cue.classList.toggle('is-back', Boolean(chapter));
    cueLabel.textContent = chapter ? 'BACK TO TOP' : 'SCROLL TO EXPLORE';
    cue.setAttribute('aria-label', chapter ? 'Back to pygargous' : 'Scroll to updating');
  }

  function render() {
    frame = 0;
    const distance = Math.max(1, reducedMotion.matches ? update.offsetTop : journey.offsetHeight - viewport.offsetHeight);
    const progress = clamp(scrollY / distance);
    root.style.setProperty('--progress', progress.toFixed(4));
    updateNavigation(progress);
    if (reducedMotion.matches) return;
    const exit = smooth(progress / .55);
    const enter = smooth((progress - .35) / .5);
    root.style.setProperty('--hero-opacity', String(1 - exit));
    root.style.setProperty('--hero-y', `${-exit * 70}px`);
    root.style.setProperty('--hero-blur', `${exit * 8}px`);
    root.style.setProperty('--update-opacity', String(enter));
    root.style.setProperty('--update-y', `${(1 - enter) * 70}px`);
    root.style.setProperty('--update-blur', `${(1 - enter) * 8}px`);
    update.classList.toggle('is-visible', enter > 0);
    hero.setAttribute('aria-hidden', String(progress > .5));
    update.setAttribute('aria-hidden', String(progress <= .5));
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  function setMotion() {
    root.classList.toggle('enhanced', !reducedMotion.matches);
    if (reducedMotion.matches) {
      hero.removeAttribute('aria-hidden');
      update.removeAttribute('aria-hidden');
    }
    render();
  }

  function goTo(hash, behavior = 'smooth', focus = false) {
    if (cancelPendingFocus) cancelPendingFocus();
    const top = hash === '#updating' ? (reducedMotion.matches ? update.offsetTop : journey.offsetHeight - viewport.offsetHeight) : 0;
    scrollTo({ top, behavior: reducedMotion.matches ? 'instant' : behavior });
    schedule();
    if (!focus) return;
    const heading = document.querySelector(hash === '#updating' ? '#update-title' : '#hero-title');
    const finish = () => {
      cleanup();
      render();
      heading.focus({ preventScroll: true });
    };
    const timer = setTimeout(finish, reducedMotion.matches ? 0 : 1200);
    const cleanup = () => { clearTimeout(timer); removeEventListener('scrollend', finish); cancelPendingFocus = null; };
    cancelPendingFocus = cleanup;
    addEventListener('scrollend', finish, { once: true });
  }

  document.querySelectorAll('a[href="#top"],a[href="#updating"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const hash = link.getAttribute('href');
      try { history.replaceState(null, '', hash); } catch (_) { /* Navigation still works in restricted local previews. */ }
      goTo(hash, 'smooth', event.detail === 0);
    });
  });
  function navigateToHash() {
    if (location.hash === '#updating' || location.hash === '#top') goTo(location.hash, 'instant');
    else schedule();
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('hashchange', navigateToHash);
  addEventListener('pageshow', schedule);
  reducedMotion.addEventListener('change', setMotion);
  setMotion();
  requestAnimationFrame(navigateToHash);
})();
