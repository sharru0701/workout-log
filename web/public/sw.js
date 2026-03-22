'use strict';

// ---------------------------------------------------------------------------
// Cache names — bump CACHE_VERSION when deploying breaking asset changes.
// Old caches are auto-deleted in the activate handler.
// ---------------------------------------------------------------------------
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `wl-static-${CACHE_VERSION}`;   // /_next/static/** (immutable)
const ASSETS_CACHE = `wl-assets-${CACHE_VERSION}`;   // icons, fonts, offline page
const ALL_CACHES = [STATIC_CACHE, ASSETS_CACHE];

// Precache these on install so the offline fallback is always available.
const PRECACHE_URLS = [
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ---------------------------------------------------------------------------
// Install — precache essentials, activate immediately.
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(ASSETS_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// Activate — delete stale caches, claim all clients right away.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch routing
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API routes — network-only. Never cache authenticated data.
  if (url.pathname.startsWith('/api/')) return;

  // Next.js immutable static assets (content-hashed filenames) — cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Public icons / images / fonts — stale-while-revalidate.
  if (
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpg|jpeg|svg|ico|webp|woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
    return;
  }

  // HTML navigation — network-first, serve cached page or offline.html on failure.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else — network-first, silent cache fallback.
  event.respondWith(networkFirst(request));
});

// ---------------------------------------------------------------------------
// Strategy helpers
// ---------------------------------------------------------------------------

/** Cache-first: serve from cache; populate cache on network miss. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/** Stale-while-revalidate: return cached immediately; update cache in background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached ?? networkFetch;
}

/** Network-first for HTML: try network; fall back to cached page then offline.html. */
async function networkFirstWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const offline = await caches.match('/offline.html');
    return (
      offline ??
      new Response('오프라인 상태입니다', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

/** Network-first for other requests: try network; fall back to cache silently. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Network error', { status: 503 });
  }
}
