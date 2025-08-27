// Offline‑First Service Worker (verbessert)
const VERSION = '2025-08-27-v2';
const CACHE = 'werksplan-cache-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/ui.js',
  './src/state.js',
  './src/pipeline.js',
  './src/kmeans.js',
  './src/color.js',
  './src/morph.js',
  './src/edges.js',
  './src/grid.js',
  './src/tools.js',
  './src/undo.js',
  './src/export.js',
  './src/quality.js',
  './src/worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('werksplan-cache-') && k !== CACHE).map(k => caches.delete(k)));
    clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // App‑Shell für Navigation
  if (req.mode === 'navigate') {
    e.respondWith((async()=>{
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./index.html');
      try {
        const fresh = await fetch(req);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (err) {
        return cached || Response.error();
      }
    })());
    return;
  }
  // Cache‑First für statische Assets
  e.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && (new URL(req.url).origin === location.origin)) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
