// AutoIQ intelligent form filler
// Scans every form control on the page, reads its label, and matches to car data.

// ── Trigger React/Vue/Angular change detection on any input type ──────────────
function triggerReact(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(el, el.value);
  }
  ["input", "change", "blur"].forEach((evt) =>
    el.dispatchEvent(new Event(evt, { bubbles: true }))
  );
}

function setInputValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  triggerReact(el);
}

function setSelectValue(el, value) {
  const lower = value.toLowerCase();
  for (const opt of el.options) {
    if (opt.text.toLowerCase().includes(lower) || opt.value.toLowerCase().includes(lower)) {
      el.value = opt.value;
      triggerReact(el);
      return true;
    }
  }
  return false;
}

// Handle custom React/ARIA dropdowns (role="combobox", role="listbox" etc.)
async function fillAriaDropdown(trigger, value) {
  const lower = value.toLowerCase();
  trigger.click();
  trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

  // Wait for options to render
  await new Promise((r) => setTimeout(r, 400));

  const optionSelectors = [
    '[role="option"]',
    '[role="listitem"]',
    '[role="menuitem"]',
    "li[data-value]",
    "li",
  ];

  for (const sel of optionSelectors) {
    const options = [...document.querySelectorAll(sel)];
    for (const opt of options) {
      if (opt.textContent.trim().toLowerCase().includes(lower)) {
        opt.click();
        opt.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        return true;
      }
    }
  }

  // Close dropdown if nothing matched
  document.body.click();
  return false;
}

function clickRadio(el) {
  el.checked = true;
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ── Get the human-readable label for any form element ────────────────────────
function getLabelText(el) {
  // 1. <label for="id">
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent.trim().toLowerCase();
  }
  // 2. Wrapping <label>
  const parent = el.closest("label");
  if (parent) return parent.textContent.trim().toLowerCase();
  // 3. aria-label / placeholder / name
  return (
    (el.getAttribute("aria-label") || el.placeholder || el.name || "")
      .toLowerCase()
  );
}

// ── Field → car data mapping ─────────────────────────────────────────────────
const FIELD_MAP = [
  {
    keys: ["vin", "vehicle identification"],
    fill: (el, car) => { setInputValue(el, car.vin); return true; },
    types: ["text", "search"],
  },
  {
    keys: ["mileage", "miles", "odometer", "current miles"],
    fill: (el, car) => { setInputValue(el, car.mileage); return true; },
    types: ["text", "number", "tel"],
  },
  {
    keys: ["zip", "postal", "zip code"],
    fill: (el, car) => { setInputValue(el, car.zip); return true; },
    types: ["text", "number", "tel"],
  },
  {
    keys: ["year"],
    fill: (el, car) => {
      if (el.tagName === "SELECT") return setSelectValue(el, car.year);
      setInputValue(el, car.year); return true;
    },
    types: ["text", "number", "select"],
  },
  {
    keys: ["make", "brand"],
    fill: (el, car) => {
      if (el.tagName === "SELECT") return setSelectValue(el, car.make);
      setInputValue(el, car.make); return true;
    },
    types: ["text", "select"],
  },
  {
    keys: ["model"],
    fill: (el, car) => {
      if (el.tagName === "SELECT") return setSelectValue(el, car.model);
      setInputValue(el, car.model); return true;
    },
    types: ["text", "select"],
  },
];

