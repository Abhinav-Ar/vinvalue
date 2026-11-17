// Isolated-world content script. Same-origin requests include the web session;
// no credentials or page-provided condition payloads enter extension storage.
let pending;
async function syncGarage() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await fetch('/api/extension/garage', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Unavailable session');
      const data = await res.json();
      if (data.version !== 1 || typeof data.accountId !== 'string' || !Array.isArray(data.cars) || data.cars.length > 200 || JSON.stringify(data).length > 300000) throw new Error('Invalid snapshot');
      await chrome.storage.local.remove(['garage', 'conditions', 'accountId']);
      await chrome.storage.local.set({ snapshot: { ...data, syncedAt: Date.now() } });
      return true;
    } catch {
      await chrome.storage.local.remove(['snapshot', 'garage', 'conditions', 'accountId']);
      return false;
    }
  })();
  try { return await pending; } finally { pending = null; }
}
syncGarage();
// Events are hints only; always re-read authenticated server data.
window.addEventListener('autoiq:garage-saved', () => setTimeout(syncGarage, 300));
window.addEventListener('autoiq:appraisal', () => setTimeout(syncGarage, 1500));
window.addEventListener('focus', syncGarage);
setInterval(() => { if (document.visibilityState === 'visible') syncGarage(); }, 30000);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'autoiq:sync') return;
  syncGarage().then(reply);
  return true;
});
