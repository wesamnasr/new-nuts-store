const SHELL_CACHE = 'mizan-pos-shell-v2';
const STATIC_CACHE = 'mizan-pos-static-v2';
const API_READ_CACHE = 'mizan-pos-api-v2';

const PRECACHE_URLS = ['/pos', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== SHELL_CACHE && k !== STATIC_CACHE && k !== API_READ_CACHE
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (
    url.protocol.startsWith('chrome-extension') ||
    url.pathname.includes('webpack-hmr') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  // 1. Next.js Static JS/CSS/Font Chunks -> Stale-While-Revalidate so /pos reloads offline
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkPromise = fetch(event.request)
            .then((res) => {
              if (res && res.status === 200) {
                cache.put(event.request, res.clone()).catch(() => {});
              }
              return res;
            })
            .catch(() => cached);
          return cached || networkPromise;
        })
      )
    );
    return;
  }

  // 2. Read-only Store & POS bootstrap GET APIs -> Network-First with Offline Cache Fallback
  if (url.pathname === '/api/store' || url.pathname === '/api/pos') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(API_READ_CACHE).then((c) => c.put(event.request, copy).catch(() => {}));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Never intercept other dynamic /api/* routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return;
  }

  // 3. HTML Navigation & Images -> Network-First with Shell Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(SHELL_CACHE).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return response;
      })
      .catch(async () => {
        const directMatch = await caches.match(event.request);
        if (directMatch) return directMatch;
        if (url.pathname.startsWith('/pos')) {
          const posShell = await caches.match('/pos');
          if (posShell) return posShell;
        }
        return Response.error();
      })
  );
});
