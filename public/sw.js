/**
 * Smart Computers Panel - Service Worker
 * Strategy:
 *   - Precache: app shell (offline page, manifest, icons)
 *   - Navigation requests: network-first, fallback to cached page or offline.html
 *   - Static assets (_next/static): cache-first (immutable)
 *   - API requests: network-first, short cache fallback (stale-while-revalidate)
 *   - Google Apps Script / external: network-only
 */

const VERSION = 'smartcomp-v2.0-20260708'
const APP_SHELL_CACHE = `${VERSION}-shell`
const RUNTIME_CACHE = `${VERSION}-runtime`
const API_CACHE = `${VERSION}-api`

const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      // Use addAll but tolerate individual failures (e.g. icons missing)
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname.startsWith('/apple-') ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  )
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isExternal(url) {
  return url.origin !== self.location.origin
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // External (Google Apps Script etc.) - network only, never cache
  if (isExternal(url)) return

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return resp
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const offline = await caches.match('/offline.html')
          return offline || Response.error()
        })
    )
    return
  }

  // Static assets: cache-first (they're immutable hashed files)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return resp
        })
      })
    )
    return
  }

  // API requests: network-first, fallback to stale cache (stale-while-revalidate)
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // Only cache successful GET responses
          if (resp && resp.status === 200) {
            const copy = resp.clone()
            caches.open(API_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return resp
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) {
            // Trigger background refetch (stale-while-revalidate)
            fetch(request).then((resp) => {
              if (resp && resp.status === 200) {
                caches.open(API_CACHE).then((c) => c.put(request, resp.clone())).catch(() => {})
              }
            }).catch(() => {})
            return cached
          }
          return new Response(JSON.stringify({ error: 'offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        })
    )
    return
  }

  // Default: try cache, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return resp
        })
      )
    })
  )
})
