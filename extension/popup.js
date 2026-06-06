function fmt(n) {
  return new Intl.NumberFormat("en-US").format(Number(n));
}

function show(id) {
  ["state-empty", "state-login", "state-cars"].forEach((s) => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
}

function decodeConditions(encoded) {
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    return {
      bodyDamage:          d.dmg  || null,
      mechanicalIssues:    d.mch  || null,
      warningLights:       d.wl   || null,
      accidents:           d.ac   || null,
      titleStatus:         d.tl   || null,
      serviceHistory:      d.sv   || null,
      owners:              d.ow   || null,
      keysCount:           d.ky   || null,
      featuresWorking:     d.ft   || null,
      exteriorColor:       d.ecol || null,
      interiorColor:       d.icol || null,
      tireCondition:       d.trc  || null,
      glassCondition:      d.glc  || null,
      interiorCleanliness: d.intc || null,
      odors:               d.odo  || null,
      roofType:            d.rftp || null,
    };
  } catch (_) { return {}; }
}

// Classify a value as good / warn / bad for color coding
function classify(field, val) {
  if (!val) return "";
  const v = String(val).toLowerCase();
  const goodPatterns = ["none", "no", "clean", "yes", "all", "working", "full", "2"];
  const badPatterns  = ["severe", "major", "salvage", "rebuilt", "multiple", "no - missing", "frame"];
  if (badPatterns.some((p) => v.includes(p))) return "bad";
  if (goodPatterns.some((p) => v === p || v.startsWith(p))) return "good";
  return "warn";
}

function copyText(text, cell) {
  navigator.clipboard.writeText(text).then(() => {
    cell.classList.add("copied");
    const hint = cell.querySelector(".copy-hint");
    if (hint) hint.textContent = "Copied!";
    setTimeout(() => {
      cell.classList.remove("copied");
      if (hint) hint.textContent = "Copy";
    }, 1400);
  });
}

function renderDetailPanel(car) {
  const panel = document.getElementById("detail-panel");
  const grid  = document.getElementById("detail-grid");
  const title = document.getElementById("detail-panel-title");

  const cond = car.profile_encoded ? decodeConditions(car.profile_encoded) : {};

  title.textContent = [car.year, car.make, car.model].filter(Boolean).join(" ");
  grid.innerHTML = "";

  const fields = [
    { label: "VIN",          value: car.vin,                    mono: true },
    { label: "Mileage",      value: car.mileage ? fmt(car.mileage) + " mi" : null },
    { label: "Condition",    value: car.condition },
    { label: "Trade-in",     value: car.trade_in ? "$" + fmt(car.trade_in) : null },
    { label: "Body damage",  value: cond.bodyDamage },
    { label: "Mechanical",   value: cond.mechanicalIssues },
    { label: "Warning lts",  value: cond.warningLights },
    { label: "Accidents",    value: cond.accidents },
    { label: "Title",        value: cond.titleStatus },
    { label: "Service hist", value: cond.serviceHistory },
    { label: "Owners",       value: cond.owners },
    { label: "Keys",         value: cond.keysCount },
    { label: "Features",     value: cond.featuresWorking },
    { label: "Ext color",    value: cond.exteriorColor },
    { label: "Int color",    value: cond.interiorColor },
    { label: "Tires",        value: cond.tireCondition },
    { label: "Glass",        value: cond.glassCondition },
    { label: "Interior",     value: cond.interiorCleanliness },
    { label: "Odors",        value: cond.odors },
    { label: "Roof",         value: cond.roofType },
    { label: "ZIP",          value: car.zip },
  ].filter((f) => f.value != null && f.value !== "");

  // VIN always gets full width
  fields.forEach((f, i) => {
    const cell = document.createElement("div");
    cell.className = "detail-cell" + (f.label === "VIN" ? " full-width" : "");

    const colorClass = f.mono ? "mono" : classify(f.label, f.value);
    cell.innerHTML = `
      <div class="detail-cell-label">${f.label}</div>
      <div class="detail-cell-value ${colorClass}">${f.value}</div>
      <span class="copy-hint">Copy</span>
    `;

    cell.addEventListener("click", () => copyText(String(f.value), cell));
    grid.appendChild(cell);
  });

  panel.style.display = fields.length > 0 ? "block" : "none";
}

let selectedCar = null;

chrome.storage.local.get("garage", ({ garage }) => {
  if (!garage) { show("state-login"); return; }
  if (garage.length === 0) { show("state-empty"); return; }

  show("state-cars");
  const list = document.getElementById("car-list");

  garage.forEach((car) => {
    const item = document.createElement("div");
    item.className = "car-item";

    const name = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");
    item.innerHTML = `
      <div class="car-item-name">${name}</div>
      <div class="car-item-meta">
        ${car.mileage ? `<span class="chip">${fmt(car.mileage)} mi</span>` : ""}
        ${car.condition ? `<span class="chip">${car.condition}</span>` : ""}
        ${car.trade_in ? `<span class="chip">~$${fmt(car.trade_in)}</span>` : ""}
      </div>
    `;

    item.addEventListener("click", () => {
      document.querySelectorAll(".car-item").forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      selectedCar = car;
      document.getElementById("btn-fill").disabled = false;
      document.getElementById("status").textContent = "";
      renderDetailPanel(car);
    });

    list.appendChild(item);
  });

  // Auto-select if only one car
  if (garage.length === 1) {
    list.querySelector(".car-item")?.click();
  }
});

document.getElementById("btn-fill")?.addEventListener("click", async () => {
  if (!selectedCar) return;

  const status = document.getElementById("status");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    status.className = "status err";
    status.textContent = "Could not reach the current tab.";
    return;
  }

  const car = {
    vin:          selectedCar.vin,
    year:         selectedCar.year,
    make:         selectedCar.make,
    model:        selectedCar.model,
    trim:         selectedCar.trim || "",
    bodyClass:    selectedCar.body_class || "",
    driveType:    selectedCar.drive_type || "",
    transmission: selectedCar.transmission || "",
    fuelType:     selectedCar.fuel_type || "",
    cylinders:    selectedCar.cylinders || "",
    mileage:      String(selectedCar.mileage || ""),
    condition:    selectedCar.condition || "",
    zip:          selectedCar.zip || "",
  };

  const profileCond = selectedCar.profile_encoded
    ? decodeConditions(selectedCar.profile_encoded)
    : {};

  // Map extended fields to the keys filler.js expects
  const extendedFields = {
    tireCondition:       profileCond.tireCondition       || null,
    glassCondition:      profileCond.glassCondition      || null,
    interiorCleanliness: profileCond.interiorCleanliness || null,
    odors:               profileCond.odors               || null,
    roofType:            profileCond.roofType            || null,
    exteriorColor:       profileCond.exteriorColor       || null,
    interiorColor:       profileCond.interiorColor       || null,
  };

  chrome.storage.local.get("conditions", ({ conditions = {} }) => {
    const storedCond = conditions[car.vin] || {};
    const carWithCondition = { ...car, ...storedCond, ...profileCond, ...extendedFields };

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (carData) => {
        window.dispatchEvent(new CustomEvent("autoiq:fill", { detail: carData }));
      },
      args: [carWithCondition],
    }).then(() => {
      status.className = "status ok";
      status.textContent = "Filling… check the page for results.";
      setTimeout(() => {
        status.className = "status";
        status.textContent = "Done. Amber fields need manual input.";
      }, 2500);
    }).catch(() => {
      status.className = "status err";
      status.textContent = "This page isn't supported for autofill.";
    });
  });
});
