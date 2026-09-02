// Service worker minimal: app-shell cache + offline fallback.
// Fase pilot sengaja sederhana; sinkronisasi offline order = roadmap lanjutan.
const CACHE = 'gfresh-v1';
const SHELL = ['/', '/app', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Jangan cache API — selalu jaringan.
  if (url.pathname.startsWith('/api/')) return;

  // Network-first untuk navigasi, fallback ke cache saat offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/app')))
    );
    return;
  }
  // Cache-first untuk aset statis.
  e.respondWith(caches.match(request).then((r) => r || fetch(request)));
});