// ── Main fill logic ───────────────────────────────────────────────────────────
function fillPage(car) {
  let filled = 0;

  // Regular inputs + selects
  const controls = [
    ...document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio])"),
    ...document.querySelectorAll("select"),
    ...document.querySelectorAll("textarea"),
  ];

  for (const el of controls) {
    const label = getLabelText(el);
    if (!label) continue;

    for (const { keys, fill } of FIELD_MAP) {
      if (keys.some((k) => label.includes(k))) {
        try { if (fill(el, car)) filled++; } catch (_) {}
        break;
      }
    }
  }

  // Radio buttons — match trim/style text across all labels on the page
  const radioTargets = [car.trim, car.bodyClass].filter(Boolean);
  for (const target of radioTargets) {
    const targetLower = target.toLowerCase();
    // Check all labels for text matching our trim/body style
    const allLabels = [...document.querySelectorAll("label")];
    for (const lbl of allLabels) {
      const text = lbl.textContent.toLowerCase();
      if (targetLower.split(" ").every((word) => text.includes(word))) {
        const radio = lbl.querySelector("input[type=radio]") ||
          (lbl.htmlFor ? document.getElementById(lbl.htmlFor) : null);
        if (radio) { clickRadio(radio); filled++; break; }
        // Some sites (CarMax) wrap a div that acts as a radio card — click the label itself
        lbl.click();
        filled++;
        break;
      }
    }
    // Also check raw radio inputs by aria-label / value
    const radios = [...document.querySelectorAll("input[type=radio]")];
    for (const radio of radios) {
      const lbl = getLabelText(radio);
      if (targetLower.split(" ").every((word) => lbl.includes(word))) {
        clickRadio(radio); filled++; break;
      }
    }
  }

  // Selects — drive type, transmission, fuel type
  const selectTargets = [
    { keys: ["drive", "drivetrain", "drive type"], value: car.driveType },
    { keys: ["transmission"], value: car.transmission },
    { keys: ["fuel", "fuel type"], value: car.fuelType },
    { keys: ["cylinder", "engine"], value: car.cylinders ? car.cylinders + " cylinder" : null },
  ];

  // Native <select> elements
  for (const sel of document.querySelectorAll("select")) {
    const label = getLabelText(sel);
    for (const { keys, value } of selectTargets) {
      if (value && keys.some((k) => label.includes(k))) {
        if (setSelectValue(sel, value)) filled++;
        break;
      }
    }
  }

  // ARIA / custom React dropdowns (role="combobox", role="button" acting as select)
  const ariaDropdowns = [
    ...document.querySelectorAll('[role="combobox"]'),
    ...document.querySelectorAll('[aria-haspopup="listbox"]'),
    ...document.querySelectorAll('[aria-haspopup="true"]'),
  ];
  for (const trigger of ariaDropdowns) {
    const label = getLabelText(trigger) ||
      trigger.closest("label,div,fieldset")?.querySelector("label,legend,p,span[id]")
        ?.textContent?.toLowerCase() || "";
    for (const { keys, value } of selectTargets) {
      if (value && keys.some((k) => label.includes(k))) {
        fillAriaDropdown(trigger, value).then((ok) => { if (ok) {} });
        filled++;
        break;
      }
    }
  }

  return filled;
}

