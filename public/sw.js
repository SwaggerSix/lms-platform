const CACHE_NAME = 'lms-v1';
const OFFLINE_URL = '/offline';

// Assets to precache
const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
];

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback for pages, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API routes
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Cache-first for static assets
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match(request))
      )
    );
    return;
  }

  // Network-first for pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
  );
});

// Handle offline content downloads
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_COURSE') {
    const urls = event.data.urls;
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        urls.map((url) =>
          fetch(url).then((response) => {
            if (response.ok) {
              return cache.put(url, response);
            }
          })
        )
      );
    }).then((results) => {
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      // Notify clients about completion
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'CACHE_COURSE_COMPLETE',
            courseId: event.data.courseId,
            cached: succeeded,
            total: urls.length,
          });
        });
      });
    });
  }

  if (event.data.type === 'CLEAR_COURSE_CACHE') {
    const urls = event.data.urls;
    caches.open(CACHE_NAME).then((cache) => {
      urls.forEach((url) => cache.delete(url));
    }).then(() => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'CLEAR_COURSE_CACHE_COMPLETE',
            courseId: event.data.courseId,
          });
        });
      });
    });
  }

  // Skip waiting when requested
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification handling
self.addEventListener('push', function(event) {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'LearnHub', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { url: data.url || '/' },
      actions: data.actions || [],
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
