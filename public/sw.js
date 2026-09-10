/**
 * TrueSpend Service Worker
 *
 * Responsibilities:
 * 1. Handle notification click events (focus or open the app)
 * 2. Keep the SW alive so showNotification() works from the main thread
 * 3. Handle periodic sync for background notification delivery
 */

// Install: activate immediately so updates take effect right away
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

// Activate: claim all open clients immediately
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// Push notification support (standby for future server-push)
self.addEventListener('push', function (event) {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'TrueSpend', {
        body: payload.body || '',
        icon: '/app-icon.png',
        badge: '/app-icon.png',
        tag: payload.tag || 'truespend-notification',
        data: {
          url: payload.url || '/dashboard'
        }
      })
    );
  } catch (e) {
    // Not JSON, show raw text
    event.waitUntil(
      self.registration.showNotification('TrueSpend', {
        body: event.data.text(),
        icon: '/app-icon.png',
        badge: '/app-icon.png',
        tag: 'truespend-notification',
      })
    );
  }
});

// When user clicks a notification, focus or open the app
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          // You could also navigate the focused client: client.navigate(targetUrl)
          return client.focus();
        }
      }
      // Otherwise open a new one
      return self.clients.openWindow(targetUrl);
    })
  );
});
