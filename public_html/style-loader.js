/* Keep the complete cascade; let the already styled first screen paint first. */
(() => {
  const sheet = document.getElementById('ar-full-style');
  sheet.media = 'print';
  sheet.addEventListener('load', () => { sheet.media = 'all'; }, { once: true });
  sheet.rel = 'stylesheet';
  if (sheet.sheet) sheet.media = 'all';
})();
