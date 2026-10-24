(() => {
  const options = document.getElementById('guide-options'); const original = options.innerHTML;
  const thread = document.getElementById('guide-thread'); const reset = document.getElementById('guide-reset'); let data;
  options.addEventListener('click', async event => {
    const button = event.target.closest('[data-path]'); if (!button) return;
    try {
      if (!data) { const response = await fetch('/assistant-data.json', { cache: 'force-cache' }); if (!response.ok) throw new Error(); data = await response.json(); }
      const entry = data[button.dataset.path]; const paragraph = document.createElement('p'); paragraph.textContent = entry.message; thread.replaceChildren(paragraph);
      options.replaceChildren(...entry.links.map(([text, href]) => { const a = document.createElement('a'); a.textContent = text; a.href = href; a.target = '_top'; return a; })); reset.hidden = false;
      options.querySelector('a')?.focus();
    } catch { const a = document.createElement('a'); a.href = '/contact/'; a.target = '_top'; a.textContent = 'Contact AR TECH INC'; options.replaceChildren(a); reset.hidden = false; }
  });
  reset.addEventListener('click', () => { thread.replaceChildren(); options.innerHTML = original; reset.hidden = true; options.querySelector('button').focus(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') parent.postMessage('ar-guide-close', location.origin); });
})();
