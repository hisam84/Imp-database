const CACHE_NAME = 'imperial-it-cache-v1';
const PRECACHE_ASSETS = [
  '/database/manifest.json',
  '/database/favicon.ico',
  '/database/pad.png',
  '/database/icon-192.png',
  '/database/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never cache API or non-GET requests
  if (request.method !== 'GET' || url.pathname.includes('/api/')) {
    return;
  }

  // Static assets (images, icons): Cache-first with network fallback
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|css|js|json)$/i) ||
    PRECACHE_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML Pages: Network-first, fallback to cache if offline
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});
