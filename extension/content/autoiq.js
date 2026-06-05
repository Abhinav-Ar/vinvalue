// Syncs the user's AutoIQ garage into extension storage whenever they visit AutoIQ.
// Content scripts run in the page context so the session cookie is included automatically.
async function syncGarage() {
  try {
    const res = await fetch("/api/garage", { credentials: "include" });
    if (!res.ok) return;
    const { cars } = await res.json();
    if (Array.isArray(cars)) {
      chrome.storage.local.set({ garage: cars });
    }
  } catch (_) {
    // Not logged in, network error, or extension context invalidated — silent fail
  }
}

syncGarage();

// Store detailed condition data keyed by VIN so filler can use it
window.addEventListener("autoiq:appraisal", (e) => {
  const d = e.detail;
  if (!d?.vin) return;
  try {
    chrome.storage.local.get("conditions", ({ conditions = {} }) => {
      conditions[d.vin] = {
        bodyDamage:       d.bodyDamage,
        mechanicalIssues: d.mechanicalIssues,
        warningLights:    d.warningLights,
        accidents:        d.accidents,
        titleStatus:      d.titleStatus,
        serviceHistory:   d.serviceHistory,
        owners:           d.owners,
        keysCount:        d.keysCount,
        featuresWorking:  d.featuresWorking,
        condition:        d.condition,
      };
      chrome.storage.local.set({ conditions });
    });
    setTimeout(syncGarage, 1500);
  } catch (_) {
    // Extension was reloaded — refresh this tab to reconnect
  }
});
