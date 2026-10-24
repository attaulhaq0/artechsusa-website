(() => {
  'use strict';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const maxFile = 5 * 1024 * 1024;
  document.querySelectorAll('.ar-form').forEach(form => {
    const status = form.querySelector('[role=status]');
    const submit = form.querySelector('[type=submit]');
    const defaultText = submit.textContent;
    let token, tokenRequest;
    const getToken = async (submitSignal) => {
      if (tokenRequest) return tokenRequest;
      const controller = new AbortController();
      const abort = () => controller.abort();
      const timeout = setTimeout(abort, 45000);
      if (submitSignal) {
        submitSignal.addEventListener('abort', abort, { once: true });
        if (submitSignal.aborted) abort();
      }
      tokenRequest = (async () => {
        const response = await fetch('/api/token.php', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('The form is temporarily unavailable. Please use the email address below.');
        const data = await response.json();
        if (!data.csrf) throw new Error('The form could not be initialized. Please try again.');
        token = data.csrf; form.elements.csrf.value = token;
      })();
      try { await tokenRequest; } finally {
        clearTimeout(timeout);
        if (submitSignal) submitSignal.removeEventListener('abort', abort);
        tokenRequest = undefined;
      }
    };
    const showStatus = (message, state) => { status.textContent = message; status.dataset.status = state; };
    const fieldError = (name, message) => {
      const field = form.elements.namedItem(name);
      const error = form.querySelector('[data-error-for="' + name + '"]');
      if (error) error.textContent = message;
      if (field instanceof Element) field.setAttribute('aria-invalid', String(Boolean(message)));
    };
    const validate = () => {
      let first;
      form.querySelectorAll('[data-error-for]').forEach(el => fieldError(el.dataset.errorFor, ''));
      [...form.querySelectorAll('[required]')].forEach(field => {
        let message = '';
        if (field.type === 'checkbox' && !field.checked) message = 'Please read the Privacy Notice and agree before submitting.';
        else if (field.type === 'file') {
          const file = field.files[0];
          if (!file) message = 'Please choose your PDF resume.';
          else if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) message = 'Upload a PDF document.';
          else if (file.size > maxFile) message = 'Your PDF must be 5 MB or smaller.';
          else if (!file.size) message = 'Choose a PDF that contains your resume.';
        } else if (!field.value.trim()) message = 'Please complete this field.';
        else if (field.type === 'email' && !emailPattern.test(field.value.trim())) message = 'Enter a valid email address.';
        else if (field.name === 'name' && field.value.trim().length < 2) message = 'Enter your full name.';
        else if (field.name === 'message' && field.value.trim().length < 10) message = 'Add a little more detail, at least 10 characters.';
        if (message) { fieldError(field.name, message); first ||= field; }
      });
      if (first) { first.focus(); showStatus('Please check the highlighted fields.', 'error'); return false; }
      return true;
    };
    /* Session creation begins on form interaction, not on every page load. */
    form.addEventListener('focusin', () => { if (!token) getToken().catch(() => {}); }, { once: true });
    form.addEventListener('input', event => { if (event.target.name) fieldError(event.target.name, ''); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (submit.disabled || !validate()) return;
      submit.disabled = true; submit.textContent = form.dataset.formKind === 'application' ? 'Sending your resume…' : 'Sending…'; form.setAttribute('aria-busy', 'true'); showStatus('Sending securely. Please keep this page open.', 'pending');
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        if (!token) await getToken(controller.signal);
        const response = await fetch(form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } });
        let result;
        try { result = await response.json(); } catch { throw new Error('We could not confirm delivery. Please try again or use email.'); }
        if (!response.ok || result.success !== true) {
          if (result.errors) Object.entries(result.errors).forEach(([name, message]) => fieldError(name, message));
          token = undefined;
          throw new Error(result.message || 'Your message could not be sent. Please try again or use email.');
        }
        showStatus(form.dataset.formKind === 'application' ? 'Your resume has been sent to AR TECH INC. Thank you for introducing your experience.' : 'Your enquiry has been sent to AR TECH INC. Thank you for getting in touch.', 'success');
        document.dispatchEvent(new CustomEvent('ar-form-success', { detail: form.dataset.formKind === 'application' ? 'application' : 'contact' }));
        form.reset(); token = undefined; form.classList.add('is-complete'); status.tabIndex = -1; status.focus();
      } catch (error) {
        token = undefined;
        showStatus(error.name === 'AbortError' ? 'We could not confirm delivery before the request timed out. Please contact us by email if you need assistance.' : error.message, 'error');
      } finally { clearTimeout(timeout); submit.disabled = false; submit.textContent = defaultText; form.removeAttribute('aria-busy'); }
    });
  });
})();
