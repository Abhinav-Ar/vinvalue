// AutoIQ form filler — runs on Carvana, CarMax, CarGurus, KBB, Peddle, AutoNation

const FIELD_SELECTORS = {
  vin: [
    'input[id*="vin" i]',
    'input[name*="vin" i]',
    'input[placeholder*="vin" i]',
    'input[aria-label*="vin" i]',
    'input[data-testid*="vin" i]',
    'input[placeholder*="17" i]',
  ],
  mileage: [
    'input[id*="mileage" i]',
    'input[name*="mileage" i]',
    'input[placeholder*="mileage" i]',
    'input[aria-label*="mileage" i]',
    'input[id*="odometer" i]',
    'input[name*="miles" i]',
    'input[placeholder*="miles" i]',
  ],
  zip: [
    'input[id*="zip" i]',
    'input[name*="zip" i]',
    'input[placeholder*="zip" i]',
    'input[aria-label*="zip" i]',
    'input[id*="postal" i]',
    'input[name*="postal" i]',
    'input[placeholder*="postal" i]',
  ],
};

// Works for React-controlled inputs — raw value= assignment is ignored by React's synthetic events
function fillInput(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

function findField(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function tryFill(car) {
  let filled = 0;

  const vinEl = findField(FIELD_SELECTORS.vin);
  if (vinEl && car.vin) { fillInput(vinEl, car.vin); filled++; }

  const mileEl = findField(FIELD_SELECTORS.mileage);
  if (mileEl && car.mileage) { fillInput(mileEl, car.mileage); filled++; }

  const zipEl = findField(FIELD_SELECTORS.zip);
  if (zipEl && car.zip) { fillInput(zipEl, car.zip); filled++; }

  return filled;
}

function showToast(message, success = true) {
  const existing = document.getElementById("autoiq-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "autoiq-toast";
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    background: ${success ? "#1a1a2e" : "#2d1a1a"};
    border: 1px solid ${success ? "#4f46e5" : "#7f1d1d"};
    color: #fff; padding: 12px 16px; border-radius: 14px;
    font-family: -apple-system, sans-serif; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    display: flex; align-items: center; gap: 10px;
    max-width: 300px; line-height: 1.4;
    animation: autoiq-slide-in 0.25s ease;
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes autoiq-slide-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

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

function run(car) {
  const filled = tryFill(car);
  if (filled > 0) {
    showToast(`Filled ${filled} field${filled > 1 ? "s" : ""} for ${car.year} ${car.make} ${car.model}`);
  } else {
    // Form not in DOM yet — watch for it
    let attempts = 0;
    const observer = new MutationObserver(() => {
      attempts++;
      const n = tryFill(car);
      if (n > 0) {
        showToast(`Filled ${n} field${n > 1 ? "s" : ""} for ${car.year} ${car.make} ${car.model}`);
        observer.disconnect();
      }
      if (attempts > 50) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Triggered by the popup with the selected car as event detail
window.addEventListener("autoiq:fill", (e) => {
  const car = e.detail;
  if (!car) return showToast("No car selected.", false);
  const n = tryFill(car);
  if (n === 0) showToast("No fillable fields found on this page.", false);
  else showToast(`Filled ${n} field${n > 1 ? "s" : ""} for ${car.year} ${car.make} ${car.model}`);
});
