// Content script for JobFill AI
// Runs in every frame of every page (including iframes — see
// "all_frames": true in manifest.json) to detect and fill form fields.
//
// Many ATS platforms (Greenhouse embeds, some Workday/Lever setups) render
// the actual application form inside an <iframe>, not the top-level page.
// Because this script is injected per-frame, each frame gets its own copy
// with its own message listener, so the popup can talk to whichever frame
// actually contains the form.
//
// Guarding the whole file behind this flag makes (re-)injection idempotent:
// popup.js always calls chrome.scripting.executeScript(...) to make sure a
// listener exists (rather than only relying on the manifest's declarative
// injection, which misses tabs that were already open before install/reload,
// and misses iframes created after that one-time injection). Re-running the
// file in a frame that already has it must NOT redefine the functions below
// or register a second onMessage listener — that would cause duplicate
// fills and unreliable sendResponse behavior.
if (!window.__jobfillContentScriptLoaded) {
  window.__jobfillContentScriptLoaded = true;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ ok: true });
      return true;
    } else if (request.action === "detectForm") {
      const result = detectFormFields();
      sendResponse(result);
      return true;
    } else if (request.action === "fillForm") {
      // fillFormFields is async (it may need to wait for a combobox's
      // option list to render before it can click the right option), so
      // the response is sent from inside the .then() rather than
      // synchronously — the `return true` below is what keeps the message
      // channel open long enough for that to happen.
      fillFormFields(request.fillData).then((result) => {
        if (Array.isArray(request.reviewSelectors)) {
          highlightReviewFields(request.reviewSelectors);
        }
        sendResponse(result);
      });
      return true; // Keep channel open for async response
    }
    return true;
  });

  // Recursively collect elements matching `selectorQuery`, descending into
  // open shadow roots. Some ATS UIs (custom web components) render form
  // controls inside a shadow DOM, which a plain querySelectorAll never sees.
  // Closed shadow roots are intentionally inaccessible to any content
  // script and can't be reached this way — that's a real, unavoidable
  // limitation, not a bug here.
  function queryAllDeep(selectorQuery, root = document) {
    const results = Array.from(root.querySelectorAll(selectorQuery));
    const allNodes = root.querySelectorAll("*");
    for (const node of allNodes) {
      if (node.shadowRoot) {
        results.push(...queryAllDeep(selectorQuery, node.shadowRoot));
      }
    }
    return results;
  }

  // Same idea as queryAllDeep, but returns the first match (used when
  // filling — selectors are unique so we just need one element).
  function queryDeep(selectorQuery, root = document) {
    let el = root.querySelector(selectorQuery);
    if (el) return el;
    const allNodes = root.querySelectorAll("*");
    for (const node of allNodes) {
      if (node.shadowRoot) {
        el = queryDeep(selectorQuery, node.shadowRoot);
        if (el) return el;
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Radio / checkbox GROUP label detection
  //
  // A radio group is one *question* ("Are you located in the US?") backed
  // by several <input type="radio" name="..."> options ("Yes" / "No").
  // Detecting each option as its own field — using the option's own label
  // ("Yes") as the question text — means the real question text never
  // reaches the keyword/AI matcher, so the whole group silently goes
  // unfilled and unflagged. These helpers find the group's real,
  // overarching label instead.
  // -----------------------------------------------------------------------

  function findCommonAncestor(elements) {
    if (!elements.length) return null;
    let node = elements[0];
    while (node) {
      if (elements.every((el) => node.contains(el))) return node;
      node = node.parentElement;
    }
    return null;
  }

  function getGroupLabel(groupEls, fallbackName) {
    // 1. Standard accessible markup: <fieldset><legend>Question</legend>
    for (const el of groupEls) {
      const legend = el.closest("fieldset")?.querySelector("legend");
      const text = legend?.textContent?.trim();
      if (text) return text;
    }

    // 2. role="radiogroup"/"group" ancestor with aria-label/aria-labelledby
    for (const el of groupEls) {
      let node = el.parentElement;
      let depth = 0;
      while (node && depth < 6) {
        const role = (node.getAttribute && node.getAttribute("role")) || "";
        if (role === "radiogroup" || role === "group") {
          const ariaLabel = node.getAttribute("aria-label");
          if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
          const labelledBy = node.getAttribute("aria-labelledby");
          if (labelledBy) {
            const root = node.getRootNode();
            const text = labelledBy
              .split(/\s+/)
              .map((id) => {
                try {
                  return queryDeep(`#${CSS.escape(id)}`, root)?.textContent?.trim();
                } catch {
                  return "";
                }
              })
              .filter(Boolean)
              .join(" ");
            if (text) return text;
          }
        }
        node = node.parentElement;
        depth++;
      }
    }

    // 3. A heading/label sitting just before the group's shared container,
    // as long as it isn't one of the individual option's own
    // `<label for="optionId">` labels (that would just give us "Yes" again).
    const ownIds = new Set(groupEls.map((el) => el.id).filter(Boolean));
    let node = findCommonAncestor(groupEls);
    let depth = 0;
    while (node && depth < 5) {
      let sib = node.previousElementSibling;
      while (sib) {
        const isOwnOptionLabel =
          sib.tagName === "LABEL" &&
          sib.getAttribute("for") &&
          ownIds.has(sib.getAttribute("for"));
        if (!isOwnOptionLabel && /^(LABEL|LEGEND|H[1-6]|P|SPAN|DIV)$/.test(sib.tagName)) {
          const text = sib.textContent?.trim();
          if (text && text.length > 0 && text.length < 200) return text;
        }
        sib = sib.previousElementSibling;
      }
      node = node.parentElement;
      depth++;
    }

    return fallbackName.replace(/[-_]/g, " ");
  }

  function detectFormFields() {
    const fields = [];

    // Find all input, textarea, and select elements
    const inputs = queryAllDeep(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select, [contenteditable="true"]'
    );

    // Pre-group same-name radios/checkboxes so each group is only emitted
    // once below (see getGroupLabel above for why).
    const groupsByKey = new Map();
    for (const el of inputs) {
      const t = (el.type || "").toLowerCase();
      if ((t === "radio" || t === "checkbox") && el.name) {
        const key = `${t}::${el.name}`;
        if (!groupsByKey.has(key)) groupsByKey.set(key, []);
        groupsByKey.get(key).push(el);
      }
    }
    const emittedGroups = new Set();

    inputs.forEach((input, index) => {
      const el = input;
      const inputType = (el.type || "").toLowerCase();

      // Multi-option radio/checkbox group — emit ONE field for the whole
      // group instead of one per option.
      if ((inputType === "radio" || inputType === "checkbox") && el.name) {
        const key = `${inputType}::${el.name}`;
        const groupEls = groupsByKey.get(key);
        if (groupEls && groupEls.length > 1) {
          if (emittedGroups.has(key)) return;
          emittedGroups.add(key);

          const checkedEl = groupEls.find((r) => r.checked);
          const currentValue = checkedEl
            ? checkedEl.closest("label")?.textContent?.trim() || checkedEl.value || ""
            : "";

          fields.push({
            selector: `[name="${el.name}"]`,
            name: el.name,
            type: inputType,
            label: getGroupLabel(groupEls, el.name) || `Field ${index + 1}`,
            value: currentValue,
            tagName: el.tagName.toLowerCase(),
          });
          return;
        }
      }

      // Generate a unique selector
      let selector = "";
      if (el.id) {
        selector = `#${el.id}`;
      } else if (el.name) {
        selector = `[name="${el.name}"]`;
      } else if (el.className && typeof el.className === "string") {
        const cls = el.className.split(" ")[0];
        selector = `.${cls}`;
      } else {
        selector = `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
      }

      // Get label
      let label = "";
      if (el.id) {
        const labelEl = queryDeep(`label[for="${el.id}"]`, el.getRootNode());
        if (labelEl) {
          label = labelEl.textContent?.trim() || "";
        }
      }
      if (!label && el.getAttribute("aria-label")) {
        label = el.getAttribute("aria-label") || "";
      }
      if (!label && el.getAttribute("placeholder")) {
        label = el.getAttribute("placeholder") || "";
      }
      if (!label && el.name) {
        label = el.name.replace(/[-_]/g, " ");
      }
      if (!label && el.closest("label")) {
        label = el.closest("label")?.textContent?.trim() || "";
      }

      // Get surrounding text
      if (!label) {
        const parent = el.parentElement;
        if (parent) {
          const text = parent.textContent?.trim() || "";
          if (text.length < 150 && text !== el.value) {
            label = text.replace(el.value || "", "").trim();
          }
        }
      }

      fields.push({
        selector,
        name: el.name || el.id || `field_${index}`,
        type: el.type || el.tagName.toLowerCase(),
        label: label || `Field ${index + 1}`,
        value: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "",
        tagName: el.tagName.toLowerCase(),
      });
    });

    return {
      found: fields.length > 0,
      fieldCount: fields.length,
      fields,
    };
  }

  // -----------------------------------------------------------------------
  // Combobox / typeahead helpers
  //
  // Many ATS forms use a custom "type to search" input instead of a plain
  // text box or native <select>: typing filters a popup list of options,
  // and you must click (or otherwise commit) one of those options for the
  // answer to actually register — typing alone leaves the widget showing
  // your text with the option list still open, unresolved. Setting
  // .value and dispatching input/change events (which is enough for a
  // plain React-controlled text input) only gets us the "typing" half;
  // these helpers handle waiting for the option list and clicking the
  // right entry to finish the job.
  // -----------------------------------------------------------------------

  function isComboboxInput(el) {
    if (el.tagName.toLowerCase() !== "input") return false;
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (role === "combobox") return true;
    const autocomplete = (el.getAttribute("aria-autocomplete") || "").toLowerCase();
    if (autocomplete === "list" || autocomplete === "both") return true;
    if (
      el.hasAttribute("aria-expanded") &&
      (el.hasAttribute("aria-owns") || el.hasAttribute("aria-controls"))
    ) {
      return true;
    }
    return false;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Find the currently-open option list for `el`. Tries the accessible
  // aria-controls/aria-owns link first, then falls back to any visible
  // role="option" elements on the page — a lot of custom comboboxes mark
  // their option rows with role="option" even when the input itself is
  // missing the rest of the ARIA wiring.
  function findOpenOptions(el) {
    const controlsId = el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
    if (controlsId) {
      const root = el.getRootNode();
      const listbox = controlsId
        .split(/\s+/)
        .map((id) => {
          try {
            return queryDeep(`#${CSS.escape(id)}`, root);
          } catch {
            return null;
          }
        })
        .find(Boolean);
      if (listbox) {
        const options = queryAllDeep('[role="option"]', listbox).filter(isVisible);
        if (options.length) return options;
        const items = Array.from(listbox.querySelectorAll("li")).filter(isVisible);
        if (items.length) return items;
      }
    }
    return queryAllDeep('[role="option"]').filter(isVisible);
  }

  // Exact match wins, then whichever-is-a-prefix-of-the-other, then plain
  // substring — same escalation the <select> matching above uses.
  function pickBestOption(options, value) {
    const target = String(value).toLowerCase().trim();
    if (!target) return null;
    let exact = null;
    let starts = null;
    let contains = null;
    for (const opt of options) {
      const text = (opt.textContent || "").toLowerCase().trim();
      if (!text) continue;
      if (!exact && text === target) exact = opt;
      else if (!starts && (text.startsWith(target) || target.startsWith(text))) starts = opt;
      else if (!contains && (text.includes(target) || target.includes(text))) contains = opt;
    }
    return exact || starts || contains;
  }

  // Replay a full pointer sequence rather than just "click" — most
  // component libraries commit the selection on pointerdown/mousedown
  // (React's onMouseDown), not on the click event itself.
  function clickOption(optionEl) {
    const sequence = ["pointerover", "mouseover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"];
    for (const type of sequence) {
      const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      optionEl.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function waitFor(conditionFn, { timeout = 1000, interval = 60 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function tick() {
        let result;
        try {
          result = conditionFn();
        } catch {
          result = null;
        }
        if (result) return resolve(result);
        if (Date.now() - start >= timeout) return resolve(null);
        setTimeout(tick, interval);
      })();
    });
  }

  function setNativeValue(el, value) {
    const tagName = el.tagName.toLowerCase();
    const proto = tagName === "textarea" ? window.HTMLTextAreaElement : window.HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
  }

  function typeIntoField(el, value) {
    el.focus();
    setNativeValue(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    const lastChar = String(value).slice(-1) || "a";
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: lastChar }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: lastChar }));
  }

  function finalizeField(el) {
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // Fill a text input / textarea. If it turns out to be a combobox-style
  // widget (confirmed via ARIA, or — since a lot of these widgets skip
  // the accessible markup — just by a visible option list actually
  // showing up right after we type), wait for its option list and click
  // the best match so the selection *commits* instead of being left as
  // typed-but-unselected text with the dropdown hanging open.
  async function fillTextLikeField(el, value) {
    typeIntoField(el, value);

    const type = (el.getAttribute("type") || "text").toLowerCase();
    const confirmedCombobox = isComboboxInput(el);
    const worthCheckingForOptions =
      confirmedCombobox ||
      (el.tagName.toLowerCase() === "input" && (type === "text" || type === "search"));

    if (worthCheckingForOptions) {
      // Give a confirmed combobox a real window to render its list; for a
      // plain text input we only peek briefly so ordinary free-text
      // fields (name, cover letter, etc.) aren't slowed down waiting for
      // a dropdown that was never going to appear.
      const timeout = confirmedCombobox ? 1500 : 300;
      const options = await waitFor(() => {
        const found = findOpenOptions(el);
        return found.length ? found : null;
      }, { timeout, interval: 60 });

      if (options) {
        const best = pickBestOption(options, value);
        if (best) {
          clickOption(best);
          // Let the widget close/settle, then we're done — no need to
          // separately dispatch change/blur, the click already commits.
          await waitFor(
            () => el.getAttribute("aria-expanded") === "false" || !isVisible(best),
            { timeout: 500, interval: 50 }
          );
          return;
        }
      }
    }

    finalizeField(el);
  }

  async function fillFormFields(fillData) {
    let filled = 0;

    for (const [selector, value] of Object.entries(fillData)) {
      if (!value) continue;

      try {
        let el = queryDeep(selector);

        // Fallback: try by name
        if (!el && selector.startsWith("[name=")) {
          const name = selector.match(/\[name="(.+)"\]/)?.[1];
          if (name) {
            el = queryDeep(`[name="${name}"]`);
          }
        }

        if (!el) continue;

        const tagName = el.tagName.toLowerCase();
        const type = el.type?.toLowerCase();

        if (tagName === "select") {
          // Try to match option. Two passes: exact match first, then loose
          // substring match — and always skip options with empty text/value
          // (typically a "Select..." placeholder). Without that guard,
          // valLower.includes("") is always true, so a blank placeholder
          // option would match before the real option ever got checked.
          const options = el.options;
          let matched = false;
          const valLower = String(value).toLowerCase().trim();

          for (let i = 0; i < options.length && !matched; i++) {
            const optText = options[i].textContent?.toLowerCase().trim() || "";
            const optValue = (options[i].value || "").toLowerCase().trim();
            if (!optText && !optValue) continue;
            if (optText === valLower || optValue === valLower) {
              el.selectedIndex = i;
              matched = true;
            }
          }

          if (!matched) {
            for (let i = 0; i < options.length && !matched; i++) {
              const optText = options[i].textContent?.toLowerCase().trim() || "";
              const optValue = (options[i].value || "").toLowerCase().trim();
              if (!optText && !optValue) continue;
              if (
                optText.includes(valLower) ||
                valLower.includes(optText) ||
                optValue.includes(valLower)
              ) {
                el.selectedIndex = i;
                matched = true;
              }
            }
          }

          if (!matched && options.length > 1) {
            el.selectedIndex = 1;
          }

          // Use the native setter + dispatch events, same as text inputs —
          // otherwise React/Angular-controlled selects never see the change
          // and the UI silently reverts to its previous/default value.
          const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            "value"
          )?.set;
          if (nativeSelectValueSetter) {
            nativeSelectValueSetter.call(el, el.value);
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (type === "radio" || type === "checkbox") {
          const radioValue = String(value).toLowerCase().trim();
          // Radio siblings for the same `name` live in whichever root (shadow
          // root or document) actually contains `el` — not necessarily
          // `document`, so scope the lookup with getRootNode() rather than
          // querying the top-level document directly.
          const root = el.getRootNode ? el.getRootNode() : document;
          const radioGroup = Array.from(
            root.querySelectorAll(`input[type="${type}"][name="${el.name}"]`)
          );

          // The option's text can live in a <label> that WRAPS the input
          // (closest("label")) or, just as commonly, a sibling
          // <label for="radioId"> that merely references it — the same
          // two patterns detectFormFields already checks when building
          // labels above. Missing the `for` case here meant a group could
          // be correctly *detected* but still fail to actually click the
          // right option on sites using that markup.
          const getOptionLabel = (r) => {
            let text = "";
            if (r.id) {
              const labelEl = queryDeep(`label[for="${r.id}"]`, root);
              if (labelEl) text = labelEl.textContent || "";
            }
            if (!text) text = r.closest("label")?.textContent || "";
            return text.toLowerCase().trim();
          };

          // Exact match wins; only fall back to a substring match if
          // nothing matched exactly — otherwise a value like "yes" would
          // ALSO substring-match "Yes, I intend to work remotely." and end
          // up checking both options at once.
          let best = null;
          for (const r of radioGroup) {
            const rVal = (r.value || "").toLowerCase().trim();
            if (rVal === radioValue || getOptionLabel(r) === radioValue) {
              best = r;
              break;
            }
          }
          if (!best) {
            for (const r of radioGroup) {
              const rVal = (r.value || "").toLowerCase().trim();
              const rLabel = getOptionLabel(r);
              if (
                rLabel.includes(radioValue) ||
                radioValue.includes(rLabel) ||
                rVal.includes(radioValue) ||
                radioValue.includes(rVal)
              ) {
                best = r;
                break;
              }
            }
          }

          if (best) {
            const nativeCheckedSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "checked"
            )?.set;
            if (nativeCheckedSetter) {
              nativeCheckedSetter.call(best, true);
            } else {
              best.checked = true;
            }
            best.dispatchEvent(new Event("input", { bubbles: true }));
            best.dispatchEvent(new Event("change", { bubbles: true }));
            best.dispatchEvent(new Event("click", { bubbles: true }));
          }
        } else if (
          el.getAttribute("contenteditable") === "true"
        ) {
          el.textContent = String(value);
        } else {
          // Text inputs, textareas, and combobox/typeahead widgets.
          await fillTextLikeField(el, value);
        }

        filled++;

        // Visual feedback
        const originalBg = el.style.backgroundColor;
        el.style.transition = "background-color 0.3s ease";
        el.style.backgroundColor = "rgba(99, 102, 241, 0.15)";
        setTimeout(() => {
          el.style.backgroundColor = originalBg;
        }, 800);
      } catch (err) {
        console.warn(`Failed to fill ${selector}:`, err);
      }
    }

    return { filled };
  }

  // Fields we deliberately left blank (e.g. a legal work-authorization
  // question with no saved answer on file) get a persistent outline instead
  // of the fade-out fill highlight, so the user notices they still need to
  // answer it by hand.
  function highlightReviewFields(selectors = []) {
    for (const selector of selectors) {
      try {
        const el = queryDeep(selector);
        if (!el) continue;
        el.style.outline = "2px dashed #f59e0b";
        el.style.outlineOffset = "2px";
        if (!el.title) {
          el.title = "JobFill AI: please review/answer this one manually";
        }
      } catch (err) {
        console.warn(`Failed to highlight ${selector}:`, err);
      }
    }
  }
}
