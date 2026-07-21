(function () {
  // Guard against double-injection (SPA re-navigation, extension reload during
  // dev, etc. can re-run content scripts) - this is what caused duplicate
  // message-listener bugs before, so it stays as a hard guard.
  if (window.__skvkAutofillLoaded) return;
  window.__skvkAutofillLoaded = true;

  function normalizeText(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  function getFieldLabel(el) {
    if (el.getAttribute('aria-label')) return normalizeText(el.getAttribute('aria-label'));

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return normalizeText(label.innerText);
    }

    const parentLabel = el.closest('label');
    if (parentLabel) return normalizeText(parentLabel.innerText.replace(el.value || '', ''));

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy.split(' ')[0]);
      if (labelEl) return normalizeText(labelEl.innerText);
    }

    // Many ATS UIs build custom "labels" as a sibling div/span rather than a
    // real <label>. Walk a few previous siblings looking for short text.
    let node = el.previousElementSibling;
    let hops = 0;
    while (node && hops < 3) {
      const text = normalizeText(node.innerText || '');
      if (text && text.length < 200) return text;
      node = node.previousElementSibling;
      hops++;
    }

    if (el.placeholder) return normalizeText(el.placeholder);
    if (el.name) return normalizeText(el.name.replace(/[_-]/g, ' '));

    return '';
  }

  function collectFields() {
    const selector = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=radio]):not([type=checkbox]), textarea, select';
    return Array.from(document.querySelectorAll(selector))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        let fieldType = 'text';
        let options = null;
        if (el.tagName === 'TEXTAREA') {
          fieldType = 'textarea';
        } else if (el.tagName === 'SELECT') {
          fieldType = 'select';
          options = Array.from(el.options).map((o) => o.textContent.trim()).filter(Boolean);
        }
        return { el, label: getFieldLabel(el), fieldType, options };
      })
      .filter((f) => f.label);
  }

  function collectRadioGroups() {
    const inputs = Array.from(document.querySelectorAll('input[type=radio], input[type=checkbox]'))
      .filter((el) => el.offsetParent !== null);

    const groups = {};
    inputs.forEach((el) => {
      const key = el.name || `nogroup-${Math.random()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(el);
    });

    return Object.values(groups)
      .map((els) => {
        let label = '';
        const fieldset = els[0].closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend) label = normalizeText(legend.innerText);
        }
        if (!label) label = getFieldLabel(els[0]);

        return {
          els,
          label,
          fieldType: els[0].type,
          options: els.map((el) => getFieldLabel(el) || el.value)
        };
      })
      .filter((g) => g.label);
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillField(field, answer) {
    const { el, fieldType } = field;
    if (fieldType === 'text' || fieldType === 'textarea') {
      setNativeValue(el, answer);
    } else if (fieldType === 'select') {
      const lower = answer.trim().toLowerCase();
      const opt = Array.from(el.options).find((o) => o.textContent.trim().toLowerCase() === lower)
        || Array.from(el.options).find((o) => o.textContent.trim().toLowerCase().includes(lower));
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  function fillRadioGroup(group, answer) {
    const lower = answer.trim().toLowerCase();
    const target = group.els.find((el) => {
      const optLabel = (getFieldLabel(el) || el.value || '').toLowerCase();
      return optLabel === lower || optLabel.includes(lower) || lower.includes(optLabel);
    });
    if (target) {
      target.checked = true;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }

  function showToast(msg) {
    const existing = document.getElementById('skvk-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'skvk-toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:78px;right:24px;background:#1c2321;color:#fff;padding:10px 16px;border-radius:8px;z-index:2147483647;font-family:-apple-system,sans-serif;font-size:13.5px;box-shadow:0 4px 14px rgba(0,0,0,.25);max-width:280px';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  async function runAutofill() {
    const fields = collectFields();
    const radioGroups = collectRadioGroups();

    const questions = [
      ...fields.map((f) => ({ question: f.label, fieldType: f.fieldType, options: f.options })),
      ...radioGroups.map((g) => ({ question: g.label, fieldType: g.fieldType, options: g.options }))
    ];

    if (questions.length === 0) {
      showToast('No recognizable fields found on this page.');
      return;
    }

    showToast('Filling form...');

    chrome.runtime.sendMessage({ action: 'autofillRequest', questions }, (response) => {
      if (!response || !response.ok) {
        const msg = response?.error === 'not_logged_in'
          ? 'Log in via the extension popup first.'
          : `Autofill failed: ${response?.error || 'unknown error'}`;
        showToast(msg);
        return;
      }

      let idx = 0;
      let filledCount = 0;

      for (const f of fields) {
        const r = response.results[idx++];
        if (r && r.answer) {
          fillField(f, r.answer);
          filledCount++;
        }
      }
      for (const g of radioGroups) {
        const r = response.results[idx++];
        if (r && r.answer) {
          fillRadioGroup(g, r.answer);
          filledCount++;
        }
      }

      showToast(`Filled ${filledCount} of ${questions.length} fields. Review before submitting.`);
    });
  }

  function shouldShowButton() {
    const knownATSHosts = [
      'greenhouse.io', 'lever.co', 'myworkdayjobs.com', 'icims.com',
      'smartrecruiters.com', 'jobvite.com', 'ashbyhq.com', 'bamboohr.com',
      'taleo.net', 'successfactors.com', 'linkedin.com', 'indeed.com'
    ];
    const host = window.location.hostname;
    if (knownATSHosts.some((h) => host.includes(h))) return true;
    return document.querySelectorAll('input, textarea, select').length >= 5;
  }

  function injectButton() {
    if (!shouldShowButton() || document.getElementById('skvk-autofill-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'skvk-autofill-btn';
    btn.textContent = 'Autofill';
    btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#2d5a4a;color:#fff;border:none;padding:12px 20px;border-radius:999px;font-family:-apple-system,sans-serif;font-weight:600;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(45,90,74,.4)';
    btn.addEventListener('click', runAutofill);
    document.body.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'runAutofill') runAutofill();
  });

  const start = () => setTimeout(injectButton, 1000);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    window.addEventListener('load', start);
  }
})();
