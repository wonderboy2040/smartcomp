'use client'

/**
 * Root-level error boundary.
 * Catches errors that app/error.tsx can't (e.g. errors thrown by the root layout).
 *
 * Next.js requires this component to render its own <html> and <body> tags
 * because the root layout may be the source of the error.
 */

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message,
          stack: error?.stack?.slice(0, 1000),
          digest: error?.digest,
          url: typeof window !== 'undefined' ? window.location.href : '',
          time: new Date().toISOString(),
          source: 'global-error',
        }),
      }).catch(() => {})
    } catch {}
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 24,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{
              width: 64, height: 64, margin: '0 auto 16px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>
              !
            </div>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>App Error</h1>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
              The app hit an unexpected error. Your Google Sheets data is safe.
              Try reloading. If the problem persists, click "Clear Cache & Reload".
            </p>
            {error?.message && (
              <details style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                padding: 12,
                margin: '16px 0',
                textAlign: 'left',
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#fca5a5',
              }}>
                <summary style={{ cursor: 'pointer', color: '#cbd5e1' }}>Error details</summary>
                <div style={{ marginTop: 8, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {error.message}
                  {error?.digest && <div style={{ marginTop: 8, color: '#64748b' }}>Ref: {error.digest}</div>}
                </div>
              </details>
            )}
            <button
              onClick={async () => {
                try {
                  if ('caches' in window) {
                    const ks = await caches.keys()
                    await Promise.all(ks.map((k) => caches.delete(k)))
                  }
                  if ('serviceWorker' in navigator) {
                    const rs = await navigator.serviceWorker.getRegistrations()
                    await Promise.all(rs.map((r) => r.unregister()))
                  }
                } catch {}
                window.location.href = window.location.pathname + '?t=' + Date.now()
              }}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 0,
                padding: '14px 28px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
                marginBottom: 8,
              }}
            >
              Clear Cache & Reload
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '14px 28px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
