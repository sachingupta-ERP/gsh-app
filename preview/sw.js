// GSH App High-Performance Service Worker
// Enables 0-second instant loading, offline resilience, and mobile PWA standalone experience

const CACHE_NAME = 'gsh-app-cache-v2.0';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Best-effort cache addition
      return Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch((err) => console.log('[SW] Optional prefetch skip:', url, err))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and chrome-extension / non-http
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // API endpoints: Network-first with error fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Network offline - operating in offline local mode', offline: true }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Navigation requests (HTML page): Fast timeout Stale-While-Revalidate
  // If network takes > 1.2 seconds (e.g. cold start / spinning round and round), immediately serve cache!
  if (req.mode === 'navigate') {
    event.respondWith(
      new Promise((resolve) => {
        let hasResolved = false;

        // Try network with a fast 1200ms timeout
        const timer = setTimeout(async () => {
          if (!hasResolved) {
            const cached = await caches.match('/index.html') || await caches.match('/');
            if (cached) {
              hasResolved = true;
              console.log('[SW] Network slow/spinning: Served cached app shell instantly');
              resolve(cached);
            }
          }
        }, 1200);

        fetch(req)
          .then(async (networkRes) => {
            clearTimeout(timer);
            if (!hasResolved) {
              hasResolved = true;
              if (networkRes && networkRes.status === 200) {
                const cache = await caches.open(CACHE_NAME);
                cache.put('/index.html', networkRes.clone());
                cache.put('/', networkRes.clone());
              }
              resolve(networkRes);
            }
          })
          .catch(async () => {
            clearTimeout(timer);
            if (!hasResolved) {
              hasResolved = true;
              const cached = await caches.match('/index.html') || await caches.match('/');
              if (cached) resolve(cached);
              else resolve(new Response('App Offline. Please reload once connected.', { status: 503 }));
            }
          });
      })
    );
    return;
  }

  // Static Assets (Images, Manifest, CDN Scripts): Cache-first with background revalidation
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Fetch in background to update cache for next time
        fetch(req).then((netRes) => {
          if (netRes && netRes.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, netRes));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((networkRes) => {
        if (networkRes && networkRes.ok) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      });
    })
  );
});
