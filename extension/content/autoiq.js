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
    // Not logged in or network error — silent fail
  }
}

syncGarage();

// Re-sync after a new appraisal is saved to the garage
window.addEventListener("autoiq:appraisal", () => {
  setTimeout(syncGarage, 1500);
});
