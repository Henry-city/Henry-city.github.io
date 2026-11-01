(() => {
  'use strict';
  const root = document.documentElement;
  const journey = document.querySelector('.journey');
  const viewport = document.querySelector('.viewport');
  const sections = [...document.querySelectorAll('.page-section')];
  const sectionIds = sections.map(section => section.dataset.section);
  const cue = document.querySelector('.scroll-cue');
  const cueLabel = cue.querySelector('.cue-label');
  const pageNumber = document.querySelector('#current-step');
  const pageLinks = [...document.querySelectorAll('.chapter-nav a')];
  const primaryLinks = [...document.querySelectorAll('.primary-nav a')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  let frame = 0, currentChapter = -1, cancelPendingFocus = null, storyOpen = false;
  document.querySelector('#year').textContent = new Date().getFullYear();

  function sectionTop(index) {
    return reducedMotion.matches ? sections[index].offsetTop : index * (journey.offsetHeight - viewport.offsetHeight) / (sections.length - 1);
  }

  function updateNavigation(chapter) {
    if (chapter === currentChapter) return;
    currentChapter = chapter;
    pageNumber.textContent = String(chapter + 1).padStart(2, '0');
    [...pageLinks, ...primaryLinks].forEach(link => {
      if (link.getAttribute('href') === `#${sectionIds[chapter]}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const last = chapter === sections.length - 1;
    const next = last ? 0 : chapter + 1;
    cue.href = `#${sectionIds[next]}`;
    cue.classList.toggle('is-back', last);
    cueLabel.textContent = last ? 'BACK TO TOP' : chapter === 0 ? 'SCROLL TO EXPLORE' : 'SCROLL TO CONTINUE';
    cue.setAttribute('aria-label', last ? 'Back to pygargous' : `Scroll to ${['Home', 'Projects', 'Research', 'CV'][next]}`);
  }

  function render() {
    frame = 0;
    if (storyOpen) return;
    const span = Math.max(1, reducedMotion.matches ? sections.at(-1).offsetTop : journey.offsetHeight - viewport.offsetHeight);
    const progress = clamp(scrollY / span);
    const position = progress * (sections.length - 1);
    const chapter = Math.round(position);
    root.style.setProperty('--progress', progress.toFixed(4));
    updateNavigation(chapter);
    sections.forEach((section, index) => {
      if (reducedMotion.matches) {
        section.removeAttribute('aria-hidden');
        section.inert = false;
        return;
      }
      const delta = index - position;
      const opacity = 1 - smooth((Math.abs(delta) - .08) / .5);
      section.style.setProperty('--section-opacity', opacity.toFixed(4));
      section.style.setProperty('--section-y', `${(Math.max(-1, Math.min(1, delta)) * 70).toFixed(2)}px`);
      section.style.setProperty('--section-blur', `${((1 - opacity) * 6).toFixed(2)}px`);
      section.classList.toggle('is-visible', opacity > .001);
      section.setAttribute('aria-hidden', String(index !== chapter));
      section.inert = index !== chapter;
    });
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  function setMotion() {
    const chapter = Math.max(0, currentChapter);
    root.classList.toggle('enhanced', !reducedMotion.matches);
    if (!storyOpen) scrollTo({ top: sectionTop(chapter), behavior: 'instant' });
    render();
  }

  function goTo(index, behavior = 'smooth', focus = false) {
    if (cancelPendingFocus) cancelPendingFocus();
    scrollTo({ top: sectionTop(index), behavior: reducedMotion.matches ? 'instant' : behavior });
    schedule();
    if (!focus) return;
    const heading = sections[index].querySelector('h1,h2');
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

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const hash = link.getAttribute('href');
      const index = sectionIds.indexOf(hash.slice(1));
      if (index < 0) return;
      event.preventDefault();
      try { history.replaceState(null, '', hash); } catch (_) { /* Local previews can restrict history. */ }
      goTo(index, 'smooth', event.detail === 0);
    });
  });
  function navigateToHash() {
    const id = location.hash === '#updating' ? 'projects' : location.hash.slice(1);
    const index = sectionIds.indexOf(id);
    if (index >= 0) goTo(index, 'instant');
    else schedule();
  }

  function initCoverStories() {
    const trigger = document.querySelector('.cover-trigger');
    const dialog = document.querySelector('#cover-viewer');
    const gallery = dialog.querySelector('.cover-gallery');
    const close = dialog.querySelector('.cover-close');
    const back = dialog.querySelector('.cover-back');
    const previous = dialog.querySelector('.cover-prev');
    const next = dialog.querySelector('.cover-next');
    const dates = dialog.querySelector('.cover-dates');
    const number = dialog.querySelector('.cover-number');
    const description = dialog.querySelector('.cover-description');
    const location = dialog.querySelector('.cover-location');
    const locationLabel = dialog.querySelector('.cover-location-label');
    let covers;
    try { covers = JSON.parse(document.querySelector('#cover-data').textContent); } catch (_) { return; }
    if (!Array.isArray(covers) || !covers.length || typeof dialog.showModal !== 'function') return;
    let activeCover = -1, savedScroll = 0, savedFocus = null, closing = false, galleryFrame = 0, drag = null;
    const formatDate = date => date ? date.replaceAll('-', '.') : 'PRESENT';
    covers.forEach((cover, index) => {
      const figure = document.createElement('figure');
      figure.className = 'cover-slide';
      figure.setAttribute('aria-label', `Cover ${cover.id}: ${cover.title}`);
      const photo = document.createElement('img');
      photo.src = cover.image;
      photo.alt = cover.alt || cover.title;
      photo.loading = index === 0 ? 'eager' : 'lazy';
      photo.decoding = 'async';
      photo.draggable = false;
      figure.append(photo);
      gallery.append(figure);
    });
    const slides = [...gallery.children];
    const hasHistory = covers.length > 1;
    gallery.classList.toggle('has-history', hasHistory);
    previous.hidden = next.hidden = !hasHistory;

    function showCaption(index) {
      if (index === activeCover) return;
      activeCover = index;
      const cover = covers[index];
      dates.textContent = `${formatDate(cover.startedAt)} — ${formatDate(cover.endedAt)}`;
      number.textContent = `COVER ${cover.id}`;
      description.textContent = cover.description;
      const place = [cover.location?.country, cover.location?.city].filter(Boolean).join(' · ');
      location.hidden = !place;
      locationLabel.textContent = place;
      if ((index === 0 && document.activeElement === previous) || (index === covers.length - 1 && document.activeElement === next)) {
        gallery.focus({ preventScroll: true });
      }
      previous.disabled = index === 0;
      next.disabled = index === covers.length - 1;
      slides.forEach((slide, slideIndex) => slide.setAttribute('aria-hidden', String(slideIndex !== index)));
    }
    function slideTo(index, behavior = 'smooth') {
      const destination = Math.max(0, Math.min(covers.length - 1, index));
      gallery.scrollTo({ left: destination * gallery.clientWidth, behavior: reducedMotion.matches ? 'instant' : behavior });
      if (behavior === 'instant' || reducedMotion.matches) showCaption(destination);
    }
    gallery.addEventListener('scroll', () => {
      if (galleryFrame) return;
      galleryFrame = requestAnimationFrame(() => {
        galleryFrame = 0;
        if (!gallery.clientWidth) return;
        showCaption(Math.max(0, Math.min(covers.length - 1, Math.round(gallery.scrollLeft / gallery.clientWidth))));
      });
    }, { passive: true });
    previous.addEventListener('click', () => slideTo(activeCover - 1));
    next.addEventListener('click', () => slideTo(activeCover + 1));
    dialog.addEventListener('keydown', event => {
      if (!hasHistory || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      slideTo(activeCover + (event.key === 'ArrowLeft' ? -1 : 1));
    });
    gallery.addEventListener('pointerdown', event => {
      if (!hasHistory || event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { id: event.pointerId, start: event.clientX, left: gallery.scrollLeft };
      gallery.setPointerCapture(event.pointerId);
    });
    gallery.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const distance = event.clientX - drag.start;
      if (Math.abs(distance) > 5) gallery.classList.add('is-dragging');
      if (gallery.classList.contains('is-dragging')) gallery.scrollLeft = drag.left - distance;
    });
    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const index = Math.round(gallery.scrollLeft / gallery.clientWidth);
      if (gallery.hasPointerCapture(drag.id)) gallery.releasePointerCapture(drag.id);
      drag = null;
      gallery.classList.remove('is-dragging');
      slideTo(index);
    }
    gallery.addEventListener('pointerup', finishDrag);
    gallery.addEventListener('pointercancel', finishDrag);
    addEventListener('resize', () => { if (storyOpen) slideTo(activeCover, 'instant'); }, { passive: true });

    function openStory() {
      if (storyOpen) return;
      if (cancelPendingFocus) cancelPendingFocus();
      savedScroll = scrollY;
      savedFocus = document.activeElement;
      scrollTo({ top: savedScroll, behavior: 'instant' });
      storyOpen = true;
      closing = false;
      dialog.showModal();
      root.classList.add('cover-open');
      document.body.classList.add('cover-open');
      trigger.setAttribute('aria-expanded', 'true');
      slideTo(0, 'instant');
      back.focus({ preventScroll: true });
      requestAnimationFrame(() => requestAnimationFrame(() => { if (storyOpen && !closing) dialog.classList.add('is-visible'); }));
    }
    function closeStory() {
      if (!storyOpen || closing) return;
      closing = true;
      dialog.classList.remove('is-visible');
      root.classList.remove('cover-open');
      document.body.classList.remove('cover-open');
      setTimeout(() => {
        dialog.close();
        storyOpen = false;
        closing = false;
        trigger.setAttribute('aria-expanded', 'false');
        scrollTo({ top: savedScroll, behavior: 'instant' });
        render();
        (savedFocus?.isConnected ? savedFocus : trigger).focus({ preventScroll: true });
      }, reducedMotion.matches ? 0 : 560);
    }
    close.addEventListener('click', closeStory);
    back.addEventListener('click', closeStory);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeStory(); });
    trigger.addEventListener('click', openStory);
    showCaption(0);
    trigger.hidden = false;
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('hashchange', navigateToHash);
  addEventListener('pageshow', schedule);
  reducedMotion.addEventListener('change', setMotion);
  setMotion();
  initCoverStories();
  requestAnimationFrame(navigateToHash);
})();
