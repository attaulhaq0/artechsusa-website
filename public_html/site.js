/* Direct-route interactions. No client-side router or scroll interception. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(hover: none)');
  const speed = () => reduced.matches ? 0 : 280;
  const selectTabs = (buttons, active, update) => {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === active));
      button.tabIndex = i === active ? 0 : -1;
      button.closest('li')?.classList.toggle('active', i === active);
    });
    update?.(active);
  };
  const arrowTabs = (buttons, choose) => buttons.forEach((button, i) => {
    button.addEventListener('keydown', event => {
      let next;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (i + 1) % buttons.length;
      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (i - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault(); choose(next); buttons[next].focus();
    });
  });

  const header = document.querySelector('.ar-site-header');
  const navigation = document.querySelector('.ar-site-nav');
  const mobileToggle = document.querySelector('.ar-mobile-toggle');
  const disclosures = [...document.querySelectorAll('.ar-nav-disclosure')];
  const menuTimers = new Map();
  function closeDropdowns(except) {
    disclosures.forEach(button => {
      if (button === except) return;
      clearTimeout(menuTimers.get(button)); menuTimers.delete(button);
      button.removeAttribute('data-hover-open');
      button.setAttribute('aria-expanded', 'false');
      document.getElementById(button.getAttribute('aria-controls')).hidden = true;
    });
  }
  function closeMenu(restore = false) {
    navigation.classList.remove('is-open'); header.classList.remove('menu-open');
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.setAttribute('aria-label', 'Open menu'); closeDropdowns();
    if (restore) mobileToggle.focus();
  }
  mobileToggle.addEventListener('click', () => {
    const open = mobileToggle.getAttribute('aria-expanded') !== 'true';
    mobileToggle.setAttribute('aria-expanded', String(open));
    mobileToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navigation.classList.toggle('is-open', open); header.classList.toggle('menu-open', open);
    if (!open) closeDropdowns();
  });
  disclosures.forEach(button => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    const item = button.closest('li');
    const clearTimer = () => { clearTimeout(menuTimers.get(button)); menuTimers.delete(button); };
    const hide = () => { clearTimer(); panel.hidden = true; button.setAttribute('aria-expanded', 'false'); button.removeAttribute('data-hover-open'); };
    const show = (hover = false) => { clearTimer(); closeDropdowns(button); panel.hidden = false; button.setAttribute('aria-expanded', 'true'); button.toggleAttribute('data-hover-open', hover); };
    button.addEventListener('click', event => {
      clearTimer();
      const open = button.getAttribute('aria-expanded') === 'true';
      const hoverOnly = button.hasAttribute('data-hover-open');
      closeDropdowns();
      if (!open || (event.detail > 0 && hoverOnly)) show();
    });
    item.addEventListener('pointerenter', () => {
      clearTimer();
      if (!coarse.matches && innerWidth > 1000 && panel.hidden) menuTimers.set(button, setTimeout(() => show(true), 160));
    });
    item.addEventListener('pointerleave', () => {
      clearTimer();
      if (coarse.matches || innerWidth <= 1000 || item.contains(document.activeElement)) return;
      menuTimers.set(button, setTimeout(hide, 140));
    });
    item.addEventListener('focusout', () => requestAnimationFrame(() => { if (!item.contains(document.activeElement)) hide(); }));
  });
  document.addEventListener('click', event => { if (!header.contains(event.target)) { closeDropdowns(); if (navigation.classList.contains('is-open')) closeMenu(); } });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = disclosures.find(button => button.getAttribute('aria-expanded') === 'true');
    if (open) { closeDropdowns(); open.focus(); }
    else if (navigation.classList.contains('is-open')) closeMenu(true);
  });
  matchMedia('(min-width: 1001px)').addEventListener('change', () => closeMenu());
  let scrollQueued = false;
  const updateHeader = () => { header.classList.toggle('is-scrolled', scrollY > 15); scrollQueued = false; };
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateHeader); } }, { passive: true }); updateHeader();

  const pageData = JSON.parse(document.getElementById('site-page-data').textContent);
  const explorerButtons = [...document.querySelectorAll('[data-explorer-index]')];
  const explorerLink = document.querySelector('.explorer-search');
  const explorerContext = document.querySelector('.explorer-context');
  let explorerIndex = 0;
  const explorerChoose = index => {
    explorerIndex = index;
    selectTabs(explorerButtons, index);
    const service = pageData.services[index];
    explorerContext.textContent = service.explorerSummary || service.summary;
    explorerContext.setAttribute('aria-labelledby', explorerButtons[index].id);
    explorerLink.setAttribute('aria-label', 'What should your technology help you do next? Explore ' + service.name);
    explorerLink.setAttribute('href', service.path);
  };
  if (explorerButtons.length) {
    const heroScene = document.querySelector('.ar-hero-scene');
    const sceneVideo = heroScene?.querySelector('video');
    const sceneUI = heroScene?.querySelector('.replica-explorer-top');
    const phoneHero = matchMedia('(max-width: 0px)');
    const sceneStartedAt = performance.now();
    let explorerHoldUntil = 0;
    let explorerPointerInside = false;
    const showHeroState = () => {
      const explorerFocused = !!sceneUI?.contains(document.activeElement);
      const sceneTime = sceneVideo?.currentTime > 0 ? sceneVideo.currentTime : ((performance.now() - sceneStartedAt) / 1000) % 8.04;
      const brandStage = phoneHero.matches || (!!sceneVideo && !reduced.matches && sceneTime >= 3.05 && !explorerFocused && !explorerPointerInside && performance.now() > explorerHoldUntil);
      heroScene?.classList.toggle('is-brand-stage', brandStage);
      if (sceneUI) sceneUI.inert = brandStage && !phoneHero.matches;
    };
    sceneVideo?.addEventListener('timeupdate', showHeroState);
    setInterval(showHeroState, 250);
    sceneUI?.addEventListener('pointerenter', () => { explorerPointerInside = true; showHeroState(); });
    sceneUI?.addEventListener('pointerleave', () => { explorerPointerInside = false; explorerHoldUntil = performance.now() + 1800; showHeroState(); });
    sceneUI?.addEventListener('focusin', showHeroState);
    sceneUI?.addEventListener('focusout', () => requestAnimationFrame(showHeroState));
    reduced.addEventListener('change', showHeroState);
    phoneHero.addEventListener('change', showHeroState);
    showHeroState();
    explorerButtons.forEach((button, index) => button.addEventListener('click', () => explorerChoose(index)));
    arrowTabs(explorerButtons, explorerChoose); explorerChoose(0);
  }

  const slider = (el, options) => {
    if (!window.Swiper) return null;
    const instance = new Swiper(el, { speed: speed(), watchOverflow: true, a11y: { enabled: true }, ...options });
    sliderInstances.push(instance); return instance;
  };
  const sliderInstances = [];
  /* Logo ribbons retain a continuous CSS phase when paused or scrolled out of view. */
  const logoRibbons = [...document.querySelectorAll('.ar-logo-ribbon')];
  const visibleLogoRibbons = new Set();
  const updateLogoMotion = () => logoRibbons.forEach(ribbon => {
    ribbon.toggleAttribute('data-logo-moving', visibleLogoRibbons.has(ribbon) && !document.hidden && !reduced.matches);
  });
  const logoObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) visibleLogoRibbons.add(target);
      else visibleLogoRibbons.delete(target);
    });
    updateLogoMotion();
  }, { threshold: .05 });
  logoRibbons.forEach(ribbon => {
    ribbon.querySelector('.ar-logo-viewport').classList.add('is-ready');
    logoObserver.observe(ribbon);
  });
  document.addEventListener('visibilitychange', updateLogoMotion);
  reduced.addEventListener('change', updateLogoMotion);
  document.querySelectorAll('.swiperHomeCards').forEach(el => {
    const instance = slider(el, { watchSlidesProgress: true, slidesPerView: 1.08, spaceBetween: 18, breakpoints: { 560: { slidesPerView: 1.5 }, 740: { slidesPerView: 2, spaceBetween: 22 }, 1150: { slidesPerView: 3, spaceBetween: 24 } } });
    const controls = document.createElement('div'); controls.className = 'ar-service-controls';
    const prev = document.createElement('button'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous services');
    const note = document.createElement('p'); note.className = 'swipe-info'; note.textContent = 'Explore the service families';
    const next = document.createElement('button'); next.type = 'button'; next.setAttribute('aria-label', 'Next services');
    controls.append(prev, note, next); el.after(controls);
    const update = () => { prev.disabled = !instance || instance.isBeginning; next.disabled = !instance || instance.isEnd; };
    prev.addEventListener('click', () => instance?.slidePrev(speed())); next.addEventListener('click', () => instance?.slideNext(speed()));
    instance?.on('slideChange', update); instance?.on('resize', update); update();
  });
  document.querySelectorAll('.successSwiper').forEach(el => {
    const region = el.closest('.success-swiper-wrap') || el;
    slider(el, { watchSlidesProgress: true, slidesPerView: 1.07, spaceBetween: 22, breakpoints: { 600: { slidesPerView: 2 }, 1000: { slidesPerView: 3, spaceBetween: 28 } }, navigation: { nextEl: region.querySelector('.successSwiperNext'), prevEl: region.querySelector('.successSwiperPrev') } });
  });
  document.querySelectorAll('.ar-delivery').forEach(el => {
    const buttons = [...el.querySelectorAll('[data-delivery-index]')];
    const panels = [...el.querySelectorAll('[role=tabpanel]')];
    const update = i => { selectTabs(buttons, i); panels.forEach((panel,index) => { panel.inert = index !== i; panel.setAttribute('aria-hidden', String(index !== i)); }); };
    const swiper = slider(el.querySelector('.ar-delivery-swiper'), { slidesPerView: 1, allowTouchMove: true, a11y: { enabled: true, slideRole: 'tabpanel' }, on: { slideChange() { update(this.activeIndex); } } });
    const choose = i => { update(i); swiper?.slideTo(i, speed()); };
    buttons.forEach((button, i) => button.addEventListener('click', () => choose(i)));
    arrowTabs(buttons, choose); choose(0);
  });
  document.querySelectorAll('.industry-wrap').forEach(el => {
    const rows = [...el.querySelectorAll('.industry-acc')];
    const buttons = [...el.querySelectorAll('[data-industry-index]')];
    const highlight = el.querySelector('.industry-acc-bg');
    let highlightFrame = 0;
    const alignHighlight = () => {
      highlightFrame = 0;
      const row = rows.find(item => item.classList.contains('active'));
      if (!highlight || !row) return;
      highlight.style.top = row.offsetTop + 'px';
      highlight.style.height = row.offsetHeight + 'px';
    };
    const queueHighlight = () => {
      if (!highlightFrame) highlightFrame = requestAnimationFrame(alignHighlight);
    };
    const swiper = slider(el.querySelector('.industrySwiper'), { slidesPerView: 1, effect: 'fade', fadeEffect: { crossFade: true }, allowTouchMove: true, on: { slideChange() { update(this.activeIndex); } } });
    function update(i) {
      rows.forEach((row, index) => {
        const active = i === index;
        row.classList.toggle('active', active);
        buttons[index].setAttribute('aria-expanded', String(active));
        const panel = row.querySelector('.industry-hidden');
        if (panel) { panel.inert = !active; panel.setAttribute('aria-hidden', String(!active)); }
      });
      queueHighlight();
    }
    const choose = i => { update(i); swiper?.slideTo(i, speed()); };
    buttons.forEach((button, i) => button.addEventListener('click', () => choose(i))); update(0);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(queueHighlight);
      rows.forEach(row => observer.observe(row));
    }
    addEventListener('resize', queueHighlight, { passive: true });
    document.fonts.ready.then(queueHighlight);
  });
  document.querySelectorAll('.exp-box').forEach(el => {
    const buttons = [...el.querySelectorAll('[data-about-index]')];
    const panels = [...el.querySelectorAll('.exp-box-txt')];
    const choose = i => selectTabs(buttons, i, current => { buttons.forEach((button, idx) => button.classList.toggle('active', idx === current)); panels.forEach((panel, idx) => { panel.classList.toggle('active', idx === current); panel.hidden = idx !== current; panel.inert = idx !== current; panel.setAttribute('aria-hidden', String(idx !== current)); }); });
    buttons.forEach((button, i) => button.addEventListener('click', () => choose(i))); arrowTabs(buttons, choose); choose(0);
  });
  document.querySelectorAll('.accordion[aria-controls]').forEach(button => button.addEventListener('click', () => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open)); panel.hidden = !open;
  }));
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    document.querySelectorAll('[data-resource-group]').forEach(card => { card.hidden = value !== 'all' && card.dataset.resourceGroup !== value; });
  }));

  /* Native digit reels: final values remain usable without motion or JavaScript. */
  const counterRecords = [...document.querySelectorAll('[data-roll-count]')].map(element => ({
    element, value: element.dataset.rollCount, strips: [], animations: []
  }));
  const finishCounter = record => {
    record.animations.forEach(animation => animation.cancel());
    record.strips.forEach(({ strip, end }) => { strip.style.transform = end; });
    record.element.dataset.counterState = 'complete';
  };
  const rollCounter = record => {
    const { element, value } = record;
    if (reduced.matches || !element.animate) { finishCounter(record); return; }
    const counter = document.createElement('span');
    counter.className = 'counter-num-artechsplatform'; counter.setAttribute('aria-hidden', 'true');
    value.split('').forEach((digit, index) => {
      const slot = document.createElement('span'); slot.className = 'digit';
      const strip = document.createElement('span'); strip.className = 'digit-inner';
      for (let i = 0; i < 20; i++) {
        const cell = document.createElement('span'); cell.textContent = String(i % 10); strip.append(cell);
      }
      slot.append(strip); counter.append(slot);
      // Percentages follow the font and viewport, including mid-animation resizes.
      const end = 'translateY(-' + ((10 + Number(digit)) * 5) + '%)';
      strip.style.transform = end; record.strips.push({ strip, end, index });
    });
    element.replaceChildren(counter); element.dataset.counterState = 'rolling';
    record.animations = record.strips.map(({ strip, end, index }) => strip.animate(
      [{ transform: 'translateY(0%)' }, { transform: end }],
      { duration: 1500 + index * 100, delay: index * 80, easing: 'cubic-bezier(.215,.61,.355,1)', fill: 'backwards' }
    ));
    Promise.all(record.animations.map(animation => animation.finished)).then(() => finishCounter(record)).catch(() => {});
  };
  const counterObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    counterObserver.unobserve(entry.target);
    const record = counterRecords.find(item => item.element === entry.target);
    if (record) rollCounter(record);
  }), { threshold: .2 });
  document.fonts.ready.then(() => counterRecords.forEach(record => counterObserver.observe(record.element)));
  reduced.addEventListener('change', () => {
    if (reduced.matches) counterRecords.forEach(record => {
      counterObserver.unobserve(record.element); finishCounter(record);
    });
  });

  /* Initialize illustrations only when close to view, and pause outside view. */
  const animationRecords = [];
  let illustrationLibrary;
  const ensureIllustrationLibrary = () => {
    if (window.lottie) return Promise.resolve();
    if (!illustrationLibrary) illustrationLibrary = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/5784aabf7fd27f.js';
      script.onload = resolve;
      script.onerror = () => { illustrationLibrary = undefined; reject(new Error('Illustration library unavailable')); };
      document.head.append(script);
    });
    return illustrationLibrary;
  };
  const visibleIllustrations = new Set();
  const lottieObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    const el = entry.target;
    if (entry.isIntersecting) visibleIllustrations.add(el); else visibleIllustrations.delete(el);
    if (!entry.isIntersecting && el._illustration) { el._illustration.pause(); return; }
    if (!entry.isIntersecting) return;
    ensureIllustrationLibrary().then(() => {
    if (!visibleIllustrations.has(el)) return;
    if (!el._illustration && window.lottie) {
      el._illustration = lottie.loadAnimation({ container: el, renderer: 'svg', loop: !reduced.matches, autoplay: false, path: el.dataset.path, rendererSettings: { progressiveLoad: true } });
      animationRecords.push(el._illustration);
      el._illustration.addEventListener('DOMLoaded', () => reduced.matches ? el._illustration.goToAndStop(24, true) : el._illustration.play());
      el.setAttribute('aria-hidden', 'true');
    } else if (el._illustration && !reduced.matches) el._illustration.play();
    }).catch(() => {});
  }), { rootMargin: '180px 0px' });
  document.querySelectorAll('.lottie[data-path]').forEach(el => lottieObserver.observe(el));
  const videos = [...document.querySelectorAll('video')];
  const mobileVideo = matchMedia('(max-width: 1000px)').matches;
  const videoObserver = new IntersectionObserver(entries => entries.forEach(({target, isIntersecting, intersectionRatio}) => {
    target.muted = true;
    if (isIntersecting && (!mobileVideo || intersectionRatio >= .85) && !reduced.matches && !document.hidden) {
      if (target.dataset.poster) { target.poster = target.dataset.poster; delete target.dataset.poster; }
      const attachSources = target.hasAttribute('data-src') || !!target.querySelector('source[data-src]');
      target.querySelectorAll('source[data-src]').forEach(source => { source.src = source.dataset.src; source.removeAttribute('data-src'); });
      if (target.dataset.src) { target.src = target.dataset.src; delete target.dataset.src; }
      if (attachSources) target.load();
      target.play().catch(() => {});
    } else target.pause();
  }), { threshold: mobileVideo ? [.1, .85] : .1 });
  const observeVideos = () => requestAnimationFrame(() => requestAnimationFrame(() => videos.forEach(video => videoObserver.observe(video))));
  if (document.readyState === 'complete') observeVideos();
  else addEventListener('load', observeVideos, { once: true });

  /* Restore the approved scroll scenes without importing the preview router. */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();
    motion.add('(min-width: 1025px) and (prefers-reduced-motion: no-preference)', () => {
      const story = document.querySelector('.fundamental-wrap');
      if (story) {
        document.body.classList.add('ar-scroll-story');
        gsap.timeline({ scrollTrigger: { trigger: story, start: 'top top', end: '+=1400', scrub: .6, pin: story, anticipatePin: 1, invalidateOnRefresh: true } })
          .to('.fundamental-head', { opacity: 0, yPercent: -80 }, 0)
          .to('.fundamentals-grid', { y: 0 }, 0)
          .to('.fundamental-wrap .comm-card', { x: 0, y: 0, stagger: .12 }, 0)
          .to('.fundamental-wrap .card-txt', { opacity: 1 }, .12);
      }
      return () => document.body.classList.remove('ar-scroll-story');
    });
    motion.add('(prefers-reduced-motion: no-preference) and (min-width: 741px)', () => {
      document.querySelectorAll('.pfHome .pf-circle').forEach(circle => {
        gsap.fromTo(circle, { scale: .5 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: circle.closest('.pfHome'), start: '0% 130%', end: '0% 75%', scrub: 0, invalidateOnRefresh: true } });
      });
    });
    motion.add({ full: '(prefers-reduced-motion: no-preference)', still: '(prefers-reduced-motion: reduce)', desktop: '(min-width: 1025px)' }, context => {
      const logo = document.querySelector('.big-logo');
      const target = document.querySelector('.about-video');
      const banner = document.querySelector('.abt-bnr');
      if (logo && target && banner) {
        const targetPosition = () => {
          const frame = logo.offsetParent || banner;
          const frameRect = frame.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          // Preserve the native optical offset while anchoring the glow to its photo.
          const opticalOffset = target.clientWidth * (innerWidth > 1024 ? 28 / 300 : .07);
          return {
            left: targetRect.left + targetRect.width / 2 - frameRect.left - frame.clientLeft - target.clientWidth / 2 - opticalOffset,
            top: targetRect.top + targetRect.height / 2 - frameRect.top - frame.clientTop - target.clientHeight / 2
          };
        };
        const destination = {
          rotate: 0,
          top: () => targetPosition().top,
          width: () => target.clientWidth,
          height: () => target.clientHeight,
          left: () => targetPosition().left,
          scale: 1.3,
          x: 0
        };
        if (context.conditions.still) {
          let still;
          const refreshStill = context.add(null, () => {
            still?.revert();
            still = gsap.set(logo, { ...destination });
          });
          refreshStill();
          const stillResize = new ResizeObserver(refreshStill);
          stillResize.observe(target);
          stillResize.observe(banner);
          ScrollTrigger.addEventListener('refresh', refreshStill);
          return () => {
            stillResize.disconnect();
            still?.kill();
            ScrollTrigger.removeEventListener('refresh', refreshStill);
          };
        }
        gsap.to(logo, { ...destination, scrollTrigger: { trigger: '.about-banner-wrap', start: 'top bottom', end: 'top 50%', scrub: 1, invalidateOnRefresh: true } });
      }
    });
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  document.querySelectorAll('.abt-bnr .comm-head-wrap').forEach(el => { el.style.opacity = '1'; });

  // Light entrances complement the native scroll and video compositions.
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('ar-in-view'); revealObserver.unobserve(entry.target); }
  }), { threshold: .08 });
  document.querySelectorAll('.fundamental-section .comm-card,.eng-section .comm-card,.artechs-initial-mark').forEach(el => { el.classList.add('ar-reveal'); revealObserver.observe(el); });
  /* Native seven-pixel binary field. Only visible cells change, three times a second. */
  const canvases = [...document.querySelectorAll('.binary-canvas')];
  const canvasStates = new WeakMap();
  const activeCanvases = new Set(); let motionFrame = 0; let lastFrame = 0;
  const canvasObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) { activeCanvases.add(target); paint(target, true); }
      else activeCanvases.delete(target);
    });
    if (activeCanvases.size && !motionFrame && !reduced.matches && !document.hidden) motionFrame = requestAnimationFrame(drawMotion);
  });
  function paint(canvas, initial = false) {
    if (!initial && canvas.closest('[data-native-visible="false"]')) return;
    let state = canvasStates.get(canvas);
    if (!state || state.dirty) {
      // Bitmap density follows the untransformed artwork plane. Scroll scale
      // must not enlarge a half-resolution field when the ring settles.
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      const density = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(density, 0, 0, density, 0, 0);
      ctx.font = '7px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      const columns = Math.floor(width / 7), rows = Math.floor(height / 7);
      const bits = new Uint8Array(columns * rows);
      for (let i = 0; i < bits.length; i++) {
        bits[i] = Math.random() < .5 ? 0 : 1;
        ctx.fillText(String(bits[i]), (i % columns) * 7, Math.floor(i / columns) * 7 + 7);
      }
      state = { ctx, bits, columns, dirty: false }; canvasStates.set(canvas, state);
      return;
    }
    if (initial || reduced.matches) return;
    const { ctx, bits, columns } = state;
    for (let i = 0; i < Math.ceil(bits.length * .01); i++) {
      const index = Math.floor(Math.random() * bits.length);
      const x = (index % columns) * 7, y = Math.floor(index / columns) * 7;
      bits[index] = bits[index] ? 0 : 1;
      ctx.clearRect(x, y, 7, 7); ctx.fillText(String(bits[index]), x, y + 7);
    }
  }
  function drawMotion(time) {
    motionFrame = 0;
    if (document.hidden || reduced.matches || !activeCanvases.size) return;
    if (time - lastFrame >= 1000 / 3) { activeCanvases.forEach(canvas => paint(canvas)); lastFrame = time; }
    motionFrame = requestAnimationFrame(drawMotion);
  }
  const canvasResizeObserver = window.ResizeObserver ? new ResizeObserver(entries => {
    entries.forEach(({ target }) => {
      const state = canvasStates.get(target); if (state) state.dirty = true;
      if (activeCanvases.has(target)) paint(target, true);
    });
  }) : null;
  canvases.forEach(canvas => {
    canvas.setAttribute('aria-hidden', 'true'); canvasObserver.observe(canvas); canvasResizeObserver?.observe(canvas);
  });
  const visibilityUpdate = () => {
    sliderInstances.forEach(s => { s.params.speed = speed(); });
    if (document.hidden || reduced.matches) { animationRecords.forEach(a => a.pause()); videos.forEach(v => v.pause()); cancelAnimationFrame(motionFrame); motionFrame = 0; }
    else { if (activeCanvases.size && !motionFrame) motionFrame = requestAnimationFrame(drawMotion); document.querySelectorAll('.lottie').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el._illustration?.play(); }); videos.forEach(v => { const r = v.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) v.play().catch(() => {}); }); }
  };
  document.addEventListener('visibilitychange', visibilityUpdate); reduced.addEventListener('change', visibilityUpdate);

  /* Prefetch a few direct pages only on user intent and a healthy connection. */
  const connection = navigator.connection; const fetched = new Set();
  const prefetch = event => {
    if (connection?.saveData || /2g/.test(connection?.effectiveType || '') || fetched.size >= 5) return;
    const a = event.target.closest('a[href]'); if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || url.hash || !url.pathname.endsWith('/')) return;
    if (fetched.has(url.pathname)) return;
    fetched.add(url.pathname); const preload = document.createElement('link'); preload.rel = 'prefetch'; preload.href = url.pathname; document.head.append(preload);
  };
  document.addEventListener('pointerover', prefetch, { passive: true }); document.addEventListener('focusin', prefetch);
})();
