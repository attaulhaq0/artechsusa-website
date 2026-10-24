/* Source dotLottie artwork, rendered from local embedded data. No fetch/XHR. */
(() => {
  'use strict';
  const nodes = Array.from(document.querySelectorAll('[data-animation-type="lottie"]'));
  if (!nodes.length) return;
  const data = window.ArtechsHumanLottieData || {};
  const renderer = window.lottie;
  if (!renderer) {
    console.error('Local source animation renderer is unavailable.');
    return;
  }
  const lookup = new Map();
  Object.entries(data).forEach(([source, spec]) => {
    lookup.set(source, spec);
    lookup.set(spec.local, spec);
  });
  let enabled = !document.body.classList.contains('motion-paused');
  const entries = [];
  function visible(entry) {
    const rect = entry.node.getBoundingClientRect();
    return entry.node.checkVisibility({checkOpacity:true, checkVisibilityCSS:true}) &&
      rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight &&
      rect.right > 0 && rect.left < innerWidth;
  }
  function play(entry) {
    if (!entry.ready || !enabled || !visible(entry)) return;
    if (entry.player.currentFrame >= entry.player.totalFrames - 1) {
      entry.player.goToAndPlay(0, true);
    } else {
      entry.player.play();
    }
  }
  const observer = new IntersectionObserver(changes => {
    changes.forEach(change => {
      const entry = entries.find(item => item.node === change.target);
      if (!entry || !entry.ready) return;
      if (change.isIntersecting && enabled) play(entry);
      else entry.player.pause();
    });
  }, {threshold:0.08});
  nodes.forEach(node => {
    const source = node.getAttribute('data-src');
    const spec = lookup.get(source);
    if (!spec) {
      console.error('Local source animation data is unavailable:', source);
      return;
    }
    node.dataset.lottieSource = source;
    node.setAttribute('data-src', spec.local);
    node.setAttribute('aria-hidden', 'true');
    const player = renderer.loadAnimation({
      container:node,
      renderer:node.dataset.renderer || 'svg',
      loop:node.dataset.loop === '1',
      autoplay:false,
      animationData:JSON.parse(JSON.stringify(spec.animationData)),
      rendererSettings:{preserveAspectRatio:'xMidYMid meet', progressiveLoad:false}
    });
    const entry = {node, player, ready:false};
    entries.push(entry);
    player.setDirection(Number(node.dataset.direction) || 1);
    player.addEventListener('DOMLoaded', () => {
      entry.ready = true;
      if (enabled && visible(entry)) play(entry);
      else player.goToAndStop(Math.max(0, player.totalFrames - 1), true);
    });
    player.addEventListener('data_failed', () => console.error('Local source illustration could not render:', spec.key));
    observer.observe(node);
  });
  document.addEventListener('replica-motion-change', event => {
    enabled = !!event.detail?.enabled;
    entries.forEach(entry => {
      if (enabled) play(entry);
      else entry.player.pause();
    });
  });
  addEventListener('pagehide', () => {
    observer.disconnect();
    entries.forEach(entry => entry.player.destroy());
  }, {once:true});
})();
