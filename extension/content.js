// Content script: scans the current page for form fields, asks the
// background worker to match them against the user's saved AutoFillAI
// data, then fills them in a way that works with plain HTML forms as well
// as React/Vue/Angular controlled inputs.

(() => {
  if (window.__autofillAiInstalled) return;
  window.__autofillAiInstalled = true;

  const FILLABLE_SELECTOR = [
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=file]):not([type=image])",
    "textarea",
    "select",
    "[contenteditable=true]",
  ].join(",");

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return true;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function prettifyName(name) {
    return name
      .replace(/[_\-.]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\[|\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function textFromLabelledBy(el) {
    const ids = el.getAttribute("aria-labelledby");
    if (!ids) return "";
    return ids
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .filter(Boolean)
      .join(" ");
  }

  function findAssociatedLabel(el) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label?.textContent?.trim()) return label.textContent.trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input, textarea, select").forEach((n) => n.remove());
      const text = clone.textContent?.trim();
      if (text) return text;
    }
    return "";
  }

  function findNearbyText(el) {
    // Walk up a few ancestor levels looking for a preceding label-like node
    // (common pattern in React/Vue form builders that don't use <label>).
    let node = el;
    for (let depth = 0; depth < 4 && node; depth++) {
      const container = node.parentElement;
      if (!container) break;

      const candidates = Array.from(container.children).filter(
        (c) => c !== node && !c.contains(node) && c.tagName !== "INPUT" && c.tagName !== "TEXTAREA" && c.tagName !== "SELECT",
      );
      for (const candidate of candidates) {
        const text = candidate.textContent?.trim();
        if (text && text.length < 200 && text.length > 1) {
          return text;
        }
      }
      node = container;
    }
    return "";
  }

  function getLabelForField(el) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel?.trim()) return ariaLabel.trim();

    const labelledBy = textFromLabelledBy(el);
    if (labelledBy) return labelledBy;

    const associated = findAssociatedLabel(el);
    if (associated) return associated;

    const placeholder = el.getAttribute("placeholder");
    if (placeholder?.trim()) return placeholder.trim();

    const nearby = findNearbyText(el);
    if (nearby) return nearby;

    if (el.name) return prettifyName(el.name);
    if (el.id) return prettifyName(el.id);

    return "";
  }

  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    const valueSetter = descriptor?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(
      element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value",
    )?.set;

    if (valueSetter && prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
  }

  function dispatchAll(element, events) {
    events.forEach((eventName) => {
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
  }

  function fillTextLike(el, value) {
    if (document.activeElement !== el) el.focus();
    setNativeValue(el, value);
    dispatchAll(el, ["input", "change"]);
    el.blur();
  }

  function fillContentEditable(el, value) {
    el.focus();
    document.execCommand?.("selectAll", false, undefined);
    const inserted = document.execCommand?.("insertText", false, value);
    if (!inserted) {
      el.textContent = value;
    }
    dispatchAll(el, ["input", "change"]);
    el.blur();
  }

  function fillSelect(el, value) {
    const options = Array.from(el.options);
    const normalizedValue = value.toLowerCase().trim();

    let best = options.find((o) => o.textContent?.trim().toLowerCase() === normalizedValue);
    if (!best) {
      best = options.find(
        (o) =>
          o.textContent?.toLowerCase().includes(normalizedValue) ||
          normalizedValue.includes(o.textContent?.toLowerCase().trim() || "\u0000"),
      );
    }
    if (!best) {
      // Yes/No style heuristics
      const affirmative = /^(y|yes|true|authorized|citizen|eligible)/i.test(normalizedValue);
      const negative = /^(n|no|false|not|require)/i.test(normalizedValue);
      if (affirmative) best = options.find((o) => /^yes$/i.test(o.textContent?.trim() || ""));
      if (negative) best = options.find((o) => /^no$/i.test(o.textContent?.trim() || ""));
    }
    if (!best) return false;

    el.value = best.value;
    dispatchAll(el, ["input", "change"]);
    return true;
  }

  function fillCheckboxOrRadioGroup(elements, value) {
    const normalizedValue = value.toLowerCase().trim();
    const affirmative = /^(y|yes|true|agree|accept)/i.test(normalizedValue);

    if (elements.length === 1 && elements[0].type === "checkbox") {
      const el = elements[0];
      const shouldCheck = affirmative || normalizedValue === "";
      if (el.checked !== shouldCheck) el.click();
      return true;
    }

    let best = elements.find((el) => {
      const label = getLabelForField(el).toLowerCase();
      return label === normalizedValue || label.includes(normalizedValue) || normalizedValue.includes(label);
    });

    if (!best && (affirmative || /^(n|no|false)/i.test(normalizedValue))) {
      const wantYes = affirmative;
      best = elements.find((el) => {
        const label = getLabelForField(el).toLowerCase();
        return wantYes ? /^yes$/.test(label) : /^no$/.test(label);
      });
    }

    if (!best) return false;
    if (!best.checked) best.click();
    return true;
  }

  function collectFields() {
    const nodes = Array.from(document.querySelectorAll(FILLABLE_SELECTOR)).filter(isVisible);

    const radioGroups = new Map();
    const fields = [];

    for (const node of nodes) {
      if (node instanceof HTMLInputElement && (node.type === "radio" || node.type === "checkbox") && node.name) {
        const key = node.type + ":" + node.name;
        if (!radioGroups.has(key)) radioGroups.set(key, []);
        radioGroups.get(key).push(node);
        continue;
      }
      fields.push({ kind: "single", el: node });
    }

    for (const [, group] of radioGroups) {
      fields.push({ kind: "group", elements: group });
    }

    return fields.map((field, index) => {
      const id = `f${index}`;
      if (field.kind === "group") {
        const container =
          field.elements[0].closest("fieldset") || field.elements[0].closest("[role=radiogroup]") || field.elements[0].parentElement;
        const legend = container?.querySelector("legend")?.textContent?.trim();
        const label = legend || getLabelForField(field.elements[0]) || prettifyName(field.elements[0].name || "");
        const options = field.elements.map((el) => getLabelForField(el)).filter(Boolean);
        return { id, label, type: field.elements[0].type, options, ref: field };
      }
      const el = field.el;
      const tag = el.tagName.toLowerCase();
      const type = tag === "input" ? el.type : tag;
      const label = getLabelForField(el);
      const options = tag === "select" ? Array.from(el.options).map((o) => o.textContent?.trim() || "") : undefined;
      return { id, label, type, options, ref: field };
    });
  }

  function fillField(descriptor, value) {
    if (!value) return false;
    const field = descriptor.ref;

    if (field.kind === "group") {
      return fillCheckboxOrRadioGroup(field.elements, value);
    }

    const el = field.el;
    const tag = el.tagName.toLowerCase();

    try {
      if (tag === "select") return fillSelect(el, value);
      if (el.isContentEditable) {
        fillContentEditable(el, value);
        return true;
      }
      if (tag === "input" && (el.type === "checkbox" || el.type === "radio")) {
        return fillCheckboxOrRadioGroup([el], value);
      }
      fillTextLike(el, value);
      return true;
    } catch (err) {
      console.warn("AutoFillAI: failed to fill field", err);
      return false;
    }
  }

  async function runAutofill() {
    const descriptors = collectFields().filter((d) => d.label);

    if (descriptors.length === 0) {
      return { filled: 0, total: 0, details: [] };
    }

    const payloadFields = descriptors.map((d) => ({ id: d.id, label: d.label, type: d.type, options: d.options }));

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "AUTOFILL_MATCH",
          fields: payloadFields,
          url: window.location.href,
          title: document.title,
        },
        (res) => resolve(res),
      );
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Autofill request failed.");
    }

    const matches = response.matches || [];
    let filled = 0;
    const details = [];

    for (const descriptor of descriptors) {
      const match = matches.find((m) => m.id === descriptor.id);
      const value = match?.value || "";
      const didFill = value ? fillField(descriptor, value) : false;
      if (didFill) filled++;
      details.push({ label: descriptor.label, filled: didFill });
    }

    return { filled, total: descriptors.length, details };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "START_AUTOFILL") {
      runAutofill()
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ error: err instanceof Error ? err.message : "Autofill failed." }));
      return true;
    }
    return false;
  });
})();
