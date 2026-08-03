/**
 * Service Worker Registration script (SmartComp v10).
 *
 * WHAT THIS DOES:
 *   - Registers /sw.js (the stale-while-revalidate SW that provides PWA
 *     offline support for static assets and precached app shell).
 *   - On every page load, unregisters any UNKNOWN service worker for this
 *     origin (so that leftover SWs from previous versions are cleaned up).
 *   - Clears caches whose name does NOT match the current SW version —
 *     this protects the SW cache across versions, but evicts stale caches
 *     when the SW_VERSION in /sw.js is bumped.
 */
(function () {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  // The SW_VERSION must match the constant declared inside /sw.js.
  // When you bump it there, also bump it here so old caches get evicted.
  const CURRENT_SW_VERSION = 'smartcomp-v10-0-0-ultra'

  async function registerAndCleanup() {
    try {
      // 1. Unregister any UNKNOWN service worker for this origin.
      //    We keep /sw.js (the active one) — anything else is stale.
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        regs.map(async (reg) => {
          const swUrl = reg.active?.scriptURL || ''
          if (!swUrl.endsWith('/sw.js')) {
            await reg.unregister()
            console.info('[SW] Unregistered unknown service worker:', reg.scope)
          }
        })
      )

      // 2. Clear caches that don't match the current SW version.
      //    This evicts caches from prior versions but preserves the
      //    current precache so the SW can serve offline immediately.
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(
          keys.map(async (k) => {
            if (!k.startsWith(CURRENT_SW_VERSION)) {
              await caches.delete(k)
            }
          })
        )
      }

      // 3. Register the current SW (no-op if already registered with same URL+scope).
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })

      // 4. Clear stale session flags
      try {
        sessionStorage.removeItem('seeded')
      } catch {}
    } catch (e) {
      // Non-fatal — keep going
      console.warn('[SW] registration failed:', e)
    }
  }

  // Run immediately + on load (defensive against partial DOM)
  registerAndCleanup()
  window.addEventListener('load', registerAndCleanup)
})()
