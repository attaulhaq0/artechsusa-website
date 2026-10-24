(() => {
  const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = '/assistant-host.css'; document.head.append(sheet);
  const launcher = document.createElement('button'); launcher.className = 'ar-assistant-launcher'; launcher.type = 'button'; launcher.setAttribute('aria-label', 'Open AR TECH INC site guide'); launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-controls', 'ar-site-guide');
  const mark = document.createElement('img'); mark.src = '/assets/ar-tech-delivery-cycle-light.svg'; mark.alt = ''; launcher.append(mark);
  const panel = document.createElement('section'); panel.className = 'ar-assistant-panel'; panel.id = 'ar-site-guide'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'AR TECH INC site guide'); panel.hidden = true;
  const close = document.createElement('button'); close.className = 'ar-assistant-close'; close.type = 'button'; close.setAttribute('aria-label', 'Close site guide'); close.textContent = '×'; panel.append(close);
  let frame;
  function setOpen(open) { panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); if (open && !frame) { frame = document.createElement('iframe'); frame.title = 'AR TECH INC guided navigation'; frame.src = '/assistant.html'; panel.append(frame); } if (open) close.focus(); else launcher.focus(); }
  launcher.addEventListener('click', () => setOpen(panel.hidden)); close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });
  addEventListener('message', event => { if (event.origin === location.origin && event.source === frame?.contentWindow && event.data === 'ar-guide-close') setOpen(false); });
  document.body.append(launcher, panel);
})();
