'use client'

/**
 * Global error boundary at the root level.
 * This catches errors that app/error.tsx can't (like errors in root layout).
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          margin: 0,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>App Error</h1>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20 }}>
              {error?.message || 'Unexpected error'}
            </p>
            <button
              onClick={() => {
                try {
                  if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k)))
                  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
                } catch {}
                window.location.href = '/'
              }}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 0,
                padding: '14px 28px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
