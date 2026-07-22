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

  // ---- Native value setting that survives React/controlled-component forms ----
  //
  // Workday and similar ATS UIs (see: the "field is required" error that
  // stays visible even after we've visibly typed a value into the box) use
  // React-style controlled inputs. React attaches a hidden _valueTracker to
  // the DOM node to remember "the last value I already know about" - if we
  // only call the native value setter, React still thinks nothing changed,
  // so the input/change events we dispatch get swallowed and its validation
  // state (the red "required" message) never re-runs. Resetting the tracker
  // first, plus doing a real focus/blur cycle (since many of these forms
  // validate on blur rather than on change), fixes that.
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT'
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;

    const tracker = el._valueTracker;
    if (tracker) tracker.setValue('');

    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  }

  function setNativeChecked(el, checked) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked').set;
    const tracker = el._valueTracker;
    if (tracker) tracker.setValue(!checked);
    setter.call(el, checked);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click', { bubbles: true }));
  }

  // Fuzzy-matches free text against a <select>'s option labels. Returns the
  // matching option's value, or null if nothing reasonable was found.
  function matchSelectOption(el, answer) {
    const lower = answer.trim().toLowerCase();
    if (!lower) return null;
    const opts = Array.from(el.options);
    const exact = opts.find((o) => o.textContent.trim().toLowerCase() === lower);
    if (exact) return exact.value;
    const partial = opts.find((o) => o.textContent.trim().toLowerCase().includes(lower))
      || opts.find((o) => lower.includes(o.textContent.trim().toLowerCase()) && o.textContent.trim().length > 2);
    return partial ? partial.value : null;
  }

  // Returns true if a value was actually written.
  function fillField(field, answer) {
    const { el, fieldType } = field;
    if (answer === undefined || answer === null || String(answer).trim() === '') return false;

    if (fieldType === 'text' || fieldType === 'textarea') {
      setNativeValue(el, String(answer));
      return true;
    }
    if (fieldType === 'select') {
      const value = matchSelectOption(el, String(answer));
      if (value === null) return false;
      setNativeValue(el, value);
      return true;
    }
    return false;
  }

  function fillRadioGroup(group, answer) {
    const lower = answer.trim().toLowerCase();
    const target = group.els.find((el) => {
      const optLabel = (getFieldLabel(el) || el.value || '').toLowerCase();
      return optLabel === lower || optLabel.includes(lower) || lower.includes(optLabel);
    });
    if (target) {
      setNativeChecked(target, true);
      return true;
    }
    return false;
  }

  // ---- Date parsing/matching ----
  //
  // Saved experience/education dates are free text typed once in the
  // Profile tab ("Jan 2022", "2020", "2022-06", "06/2022", etc). ATS forms
  // render dates in all kinds of shapes: a single text box, an <input
  // type="month">/type="date">, or - very commonly on Workday - separate
  // Month / Day / Year <select> dropdowns that all sit under the same
  // "Start Date" label. The old code tried to match the *whole* raw string
  // against one dropdown's options and silently gave up the moment that
  // didn't match exactly, which is why start/end dates were going in blank.
  const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

  function parseDateValue(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    let year = null, month = null, day = null, m;

    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
      year = +m[1]; month = +m[2]; day = +m[3];
    } else if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) {
      year = +m[1]; month = +m[2];
    } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
      month = +m[1]; day = +m[2]; year = +m[3]; if (year < 100) year += 2000;
    } else if ((m = s.match(/^(\d{1,2})\/(\d{2,4})$/))) {
      month = +m[1]; year = +m[2]; if (year < 100) year += 2000;
    } else if ((m = s.match(/([a-zA-Z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/))) {
      const idx = MONTH_NAMES.findIndex((n) => n.startsWith(m[1].toLowerCase().slice(0, 3)));
      if (idx >= 0) { month = idx + 1; day = +m[2]; year = +m[3]; }
    } else if ((m = s.match(/([a-zA-Z]+)\.?\s+(\d{4})/))) {
      const idx = MONTH_NAMES.findIndex((n) => n.startsWith(m[1].toLowerCase().slice(0, 3)));
      if (idx >= 0) { month = idx + 1; year = +m[2]; }
    } else if ((m = s.match(/^(\d{4})$/))) {
      year = +m[1];
    }

    if (year === null && month === null && day === null) return null;
    return { year, month, day, monthName: month ? MONTH_NAMES[month - 1] : null };
  }

  // Figures out whether a <select>'s options represent months, days, or
  // years, using both the field's own label ("Month", "Start Year", ...)
  // and the shape of its option list as clues, then writes the matching
  // part of the parsed date into it. Returns true only if it actually wrote
  // something - callers must not mark the field "handled" on a false here,
  // or it'll be silently skipped forever, which was the original bug.
  function fillDateSelect(field, parsed) {
    if (!parsed) return false;
    const { el, label } = field;
    const opts = Array.from(el.options).map((o) => ({ el: o, text: o.textContent.trim().toLowerCase(), value: o.value }));
    const labelLower = (label || '').toLowerCase();

    const monthOptCount = opts.filter((o) => MONTH_NAMES.some((n) => o.text === n || o.text.startsWith(n.slice(0, 3)))).length;
    const numericOpts = opts.filter((o) => /^\d{1,4}$/.test(o.text));
    const yearOptCount = numericOpts.filter((o) => +o.text >= 1900 && +o.text <= 2100).length;
    const dayOptCount = numericOpts.filter((o) => +o.text >= 1 && +o.text <= 31).length;

    const isMonth = /\bmonth\b/i.test(labelLower) || monthOptCount >= opts.length * 0.5;
    const isYear = !isMonth && (/\byear\b/i.test(labelLower) || (yearOptCount >= opts.length * 0.5 && opts.length > 10));
    const isDay = !isMonth && !isYear && (/\bday\b/i.test(labelLower) || (dayOptCount >= opts.length * 0.5 && opts.length <= 32));

    let target = null;
    if (isMonth && parsed.month) {
      target = opts.find((o) => o.text === parsed.monthName
        || o.text === String(parsed.month)
        || o.text === String(parsed.month).padStart(2, '0')
        || o.text.startsWith(parsed.monthName.slice(0, 3)));
    } else if (isYear && parsed.year) {
      target = opts.find((o) => o.text === String(parsed.year));
    } else if (isDay && parsed.day) {
      target = opts.find((o) => o.text === String(parsed.day) || o.text === String(parsed.day).padStart(2, '0'));
    } else {
      // Not clearly split by part (e.g. a single "Jan 2022"-style dropdown) -
      // fall back to matching the whole formatted string against options.
      const combined = [parsed.monthName, parsed.year].filter(Boolean).join(' ');
      target = opts.find((o) => o.text === combined || (combined && o.text.includes(combined)));
    }

    if (!target) return false;
    setNativeValue(el, target.value);
    return true;
  }

  // For plain text/date-type inputs, reformat the saved free-text date to
  // match what the input is expecting (yyyy-mm-dd for type="date", yyyy-mm
  // for type="month"); otherwise leave the original text as-is since it's
  // already a reasonable human-readable string ("Jan 2022").
  function formatDateForTextField(el, parsed, rawValue) {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (parsed && parsed.year && parsed.month) {
      if (type === 'date') {
        return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day || 1).padStart(2, '0')}`;
      }
      if (type === 'month') {
        return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      }
    }
    return rawValue;
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
  //
  // Exception: a saved field that doesn't map onto any of the page's
  // dropdown options as-is (most commonly "Degree" - e.g. saved as
  // "Bachelor's" but the site's <select> only offers "Bachelor's Degree")
  // gets queued and resolved via the same AI pipeline used for everything
  // else, instead of being left blank. See resolveUnmatchedFields below.

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

  const DATE_KEYS = new Set(['startDate', 'endDate']);

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

  // Fills one repeating section (experience or education). Returns:
  // - handled: every <el> this section claims ownership of (excluded from
  //   the generic Q&A/AI pass either way, since a generic pass has no idea
  //   these are tied to array entries)
  // - filled: the subset that actually got a value written directly
  // - unresolved: fields this section recognized but couldn't fill on its
  //   own (bad select match, unparsable date) - queued for the AI fallback
  //   pass instead of being left silently blank
  async function fillRepeatingSection(sectionName, entries) {
    const handled = new Set();
    const filled = new Set();
    const unresolved = [];
    if (!entries || entries.length === 0) return { handled, filled, unresolved };

    const button = findClickable(ADD_BUTTON_PATTERNS[sectionName]);
    if (!button) return { handled, filled, unresolved }; // page doesn't use this pattern

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
            if (fillField(field, entry.current ? 'Yes' : 'No')) filled.add(field.el);
          }
          return; // checkboxes for "current" are handled via radioGroups pass below
        }

        const value = entry[key];
        const hasValue = value !== undefined && value !== null && String(value).trim() !== '';

        if (DATE_KEYS.has(key)) {
          if (!hasValue) return;
          const parsed = parseDateValue(value);
          let ok;
          if (field.fieldType === 'select') {
            ok = fillDateSelect(field, parsed);
          } else {
            setNativeValue(field.el, formatDateForTextField(field.el, parsed, String(value)));
            ok = true;
          }
          if (ok) filled.add(field.el);
          else unresolved.push({ field, rawValue: String(value), context: `${sectionName} ${key} ("${value}") for ${entry.title || entry.degree || entry.school || entry.company || ''}` });
          return;
        }

        if (!hasValue) return;
        const ok = fillField(field, String(value));
        if (ok) filled.add(field.el);
        else unresolved.push({ field, rawValue: String(value), context: `${sectionName} ${key} ("${value}")` });
      });
    });

    return { handled, filled, unresolved };
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
        setNativeChecked(checkbox, wantChecked);
      }
      g.els.forEach((el) => handled.add(el));
      filled.add(checkbox || g.els[0]);
    });
    return { handled, filled };
  }

  // Fields the deterministic pass couldn't resolve (typically: a saved
  // degree string that doesn't line up with the page's dropdown wording)
  // get one more shot through the same backend batch pipeline everything
  // else uses - it already knows how to match/normalize a value against a
  // fixed option list via Gemini, so there's no need for a second code path.
  async function resolveUnmatchedFields(unresolved) {
    if (!unresolved.length) return 0;

    const questions = unresolved.map((u) => ({
      question: `${u.context}. Pick the option that best matches "${u.rawValue}".`,
      fieldType: u.field.fieldType,
      options: u.field.options
    }));

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'autofillRequest', questions }, resolve);
    });

    if (!response || !response.ok) return 0;

    let count = 0;
    unresolved.forEach((u, idx) => {
      const r = response.results[idx];
      if (r && r.answer && fillField(u.field, r.answer)) count++;
    });
    return count;
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
    let pendingUnresolved = [];

    // Experience/education first: adding blocks changes what collectFields()
    // returns afterward, so the generic pass below needs to run on the DOM
    // as it looks once these sections are fully expanded.
    if (profile) {
      showToast('Expanding experience/education sections...');
      // Sequential on purpose: each call clicks buttons and diffs the DOM
      // against its own before/after snapshot, so two of these running at
      // once would see each other's newly-added fields and misattribute them.
      const expResult = await fillRepeatingSection('experience', profile.experience);
      const eduResult = await fillRepeatingSection('education', profile.education);
      const checkResult = await fillRepeatingCheckboxes('experience', profile.experience);

      [expResult, eduResult, checkResult].forEach((r) => {
        r.handled.forEach((el) => handledEls.add(el));
        r.filled.forEach((el) => filledEls.add(el));
      });
      pendingUnresolved = [...(expResult.unresolved || []), ...(eduResult.unresolved || [])];
    }

    if (pendingUnresolved.length) {
      showToast('Matching degree/date fields...');
      const resolvedCount = await resolveUnmatchedFields(pendingUnresolved);
      // Whether or not the AI pass found a match, these els were already
      // counted in handledEls above and should now also count as filled if
      // resolveUnmatchedFields succeeded on them.
      pendingUnresolved.forEach((u) => {
        if (u.field.el.value) filledEls.add(u.field.el);
      });
      void resolvedCount;
    }

    const fields = collectFields().filter((f) => !handledEls.has(f.el));
    const radioGroups = collectRadioGroups().filter((g) => !g.els.some((el) => handledEls.has(el)));

    const questions = [
      ...fields.map((f) => ({ question: f.label, fieldType: f.fieldType, options: f.options })),
      ...radioGroups.map((g) => ({ question: g.label, fieldType: g.fieldType, options: g.options }))
    ];

    if (questions.length === 0) {
      const totalFields = handledEls.size;
      showToast(totalFields ? `Filled ${filledEls.size} of ${totalFields} fields. Review before submitting.` : 'No recognizable fields found on this page.');
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
        if (r && r.answer && fillField(f, r.answer)) filledCount++;
      }
      for (const g of radioGroups) {
        const r = response.results[idx++];
        if (r && r.answer && fillRadioGroup(g, r.answer)) filledCount++;
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
