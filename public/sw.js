/**
 * Smart Computers Panel - Service Worker (v3 — stale-cache safe)
 *
 * STRATEGY:
 *   - Navigation requests: network-first. On network failure → cached page → offline.
 *     We DO cache the HTML, but always try network first so new deploys are picked up.
 *   - Static assets (_next/static/*): stale-while-revalidate. These are immutable
 *     hashed files, so the cache is always safe. We fetch in background to update.
 *   - API: network-first, short stale fallback.
 *   - External: network-only.
 *
 * STALE-CACHE AUTO-RECOVERY:
 *   - On activate, we delete ALL old caches (versioned by VERSION const).
 *   - On fetch failure for a static asset (chunk load error), we delete the cache
 *     entry and let the browser refetch, so users never get stuck on
 *     "This page couldn't load" after a deploy.
 *   - The SW checks for updates every hour and auto-activates new versions.
 */

const VERSION = 'smartcomp-v3.0-20260708'
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

// ===== HELPERS =====
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

// ===== FETCH HANDLER =====
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // External (Google Apps Script, Meta API, etc.) - network only, never cache
  if (isExternal(url)) return

  // Navigation requests: network-first with offline fallback.
  // On success, we cache the HTML so reload works offline, but we ALWAYS try
  // network first — so a new deploy is picked up on next navigation.
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

  // Static assets (_next/static/* — these are immutable hashed files).
  // Strategy: stale-while-revalidate. Serve from cache instantly, but ALWAYS
  // fetch in background to keep cache fresh. This is safe because file names
  // are content-hashed — if the name is the same, the content is the same.
  //
  // CRITICAL: if the network fetch returns a 404 (chunk was deleted in new deploy),
  // we delete the stale cache entry and return the 404 so the browser can handle it.
  // The client-side chunk-error recovery (in sw-register.js) will then force a
  // full reload with cache busting.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        // Kick off background update regardless
        const networkFetch = fetch(request)
          .then((resp) => {
            if (resp && resp.status === 200) {
              const copy = resp.clone()
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {})
            } else if (resp && resp.status === 404) {
              // Chunk no longer exists in new deploy — purge from cache so
              // we don't keep serving a broken reference
              caches.open(RUNTIME_CACHE).then((c) => c.delete(request)).catch(() => {})
            }
            return resp
          })
          .catch(() => null)

        // If we have a cached version, serve it immediately (instant load)
        if (cached) {
          // Update in background, but don't block
          networkFetch.catch(() => {})
          return cached
        }

        // No cache — wait for network
        const netResp = await networkFetch
        if (netResp) return netResp
        return Response.error()
      })()
    )
    return
  }

  // API requests: network-first, fallback to stale cache (stale-while-revalidate)
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone()
            caches.open(API_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return resp
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) {
            // Background refetch
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
