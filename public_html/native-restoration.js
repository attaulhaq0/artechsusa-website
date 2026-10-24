/* Native component adapters. No reference router or carousel dependency. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  document.querySelectorAll('.ar-native-careers').forEach(hero => {
    const scenes = [...hero.querySelectorAll('.home-intro__slider > .u-hd')];
    const buttons = [...hero.querySelectorAll('[data-career-scene]')];
    if (scenes.length < 2) return;
    let index = 0;
    let timer = null;
    let visible = false;
    let hovering = false;
    let focused = false;
    let manuallyChosen = false;
    const stop = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const show = next => {
      index = (next + scenes.length) % scenes.length;
      scenes.forEach((scene, i) => {
        scene.classList.toggle('is-active', i === index);
        scene.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
      const upcoming = scenes[(index + 1) % scenes.length].querySelector('img');
      if (upcoming) upcoming.loading = 'eager';
    };
    const sync = () => {
      stop();
      if (!visible || reduced.matches || document.hidden || hovering || focused || manuallyChosen) return;
      timer = setTimeout(() => { timer = null; show(index + 1); sync(); }, 6000);
    };
    buttons.forEach((button, i) => {
      button.addEventListener('click', () => { manuallyChosen = true; show(i); sync(); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? scenes.length - 1 :
          (i + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + scenes.length) % scenes.length;
        manuallyChosen = true;
        show(next); buttons[next].focus(); sync();
      });
    });
    hero.addEventListener('pointerenter', () => { hovering = finePointer.matches; sync(); });
    hero.addEventListener('pointerleave', () => { hovering = false; sync(); });
    hero.addEventListener('focusin', () => { focused = true; sync(); });
    hero.addEventListener('focusout', event => { focused = hero.contains(event.relatedTarget); sync(); });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    finePointer.addEventListener('change', () => { hovering = hovering && finePointer.matches; sync(); });
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; sync();
    }, { threshold: .15 });
    observer.observe(hero);
    show(0);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', sync);
  });

  // Ring movement uses a short settling loop; canvas/video rendering stays shared.
  const pointerRing = (surface, ring, active, travel = 220) => {
    if (!ring) return () => {};
    let frame = null;
    let x = 0, y = 0, targetX = 0, targetY = 0;
    const enabled = () => active() && !reduced.matches && finePointer.matches && !document.hidden;
    const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
    const reset = () => {
      stop(); targetX = targetY = x = y = 0;
      ring.style.transform = 'translate(0px, 0px)';
    };
    const step = () => {
      frame = null;
      if (!enabled()) return;
      x += .1 * (targetX - x); y += .1 * (targetY - y);
      ring.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      if (Math.abs(targetX - x) > .05 || Math.abs(targetY - y) > .05) frame = requestAnimationFrame(step);
    };
    surface.addEventListener('pointermove', event => {
      if (!enabled()) return;
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      targetX = travel * ((event.clientX - rect.left) / rect.width - .5);
      targetY = travel * ((event.clientY - rect.top) / rect.height - .5);
      // Keep the full binary circle inside its artwork plane as it follows
      // the pointer, including shorter mobile and tablet hero compositions.
      const plane = ring.closest('.services-ban-img-wrap,.ar-native-industry-scene');
      if (plane) {
        const bounds = plane.getBoundingClientRect();
        const moving = ring.getBoundingClientRect();
        const clamp = (value, minimum, maximum) => minimum > maximum ? 0 : Math.min(maximum, Math.max(minimum, value));
        targetX = clamp(targetX, bounds.left + 4 - (moving.left - x), bounds.right - 4 - (moving.right - x));
        targetY = clamp(targetY, bounds.top + 4 - (moving.top - y), bounds.bottom - 4 - (moving.bottom - y));
      }
      if (frame === null) frame = requestAnimationFrame(step);
    }, { passive: true });
    surface.addEventListener('pointerleave', () => {
      targetX = targetY = 0;
      if (frame === null && enabled()) frame = requestAnimationFrame(step);
    }, { passive: true });
    return reset;
  };

  document.querySelectorAll('.ar-native-service-hero').forEach(hero => {
    let visible = false;
    let focused = hero.contains(document.activeElement);
    const media = hero.querySelector('.services-ban-img');
    const reset = pointerRing(hero, media?.querySelector('.industryHover'), () => visible && !focused, 420);
    const sync = () => {
      const playing = visible && !focused && !reduced.matches && !document.hidden;
      hero.dataset.nativeVisible = playing ? 'true' : 'false';
      if (!playing || !finePointer.matches) reset();
    };
    const fitCircle = () => {
      if (!media || !media.clientHeight) return;
      // Keep the approved 65% width unless the media plane is too short.
      // Forty pixels reserve real motion space above and below the circle.
      media.style.setProperty('--ar-service-circle-limit', `${Math.max(1, media.clientHeight - 40)}px`);
      reset(); sync();
    };
    const sizeObserver = window.ResizeObserver ? new ResizeObserver(fitCircle) : null;
    if (media) sizeObserver?.observe(media);
    media?.querySelector('.ar-native-service-photo')?.addEventListener('load', fitCircle);
    window.addEventListener('resize', fitCircle, { passive: true });
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    });
    observer.observe(media || hero);
    hero.addEventListener('focusin', () => { focused = true; sync(); });
    hero.addEventListener('focusout', event => { focused = hero.contains(event.relatedTarget); sync(); });
    reduced.addEventListener('change', sync);
    finePointer.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => { hero.dataset.nativeVisible = 'false'; reset(); });
    window.addEventListener('pageshow', fitCircle);
    fitCircle(); sync();
  });

  const scenes = [...document.querySelectorAll('.ar-native-industry-scene')];
  if (scenes.length) {
    const records = new Map();
    const regions = new Map();
    const sliders = new Set();
    scenes.forEach(scene => {
      const region = scene.closest('.industry-wrap') || scene;
      const slide = scene.closest('.swiper-slide');
      const slider = slide?.closest('.swiper');
      const regionState = regions.get(region) || { focused: region.contains(document.activeElement), records: [] };
      regions.set(region, regionState);
      if (slider) sliders.add(slider);
      const record = { visible: false, reset: null, sync: null };
      const current = () => !slide || !slider || slide === (
        slider.querySelector('.swiper-slide-active') || slider.querySelector('.swiper-slide')
      );
      const active = () => record.visible && current() && !regionState.focused && !reduced.matches && !document.hidden;
      record.reset = pointerRing(scene, scene.querySelector('.industryHover'), active);
      record.sync = () => {
        const playing = active();
        scene.dataset.nativeVisible = playing ? 'true' : 'false';
        if (!playing || !finePointer.matches) record.reset();
      };
      records.set(scene, record);
      regionState.records.push(record);
      record.sync();
    });
    const sync = () => records.forEach(record => record.sync());
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const record = records.get(entry.target);
      record.visible = entry.isIntersecting;
      record.sync();
    }), { threshold: .08 });
    scenes.forEach(scene => observer.observe(scene));
    regions.forEach((state, region) => {
      const update = () => state.records.forEach(record => record.sync());
      region.addEventListener('focusin', () => { state.focused = true; update(); });
      region.addEventListener('focusout', event => { state.focused = region.contains(event.relatedTarget); update(); });
    });
    // Fade slides occupy the same viewport. Their active class determines motion.
    const slideObserver = new MutationObserver(sync);
    sliders.forEach(slider => slideObserver.observe(slider, {
      subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'inert']
    }));
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    finePointer.addEventListener('change', sync);
    window.addEventListener('pagehide', () => {
      records.forEach((record, scene) => { scene.dataset.nativeVisible = 'false'; record.reset(); });
    });
    window.addEventListener('pageshow', sync);
  }
})();

/* Keyboard and button controls for the six photographic career stories. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.ar-native-career-story').forEach(story => {
    const track = story.querySelector('.ar-native-career-story-track');
    const slides = [...story.querySelectorAll('[data-career-story-index]')];
    const progress = story.querySelector('.ar-native-career-story-progress');
    if (!track || !slides.length) return;
    let index = 0;
    let frame = null;
    const synchronize = () => {
      frame = null;
      const origin = slides[0].offsetLeft;
      const current = slides.reduce((closest, slide, position) => (
        Math.abs(slide.offsetLeft - origin - track.scrollLeft) <
        Math.abs(slides[closest].offsetLeft - origin - track.scrollLeft) ? position : closest
      ), 0);
      if (current !== index || !story.dataset.careerStoryReady) {
        index = current;
        if (progress) progress.textContent = `${index + 1} / ${slides.length}`;
        slides.forEach((slide, position) => slide.classList.toggle('is-current', position === index));
      }
      story.dataset.careerStoryReady = 'true';
    };
    const choose = next => {
      const normalized = (next + slides.length) % slides.length;
      track.scrollTo({
        left: slides[normalized].offsetLeft - slides[0].offsetLeft,
        behavior: reduced.matches ? 'instant' : 'smooth'
      });
    };
    story.querySelectorAll('[data-career-story-step]').forEach(button => {
      button.addEventListener('click', () => choose(index + Number(button.dataset.careerStoryStep)));
    });
    track.addEventListener('keydown', event => {
      if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
      let next;
      if (event.key === 'ArrowRight') next = index + 1;
      if (event.key === 'ArrowLeft') next = index - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = slides.length - 1;
      if (next === undefined) return;
      event.preventDefault(); choose(next);
    });
    track.addEventListener('scroll', () => {
      if (frame === null) frame = requestAnimationFrame(synchronize);
    }, { passive: true });
    track.addEventListener('scrollend', synchronize);
    window.addEventListener('resize', () => {
      track.scrollTo({left: slides[index].offsetLeft - slides[0].offsetLeft, behavior: 'instant'});
      synchronize();
    }, { passive: true });
    reduced.addEventListener('change', () => {
      if (reduced.matches) {
        track.scrollTo({left: slides[index].offsetLeft - slides[0].offsetLeft, behavior: 'instant'});
        synchronize();
      }
    });
    window.addEventListener('pagehide', () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    });
    window.addEventListener('pageshow', synchronize);
    synchronize();
  });
})();
