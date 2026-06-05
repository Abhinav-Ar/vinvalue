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
      0%, 100% { box-shadow: 0 0 0 2px rgba(251,146,60,0.8); }
      50%       { box-shadow: 0 0 0 4px rgba(251,146,60,0.3); }
    }
    .autoiq-needs-input {
      outline: 2px solid rgba(251,146,60,0.9) !important;
      outline-offset: 2px !important;
      animation: autoiq-pulse 1.6s ease-in-out infinite !important;
      border-radius: 4px !important;
    }
    .autoiq-needs-label {
      position: relative !important;
    }
    .autoiq-needs-label::after {
      content: "⚡ Needs input";
      position: absolute;
      top: -20px;
      left: 0;
      background: #f97316;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      font-family: -apple-system, sans-serif;
      pointer-events: none;
      z-index: 2147483646;
    }
  `;
  const existing = document.getElementById("autoiq-highlight-style");
  if (existing) existing.remove();
  document.head.appendChild(style);

  // Clear any previous highlights
  document.querySelectorAll(".autoiq-needs-input").forEach((el) => {
    el.classList.remove("autoiq-needs-input");
  });

  const unfilled = [];

  // Visible text/number inputs that are empty
  const inputs = [...document.querySelectorAll(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio])"
  )];
  for (const el of inputs) {
    if (!el.value.trim() && isVisible(el)) {
      el.classList.add("autoiq-needs-input");
      unfilled.push(el);
    }
  }

  // Selects still on default (first) option
  for (const el of document.querySelectorAll("select")) {
    if (el.selectedIndex <= 0 && isVisible(el)) {
      el.classList.add("autoiq-needs-input");
      unfilled.push(el);
    }
  }

  // Unchecked required radio groups — find groups where nothing is selected
  const radioGroups = {};
  for (const el of document.querySelectorAll("input[type=radio]")) {
    if (!el.name) continue;
    if (!radioGroups[el.name]) radioGroups[el.name] = [];
    radioGroups[el.name].push(el);
  }
  for (const radios of Object.values(radioGroups)) {
    if (radios.every((r) => !r.checked) && radios.some(isVisible)) {
      radios.filter(isVisible).forEach((r) => r.classList.add("autoiq-needs-input"));
      unfilled.push(radios[0]);
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
  let attempts = 0;
  const observer = new MutationObserver(() => {
    attempts++;
    const n2 = fillPage(car);
    if (n2 > 0) {
      finishFill(n2, car);
      observer.disconnect();
    }
    if (attempts > 60) {
      observer.disconnect();
      // Even if nothing filled, still highlight empty fields
      const unfilled = highlightUnfilled();
      showToast(
        unfilled > 0
          ? `Couldn't autofill — ${unfilled} field${unfilled > 1 ? "s" : ""} highlighted for you`
          : "No fillable fields found on this page.",
        false
      );
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
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
