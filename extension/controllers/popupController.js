function fmt(n) {
  return new Intl.NumberFormat("en-US").format(Number(n));
}

function show(id) {
  ["state-empty", "state-login", "state-cars"].forEach((s) => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
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

  const cond = car.answers || {};

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
    { label: "ZIP",          value: car.zip || cond.zip },
  ].filter((f) => f.value != null && f.value !== "");

  // VIN always gets full width
  fields.forEach((f) => {
    const cell = document.createElement("div");
    cell.className = "detail-cell" + (f.label === "VIN" ? " full-width" : "");

    const colorClass = f.mono ? "mono" : classify(f.label, f.value);
    cell.append(
      element("div", "detail-cell-label", f.label),
      element("div", `detail-cell-value ${colorClass}`, String(f.value)),
      element("span", "copy-hint", "Copy"),
    );

    cell.addEventListener("click", () => copyText(String(f.value), cell));
    grid.appendChild(cell);
  });

  panel.style.display = fields.length > 0 ? "block" : "none";
}

let selectedCar = null;

async function loadGarage() {
  const tabs = await chrome.tabs.query({ url: 'https://autoiq-vinvalue.vercel.app/*' });
  if (tabs.length) {
    try { await chrome.tabs.sendMessage(tabs[0].id, { type: 'autoiq:sync' }); }
    catch { await chrome.storage.local.remove('snapshot'); }
  }
  const { snapshot } = await chrome.storage.local.get('snapshot');
  if (!snapshot || snapshot.version !== 1 || Date.now() - snapshot.syncedAt > 300000) {
    await chrome.storage.local.remove(['snapshot', 'garage', 'conditions']);
    show('state-login'); return;
  }
  const garage = snapshot.cars;
  if (!garage) { show("state-login"); return; }
  if (garage.length === 0) { show("state-empty"); return; }

  show("state-cars");
  const list = document.getElementById("car-list");

  garage.forEach((car) => {
    const item = document.createElement("div");
    item.className = "car-item";

    const name = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");
    const meta = element("div", "car-item-meta");
    if (car.mileage) meta.append(element("span", "chip", `${fmt(car.mileage)} mi`));
    if (car.condition) meta.append(element("span", "chip", car.condition));
    if (car.trade_in) meta.append(element("span", "chip", `~$${fmt(car.trade_in)}`));
    item.append(element("div", "car-item-name", name), meta);

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
}
loadGarage().catch(() => show("state-login"));

document.getElementById("btn-fill")?.addEventListener("click", async () => {
  if (!selectedCar) return;

  const status = document.getElementById("status");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    status.className = "status err";
    status.textContent = "Could not reach the current tab.";
    return;
  }

  const profileCond = selectedCar.answers || {};
  const car = {
    vin:          selectedCar.vin,
    year:         selectedCar.year,
    make:         selectedCar.make,
    model:        selectedCar.model,
    trim:         selectedCar.trim || "",
    bodyClass:    selectedCar.body_class || profileCond.bodyClass || "",
    driveType:    selectedCar.drive_type || profileCond.driveType || "",
    transmission: selectedCar.transmission || "",
    fuelType:     selectedCar.fuel_type || profileCond.fuelType || "",
    cylinders:    selectedCar.cylinders || profileCond.cylinders || "",
    mileage:      String(selectedCar.mileage ?? ""),
    condition:    selectedCar.condition || "",
    zip:          selectedCar.zip || profileCond.zip || "",
  };

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

  const supported = /^https:\/\/www\.(carvana|carmax|cargurus|kbb|peddle|autonation)\.com\//;
  if (!supported.test(tab.url || '')) {
    status.className = 'status err'; status.textContent = "This page isn't supported for autofill."; return;
  }
  const carWithCondition = { ...car, ...profileCond, ...extendedFields };

    chrome.tabs.sendMessage(tab.id, { type: 'autoiq:fill', car: carWithCondition }    ).then(() => {
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
