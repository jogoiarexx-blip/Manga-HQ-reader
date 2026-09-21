const CACHE_PREFIX = 'manga-hq-reader-ghpages-';
const CACHE = `${CACHE_PREFIX}v2.2.1`;
const BASE = new URL('./', self.location.href);
const CORE = [
  './', './index.html', './css/app.css', './js/app.js', './config.js',
  './data/catalog.json', './manifest.webmanifest', './icon-64.png', './apple-touch-icon.png', './icon-192.png', './icon-512.png'
].map(p => new URL(p, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (request.mode === 'navigate' ? cache.match(new URL('./index.html', BASE).href) : Response.error());
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await fresh) || Response.error();
}

const RUNTIME_CDN_ORIGINS = new Set(['https://esm.sh', 'https://cdn.jsdelivr.net']);

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Cache only the trusted reader runtimes loaded on demand. Do not cache
  // Google Drive/API responses or comic files: they may be private/huge.
  if (RUNTIME_CDN_ORIGINS.has(url.origin)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (url.origin !== self.location.origin) return;
  const isNavigation = event.request.mode === 'navigate';
  const isCatalog = url.pathname.endsWith('/data/catalog.json');
  event.respondWith(isNavigation || isCatalog ? networkFirst(event.request) : staleWhileRevalidate(event.request));
});
