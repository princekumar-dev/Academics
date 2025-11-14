// Service Worker for Push Notifications
const CACHE_NAME = 'msec-connect-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/images/mseclogo.png',
  '/images/android-chrome-192x192.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// Push Notification Event - Enhanced for Windows desktop (Chrome/Edge)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received', event);
  
  let notificationData = {
    title: 'MSEC Academics',
    body: 'You have a new notification',
    icon: '/images/android-chrome-192x192.png',
    badge: '/images/favicon-32x32.png',
    vibrate: [200, 100, 200],
    tag: 'msec-notification',
    requireInteraction: false,
    silent: false,
    renotify: true,
    dir: 'auto',
    lang: 'en-US'
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        data: data.data || {},
        // Preserve custom tag if provided
        tag: data.tag || notificationData.tag
      };
    } catch (e) {
      console.error('Error parsing push data:', e);
      notificationData.body = event.data.text();
    }
  }

  // Enhanced notification options for Windows desktop
  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: notificationData.vibrate || [200, 100, 200],
    tag: notificationData.tag || `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    requireInteraction: notificationData.requireInteraction || false,
    silent: notificationData.silent || false,
    renotify: true, // Always show as new notification (prevents merging)
    timestamp: Date.now(),
    data: notificationData.data || {},
    dir: notificationData.dir || 'auto',
    lang: notificationData.lang || 'en-US',
    // Windows-specific: ensure notification is visible
    image: notificationData.image,
    actions: notificationData.actions || [
      {
        action: 'view',
        title: 'View',
        icon: '/images/favicon-32x32.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/images/favicon-32x32.png'
      }
    ]
  };

  // Show the notification
  event.waitUntil((async () => {
    // Notify all window clients immediately (do this before/while showing notification)
    let notifyPromise = (async () => {
      try {
        const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          try {
            client.postMessage({ type: 'bookings:updated', detail: notificationData.data || {}, timestamp: Date.now() })
          } catch (err) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }
    })();

    // Show notification in parallel
    const showPromise = (async () => {
      try {
        await self.registration.showNotification(notificationData.title || 'MSEC Academics', notificationOptions)
      } catch (e) {
        console.error('Error showing notification in SW:', e)
      }
    })();

    // Wait for both to at least be scheduled
    try {
      await Promise.all([notifyPromise, showPromise])
    } catch (e) {
      // ignore
    }
  })());
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();

  // Handle action buttons
  if (event.action === 'close') {
    return;
  }

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          const url = event.notification.data?.url || '/';
          return clients.openWindow(url);
        }
      })
  );
});

// Background Sync (for offline actions)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event);
  if (event.tag === 'sync-bookings') {
    event.waitUntil(syncBookings());
  }
});

async function syncBookings() {
  // Implement booking sync logic here
  console.log('Syncing bookings...');
}
