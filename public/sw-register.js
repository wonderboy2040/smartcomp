/**
 * Service Worker registration + chunk-load error auto-recovery.
 *
 * CRITICAL FIX for "This page couldn't load" error after deploys:
 *   When a new deploy ships, the old HTML may reference JS chunks whose names
 *   have changed. The browser tries to load the old chunk name, gets a 404,
 *   and shows "This page couldn't load". This script catches that error,
 *   clears all caches + unregisters the service worker, and force-reloads
 *   the page so the user gets the fresh HTML with correct chunk references.
 */
(function () {
  if (typeof window === 'undefined') return

  // ===== 1. Global chunk-load error handler =====
  window.addEventListener('error', function (event) {
    // Detect chunk load failures (multiple formats across browsers)
    const msg = String(event.message || event.target?.src || '').toLowerCase()
    const isChunkError =
      msg.includes('loading chunk') ||
      msg.includes('loading css chunk') ||
      msg.includes('importing a module script failed') ||
      msg.includes('failed to fetch dynamically imported module') ||
      (event.target && event.target.tagName === 'SCRIPT' && event.target.src)

    if (isChunkError) {
      console.warn('Chunk load failure detected — clearing cache and reloading')
      clearAllCachesAndReload()
    }
  })

  // Catch unhandled promise rejections from dynamic imports (Next.js uses these)
  window.addEventListener('unhandledrejection', function (event) {
    const msg = String(event.reason?.message || event.reason || '').toLowerCase()
    if (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('loading chunk')
    ) {
      console.warn('Dynamic import failure detected — clearing cache and reloading')
      clearAllCachesAndReload()
    }
  })

  async function clearAllCachesAndReload() {
    try {
      // 1. Clear all caches
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      // 2. Unregister service worker
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch (e) {
      // ignore
    }
    // 3. Force reload (bypass cache)
    window.location.reload()
  }

  // ===== 2. Service Worker registration =====
  if (!('serviceWorker' in navigator)) return

  // Only register after window load so it doesn't compete with first paint
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(function (reg) {
        // Check for updates every hour
        setInterval(function () {
          reg.update().catch(function () {})
        }, 60 * 60 * 1000)

        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available - activate immediately so next reload uses it
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch(function (err) {
        console.warn('SW registration failed:', err)
      })

    // Reload when the new SW takes control
    var refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
})()
