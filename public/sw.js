/* AutoIQ service worker: web push only (no caching). Payload: { title, body, link } (src/lib/notify/types.ts PushPayload). */
self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    p = { title: 'AutoIQ', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(p.title || 'AutoIQ', { body: p.body || '', data: { link: p.link || '/alerts' } }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/alerts';
  event.waitUntil(self.clients.openWindow(link));
});
