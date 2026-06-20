/**
 * Service Worker for Boostify Music Artist Pages
 * Enables offline access to artist landing pages
 */

const CACHE_VERSION = 'artist-v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/assets/boostify-logo.svg',
  '/assets/freepik__boostify_music_organe_abstract_icon.png',
  '/favicon.ico',
];

// Max items in dynamic cache
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 100;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Cache-first for images, network-first for API/pages
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip unsupported schemes (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Skip external requests (except images)
  if (url.origin !== self.location.origin) {
    if (isImageRequest(request)) {
      event.respondWith(cacheFirstImage(request));
    }
    return;
  }

  // API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Only cache artist data API calls
    if (url.pathname.includes('/artist/')) {
      event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
    }
    return;
  }

  // Image requests - cache first
  if (isImageRequest(request)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  // Static assets (JS, CSS) - cache first
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML navigation - network first (SPA, serve index.html)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Everything else - network first
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_ARTIST_PAGE') {
    const { slug, artistData } = event.data;
    cacheArtistData(slug, artistData);
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// === Caching Strategies ===

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
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirstImage(request) {
  // Skip non-http schemes (chrome-extension://, etc.)
  if (!request.url.startsWith('http')) {
    return fetch(request);
  }

  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    // Only cache complete (200) responses — skip 206 partial and opaque responses
    if (response.ok && response.status === 200) {
      const cache = await caches.open(IMAGE_CACHE);
      // Trim cache if too large
      const keys = await cache.keys();
      if (keys.length > MAX_IMAGE_CACHE) {
        await cache.delete(keys[0]);
      }
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return a transparent 1x1 pixel as fallback for images
    return new Response(
      new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21,
        0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x01, 0x44, 0x00, 0x3b,
      ]),
      { headers: { 'Content-Type': 'image/gif' } }
    );
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    // Only cache complete (200) responses — skip 206 partial responses
    if (response.ok && response.status === 200) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      if (keys.length > MAX_DYNAMIC_CACHE) {
        await cache.delete(keys[0]);
      }
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No internet connection' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try to serve cached page first
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Fallback: serve cached index.html for SPA routing
    const indexCached = await caches.match('/');
    if (indexCached) return indexCached;
    
    return new Response(getOfflinePage(), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// === Helpers ===

function isImageRequest(request) {
  const url = request.url;
  return (
    url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|avif)(\?.*)?$/i) ||
    url.includes('firebasestorage.googleapis.com') ||
    request.destination === 'image'
  );
}

function isStaticAsset(request) {
  return request.url.match(/\.(js|css|woff|woff2|ttf|eot)(\?.*)?$/i);
}

async function cacheArtistData(slug, artistData) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const response = new Response(JSON.stringify(artistData), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(`/api/artist/by-slug/${slug}`, response);
    
    // Also cache the artist images
    if (artistData.profileImage) {
      try { await cacheFirstImage(new Request(artistData.profileImage)); } catch {}
    }
    if (artistData.coverImage || artistData.bannerImage) {
      const img = artistData.coverImage || artistData.bannerImage;
      try { await cacheFirstImage(new Request(img)); } catch {}
    }
  } catch (err) {
    console.error('Failed to cache artist data:', err);
  }
}

function getOfflinePage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boostify Music - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #000;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      color: #f97316;
    }
    p {
      color: #9ca3af;
      margin-bottom: 1.5rem;
    }
    button {
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 12px;
      font-weight: bold;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>Sin conexión</h1>
    <p>No hay conexión a internet. Verifica tu conexión e intenta nuevamente.</p>
    <button onclick="window.location.reload()">Reintentar</button>
  </div>
</body>
</html>`;
}
