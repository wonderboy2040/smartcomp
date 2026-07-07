/**
 * Service Worker SELF-DESTRUCT script.
 *
 * WHY: The previous version of this app installed a service worker that cached
 * JS chunks. After a new deploy, the old SW tried to fetch old chunk names that
 * no longer exist on the server, causing "This page couldn't load" errors.
 *
 * WHAT THIS DOES:
 *   - On every page load, this script runs and unregisters ANY existing
 *     service worker for this origin.
 *   - It also clears ALL cached storage (caches API).
 *   - This guarantees users always get fresh content from the server.
 *
 * PWA INSTALLABILITY: The manifest.json is still present, so the app remains
 * installable on mobile/desktop. The only thing we lose is offline support —
 * which is acceptable because Google Sheets requires internet anyway.
 */
(function () {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  // Run on every page load
  async function nukeServiceWorker() {
    try {
      // 1. Unregister ALL service workers for this origin
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        await reg.unregister()
        console.info('[SW] Unregistered stale service worker:', reg.scope)
      }

      // 2. Clear ALL caches
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        if (keys.length > 0) {
          console.info('[SW] Cleared caches:', keys.length, 'entries')
        }
      }

      // 3. Clear session/local storage flags that may reference old build
      try {
        sessionStorage.removeItem('seeded')
      } catch {}
    } catch (e) {
      // Non-fatal — keep going
    }
  }

  // Run immediately + on load
  nukeServiceWorker()
  window.addEventListener('load', nukeServiceWorker)
})()
