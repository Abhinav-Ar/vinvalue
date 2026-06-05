function fmt(n) {
  return new Intl.NumberFormat("en-US").format(Number(n));
}

function show(id) {
  ["state-empty", "state-login", "state-cars"].forEach((s) => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
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
    });

    list.appendChild(item);
  });
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
    vin: selectedCar.vin,
    year: selectedCar.year,
    make: selectedCar.make,
    model: selectedCar.model,
    trim: selectedCar.trim || "",
    bodyClass: selectedCar.body_class || "",
    driveType: selectedCar.drive_type || "",
    transmission: selectedCar.transmission || "",
    fuelType: selectedCar.fuel_type || "",
    cylinders: selectedCar.cylinders || "",
    mileage: String(selectedCar.mileage || ""),
    condition: selectedCar.condition || "",
    zip: selectedCar.zip || "",
  };

  // Decode condition details from profile_encoded (always available, no re-deploy needed)
  function decodeConditions(encoded) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      return {
        bodyDamage:       d.dmg,
        mechanicalIssues: d.mch,
        warningLights:    d.wl,
        accidents:        d.ac,
        titleStatus:      d.tl,
        serviceHistory:   d.sv,
        owners:           d.ow,
        keysCount:        d.ky,
        featuresWorking:  d.ft,
      };
    } catch (_) { return {}; }
  }

  const profileCond = selectedCar.profile_encoded
    ? decodeConditions(selectedCar.profile_encoded)
    : {};

  chrome.storage.local.get("conditions", ({ conditions = {} }) => {
    const storedCond = conditions[car.vin] || {};
    // profile_encoded is the source of truth; stored conditions are a fallback
    const carWithCondition = { ...car, ...storedCond, ...profileCond };

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
