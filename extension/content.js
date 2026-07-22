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

  // ---- Repeating "Experience" / "Education" section handling ----
  //
  // Workday-style ATS pages (like the RTX example this was built against)
  // don't render Experience/Education as a flat set of fields - they start
  // with zero entries and require clicking "+ Add Experience" / "+ Add
  // Education" once per entry, which injects a fresh block of fields each
  // time. Those blocks have no stable id/label tying them back to "entry 2",
  // so the only reliable way to know which fields belong to which saved
  // profile entry is to click Add, diff the DOM for what just appeared, and
  // treat that as one block - in click order, which matches array order.
  //
  // This intentionally fills these fields directly from
  // profile.experience[i] / profile.education[i] rather than sending them
  // through the Q&A bank/Gemini pipeline: those are exact facts (company
  // names, dates) the person already typed into their Profile tab once,
  // and re-deriving them via AI or bigram matching per field is both
  // unnecessary and the thing the README explicitly says the AI fallback
  // should never be asked to invent.

  const ADD_BUTTON_PATTERNS = {
    experience: /\+?\s*add\s*(work(ing)?\s*)?experience\b/i,
    education: /\+?\s*add\s*education\b/i
  };

  const SUBFIELD_RULES = {
    experience: [
      { test: /\bjob\s*title\b|\btitle\b|\bposition\b|\brole\b/i, key: 'title' },
      { test: /\bcompany\b|\bemployer\b|\borganization\b/i, key: 'company' },
      { test: /\blocation\b|\bcity\b/i, key: 'location' },
      { test: /\b(currently|current(ly)?\s*work|i\s*(currently\s*)?work\s*here|present)\b/i, key: 'current' },
      { test: /\bstart\s*date\b|\bfrom\b/i, key: 'startDate' },
      { test: /\bend\s*date\b|\bto\b/i, key: 'endDate' },
      { test: /\bdescription\b|\bresponsibilit(y|ies)\b|\bsummary\b|\bdetails\b/i, key: 'description' }
    ],
    education: [
      { test: /\bschool\b|\buniversity\b|\bcollege\b|\binstitution\b/i, key: 'school' },
      { test: /\bdegree\b/i, key: 'degree' },
      { test: /\bfield\s*of\s*study\b|\bmajor\b/i, key: 'fieldOfStudy' },
      { test: /\bstart\s*date\b|\bfrom\b/i, key: 'startDate' },
      { test: /\bend\s*date\b|\bgraduat/i, key: 'endDate' },
      { test: /\bgpa\b/i, key: 'gpa' }
    ]
  };

  function matchSubfield(label, rules) {
    let best = null;
    let bestLen = -1;
    for (const r of rules) {
      const m = label.match(r.test);
      if (m && m[0].length > bestLen) {
        bestLen = m[0].length;
        best = r.key;
      }
    }
    return best;
  }

  function findClickable(pattern) {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'))
      .filter((el) => el.offsetParent !== null && el.children.length === 0);
    return candidates.find((el) => pattern.test(normalizeText(el.innerText || el.textContent || '')));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Snapshot every currently-visible field element so a click's effect can
  // be measured as a set difference rather than guessed at structurally.
  function snapshotFieldEls() {
    return new Set(collectFields().map((f) => f.el));
  }

  async function clickAndDiff(button) {
    const before = snapshotFieldEls();
    button.scrollIntoView({ block: 'center' });
    button.click();
    // New blocks are sometimes animated in or rendered async; poll briefly
    // instead of a single fixed delay.
    let after = before;
    for (let i = 0; i < 10; i++) {
      await sleep(150);
      after = snapshotFieldEls();
      if (after.size > before.size) break;
    }
    return collectFields().filter((f) => !before.has(f.el) && after.has(f.el));
  }

  // Fills one repeating section (experience or education) and returns the
  // set of <el> nodes it handled, so the generic pass below can skip them.
  async function fillRepeatingSection(sectionName, entries) {
    const handled = new Set(); // excluded from the generic Q&A/AI pass either way
    const filled = new Set(); // actually got a value written in
    if (!entries || entries.length === 0) return { handled, filled };

    const button = findClickable(ADD_BUTTON_PATTERNS[sectionName]);
    if (!button) return { handled, filled }; // page doesn't use this pattern - nothing to do

    const rules = SUBFIELD_RULES[sectionName];
    const blocks = [];

    // Some ATS forms render one entry by default before any click; treat
    // any field already matching a subfield pattern as pre-existing block 0.
    const preexisting = collectFields().filter((f) => matchSubfield(f.label, rules));
    if (preexisting.length) blocks.push(preexisting);

    while (blocks.length < entries.length) {
      const newFields = await clickAndDiff(button);
      if (newFields.length === 0) break; // button stopped adding blocks (e.g. site caps entries)
      blocks.push(newFields);
    }

    blocks.forEach((block, i) => {
      const entry = entries[i];
      if (!entry) return;
      block.forEach((field) => {
        const key = matchSubfield(field.label, rules);
        if (!key) return;
        handled.add(field.el);

        if (key === 'current') {
          if (field.fieldType === 'select') {
            fillField(field, entry.current ? 'Yes' : 'No');
            filled.add(field.el);
          }
          return; // checkboxes for "current" are handled via radioGroups pass below
        }

        const value = entry[key];
        if (value === undefined || value === null || String(value).trim() === '') return;
        fillField(field, String(value));
        filled.add(field.el);
      });
    });

    return { handled, filled };
  }

  async function fillRepeatingCheckboxes(sectionName, entries) {
    const handled = new Set();
    const filled = new Set();
    if (!entries || entries.length === 0) return { handled, filled };
    const rules = SUBFIELD_RULES[sectionName];
    const groups = collectRadioGroups().filter((g) => matchSubfield(g.label, rules) === 'current');
    groups.forEach((g, i) => {
      const entry = entries[i];
      if (!entry) return;
      const wantChecked = !!entry.current;
      const checkbox = g.els.find((el) => el.type === 'checkbox');
      if (checkbox && checkbox.checked !== wantChecked) {
        checkbox.click();
      }
      g.els.forEach((el) => handled.add(el));
      filled.add(checkbox || g.els[0]);
    });
    return { handled, filled };
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

  function getProfile() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getProfile' }, (response) => {
        resolve(response && response.ok ? response.profile : null);
      });
    });
  }

  async function runAutofill() {
    showToast('Scanning form...');

    const profile = await getProfile();
    const handledEls = new Set();
    const filledEls = new Set();

    // Experience/education first: adding blocks changes what collectFields()
    // returns afterward, so the generic pass below needs to run on the DOM
    // as it looks once these sections are fully expanded.
    if (profile) {
      showToast('Expanding experience/education sections...');
      // Sequential on purpose: each call clicks buttons and diffs the DOM
      // against its own before/after snapshot, so two of these running at
      // once would see each other's newly-added fields and misattribute them.
      const results = [
        await fillRepeatingSection('experience', profile.experience),
        await fillRepeatingSection('education', profile.education),
        await fillRepeatingCheckboxes('experience', profile.experience)
      ];
      results.forEach(({ handled, filled }) => {
        handled.forEach((el) => handledEls.add(el));
        filled.forEach((el) => filledEls.add(el));
      });
    }

    const fields = collectFields().filter((f) => !handledEls.has(f.el));
    const radioGroups = collectRadioGroups().filter((g) => !g.els.some((el) => handledEls.has(el)));

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
      let filledCount = filledEls.size; // experience/education fields filled in the pre-pass above

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

      const totalFields = questions.length + handledEls.size;
      showToast(`Filled ${filledCount} of ${totalFields} fields. Review before submitting.`);
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