// ── Highlight unfilled fields ─────────────────────────────────────────────────
function highlightUnfilled() {
  const style = document.createElement("style");
  style.id = "autoiq-highlight-style";
  style.textContent = `
    @keyframes autoiq-pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(251,146,60,0.85), 0 0 8px rgba(251,146,60,0.3); }
      50%       { box-shadow: 0 0 0 4px rgba(251,146,60,0.4), 0 0 16px rgba(251,146,60,0.15); }
    }
    .autoiq-needs-input {
      outline: 2.5px solid rgba(251,146,60,0.95) !important;
      outline-offset: 3px !important;
      animation: autoiq-pulse 1.6s ease-in-out infinite !important;
      border-radius: 6px !important;
      background-color: rgba(251,146,60,0.06) !important;
    }
  `;
  const existing = document.getElementById("autoiq-highlight-style");
  if (existing) existing.remove();
  document.head.appendChild(style);

  // Clear any previous highlights
  document.querySelectorAll(".autoiq-needs-input").forEach((el) => {
    el.classList.remove("autoiq-needs-input");
  });

  // For hidden inputs (custom checkboxes, styled selects), highlight the visible wrapper instead
  function markNeedsInput(el) {
    // Walk up to find a visible ancestor to attach the glow to
    let target = el;
    if (!isVisible(el) || el.offsetWidth < 10) {
      target = el.closest("label,fieldset,div,li") || el;
      // Keep walking up until we find something visible with reasonable size
      let cur = target;
      while (cur && cur !== document.body) {
        if (isVisible(cur) && cur.offsetWidth > 20 && cur.offsetHeight > 10) {
          target = cur;
          break;
        }
        cur = cur.parentElement;
      }
    }
    target.classList.add("autoiq-needs-input");
    return target;
  }

  const unfilled = [];

  // Visible text/number inputs that are empty
  for (const el of document.querySelectorAll(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio])"
  )) {
    if (!el.value.trim() && isVisible(el)) {
      unfilled.push(markNeedsInput(el));
    }
  }

  // Native selects still on default option
  for (const el of document.querySelectorAll("select")) {
    if (el.selectedIndex <= 0 && isVisible(el)) {
      unfilled.push(markNeedsInput(el));
    }
  }

  // ARIA custom dropdowns still showing placeholder text
  const placeholderWords = ["select", "choose", "color", "pick", "enter", "exterior", "interior"];
  for (const el of document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]')) {
    if (!isVisible(el)) continue;
    const text = el.textContent.trim().toLowerCase();
    if (placeholderWords.some((w) => text.includes(w)) || text === "") {
      unfilled.push(markNeedsInput(el));
    }
  }

  // Button-style choices where nothing is selected
  // Group buttons by their direct parent to catch plain-div wrappers (e.g. Carvana modifications)
  const choiceButtons = [...document.querySelectorAll("button, [role='button']")].filter((b) =>
    isVisible(b) &&
    !b.closest("nav, header, footer, form > *, [role='navigation']") &&
    b.textContent.trim().length > 0 &&
    b.textContent.trim().length < 60
  );
  const byParent = new Map();
  for (const btn of choiceButtons) {
    const p = btn.parentElement;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(btn);
  }
  for (const [, buttons] of byParent) {
    if (buttons.length < 2) continue;
    const anyActive = buttons.some((b) =>
      b.getAttribute("aria-pressed") === "true" ||
      b.getAttribute("aria-selected") === "true" ||
      b.classList.toString().match(/active|selected|chosen|highlighted/)
    );
    if (!anyActive) {
      buttons.forEach((b) => unfilled.push(markNeedsInput(b)));
    }
  }

  // Unchecked radio groups
  const radioGroups = {};
  for (const el of document.querySelectorAll("input[type=radio]")) {
    if (!el.name) continue;
    if (!radioGroups[el.name]) radioGroups[el.name] = [];
    radioGroups[el.name].push(el);
  }
  for (const radios of Object.values(radioGroups)) {
    if (radios.every((r) => !r.checked)) {
      radios.forEach((r) => unfilled.push(markNeedsInput(r)));
    }
  }

  // Unchecked checkboxes — every feature checkbox on a sell form needs an answer
  for (const el of document.querySelectorAll("input[type=checkbox]")) {
    if (!el.checked) {
      unfilled.push(markNeedsInput(el));
    }
  }

  // Scroll to first unfilled field
  if (unfilled.length > 0) {
    unfilled[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return unfilled.length;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(message, success = true) {
  const existing = document.getElementById("autoiq-toast");
  if (existing) existing.remove();

  const style = document.createElement("style");
  style.textContent = `
    @keyframes autoiq-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  `;
  document.head.appendChild(style);

  const toast = document.createElement("div");
  toast.id = "autoiq-toast";
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:2147483647;
    background:${success ? "#1a1a2e" : "#2d1a1a"};
    border:1px solid ${success ? "#4f46e5" : "#7f1d1d"};
    color:#fff; padding:12px 16px; border-radius:14px;
    font-family:-apple-system,sans-serif; font-size:13px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    display:flex; align-items:center; gap:10px; max-width:300px; line-height:1.4;
    animation:autoiq-in 0.2s ease;
  `;
  toast.innerHTML = `
    <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;">⚡</div>
    <div>
      <div style="font-weight:600;margin-bottom:2px;">AutoIQ</div>
      <div style="color:#a5b4fc;font-size:12px;">${message}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── MutationObserver retry (for SPAs that load forms async) ──────────────────
function fillWithRetry(car) {
  const n = fillPage(car);
  if (n > 0) {
    finishFill(n, car);
    return;
  }

  // Page may already be rendered with no pending mutations — use a timer fallback
  let resolved = false;

  function resolve(filled) {
    if (resolved) return;
    resolved = true;
    observer.disconnect();
    if (filled > 0) {
      finishFill(filled, car);
    } else {
      const unfilled = highlightUnfilled();
      showToast(
        unfilled > 0
          ? `Nothing to autofill here — ${unfilled} field${unfilled > 1 ? "s" : ""} highlighted for manual input`
          : "No form fields found on this page.",
        unfilled === 0
      );
    }
  }

  let attempts = 0;
  const observer = new MutationObserver(() => {
    attempts++;
    const n2 = fillPage(car);
    if (n2 > 0) resolve(n2);
    if (attempts > 40) resolve(0);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Fallback: if no mutations fire within 1.2s, the page was already loaded
  setTimeout(() => resolve(0), 1200);
}

function finishFill(n, car) {
  // Small delay so React re-renders before we scan for unfilled fields
  setTimeout(() => {
    const unfilled = highlightUnfilled();
    if (unfilled > 0) {
      showToast(
        `Filled ${n} field${n > 1 ? "s" : ""} · ${unfilled} still need${unfilled === 1 ? "s" : ""} your input (highlighted)`
      );
    } else {
      showToast(`All done — filled ${n} field${n > 1 ? "s" : ""} for ${car.year} ${car.make} ${car.model}`);
    }
  }, 600);
}

// ── Triggered by popup "Fill form" button ────────────────────────────────────
window.addEventListener("autoiq:fill", (e) => {
  const car = e?.detail;
  if (!car) return showToast("No car selected.", false);
  fillWithRetry(car);
});
