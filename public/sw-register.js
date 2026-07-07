/**
 * Service Worker registration helper.
 * Loaded as a separate static script so it doesn't go through Next's bundler
 * (which would break `navigator.serviceWorker` scope handling).
 */
(function () {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  // Register after window load so it doesn't compete with first paint
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
              // New version available - activate immediately
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
