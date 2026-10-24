(() => {
  'use strict';
  const measurementId = 'G-G237X5CWEC';
  const key = 'artech-analytics-consent-v1';
  const allowed = new Set(['page_view', 'generate_lead', 'resume_submission', 'email_click']);
  const production = location.hostname === 'artechsusa.com' || location.hostname === 'www.artechsusa.com';
  let accepted = false, started = false;
  const readChoice = () => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const saved = readChoice();
  const valid = saved && ['accepted', 'rejected'].includes(saved.choice) && Date.now() - saved.time < 180 * 86400000;
  const canonical = document.querySelector('link[rel="canonical"]');
  const cleanUrl = canonical && /^https:\/\/artechsusa\.com\/[a-z0-9/-]*$/.test(canonical.href) ? canonical.href : 'https://artechsusa.com/';
  // Referrers, titles, query strings and fragments may contain personal data.
  // Only the canonical path and the approved event name enter measurement.
  const send = name => {
    if (!accepted || !production || !allowed.has(name) || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
    try { window.gtag('event', name, {send_to: measurementId, page_location: cleanUrl, page_referrer: '', page_title: 'AR TECH INC', transport_type: 'beacon'}); } catch {}
  };
  const start = () => {
    accepted = true;
    if (started || !production || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
    started = true;
    window['ga-disable-' + measurementId] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: cleanUrl, page_referrer: '', page_title: 'AR TECH INC', cookie_expires: 15552000});
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    script.referrerPolicy = 'no-referrer';
    document.head.append(script);
    send('page_view');
  };
  const clearCookies = () => {
    document.cookie.split(';').forEach(item => {
      const name = item.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) return;
      ['', location.hostname, '.' + location.hostname, '.artechsusa.com'].forEach(domain => {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : '');
      });
    });
  };
  const panel = document.createElement('section');
  panel.className = 'ar-analytics-consent';
  panel.setAttribute('aria-label', 'Analytics preferences');
  panel.hidden = true;
  panel.innerHTML = '<div><h2>Help us improve this website</h2><p>With your permission, Google Analytics measures visits and successful form submissions. We exclude form details and resume files. <a href="/privacy/">Privacy Notice</a></p></div><div class="ar-analytics-actions"><button type="button" data-choice="accepted">Accept analytics</button><button type="button" data-choice="rejected">Reject analytics</button><button type="button" data-close hidden>Close preferences</button></div>';
  document.body.append(panel);
  let returnFocus;
  const close = () => { panel.hidden = true; if (returnFocus) returnFocus.focus(); };
  panel.querySelector('[data-close]').addEventListener('click', close);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape' && readChoice()) close(); });
  panel.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    const choice = button.dataset.choice;
    try { localStorage.setItem(key, JSON.stringify({choice, time: Date.now()})); } catch {}
    close();
    if (choice === 'accepted') {
      // A previously loaded tag must be removed after revocation. Reload to
      // establish a fresh session when consent is later granted again.
      if (started && !accepted) location.reload(); else start();
    } else {
      const wasStarted = started;
      accepted = false;
      window['ga-disable-' + measurementId] = true;
      clearCookies();
      if (wasStarted) location.reload();
    }
  }));
  document.querySelectorAll('[data-analytics-preferences]').forEach(button => button.addEventListener('click', () => {
    returnFocus = button;
    panel.querySelector('[data-close]').hidden = !readChoice();
    panel.hidden = false;
    panel.querySelector('[data-choice]').focus();
  }));
  document.addEventListener('ar-form-success', event => send(event.detail === 'application' ? 'resume_submission' : 'generate_lead'));
  document.addEventListener('click', event => { if (event.target.closest('a[href^="mailto:"]')) send('email_click'); });
  if (valid && saved.choice === 'accepted') start();
  else if (!valid) panel.hidden = false;
})();

