/**
 * Smart Computers Panel - Service Worker (SELF-DESTRUCT VERSION)
 *
 * This file exists ONLY to self-unregister. The previous version cached JS
 * chunks and caused "This page couldn't load" errors after deploys.
 *
 * When a browser has an old SW installed and the SW checks for an update,
 * it fetches this file. The 'install' and 'activate' handlers below
 * unregister this SW and clear all caches, so the browser goes back to
 * normal (no SW) on next navigation.
 */
const VERSION = 'smartcomp-destruct-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Clear all caches
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        // Unregister self
        await self.registration.unregister()
        // Tell all clients to reload
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const c of clients) {
          try { c.navigate(c.url) } catch {}
        }
      } catch (e) {
        // ignore
      }
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        await self.registration.unregister()
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const c of clients) {
          try { c.navigate(c.url) } catch {}
        }
      } catch (e) {}
    })()
  )
})

// No fetch handler — once unregistered, browser uses normal networking
self.addEventListener('fetch', () => {
  // intentionally empty
})
