'use client'

import { useEffect } from 'react'
import { RefreshCw, Home, AlertTriangle, Bug } from 'lucide-react'

/**
 * Global Error Boundary.
 *
 * Catches any uncaught runtime error in the React tree (the kind that would
 * otherwise show the black "This page couldn't load" Next.js error screen).
 *
 * Instead of the cryptic black screen, the user sees a friendly recovery UI
 * with:
 *   - The actual error message (so we can debug)
 *   - A "Reload App" button (clears cache + reloads)
 *   - A "Go Home" button (navigates to /)
 *
 * This is a file-based route in Next.js App Router — placing it at app/error.tsx
 * makes it the global error boundary for all pages.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console for debugging
    console.error('[GlobalError]', error)
    // Send to server log (optional)
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
        }),
      }).catch(() => {})
    } catch {}
  }, [error])

  const handleHardReload = async () => {
    try {
      // Clear caches before reload
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {}
    // Hard reload (bypass cache)
    window.location.href = window.location.pathname + '?t=' + Date.now()
  }

  const handleGoHome = () => {
    window.location.href = '/'
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99, 102, 241, 0.06), transparent), #f8fafc',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
        }}>
          <div style={{
            background: '#ffffff',
            backdropFilter: 'blur(20px)',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)',
            color: '#0f172a',
          }}>
            {/* Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 20px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px -10px rgba(245,158,11,.4)',
            }}>
              <AlertTriangle style={{ width: 36, height: 36, color: '#fff' }} />
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
              The app hit an unexpected error. Don't worry — your data in Google Sheets is safe.
              Try reloading. If the problem persists, click "Clear & Reload".
            </p>

            {/* Error details (collapsible) */}
            <details style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '12px',
              margin: '16px 0',
              textAlign: 'left',
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#b91c1c',
              border: '1px solid #e2e8f0',
            }}>
              <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 600 }}>
                <Bug style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />
                Error details
              </summary>
              <div style={{ marginTop: 8, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {error?.message || 'Unknown error'}
                {error?.digest && (
                  <div style={{ marginTop: 8, color: '#64748b' }}>Ref: {error.digest}</div>
                )}
              </div>
            </details>

            {/* Buttons */}
            <button
              onClick={handleHardReload}
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
              }}
            >
              <RefreshCw style={{ width: 18, height: 18 }} />
              Clear Cache & Reload
            </button>

            <button
              onClick={handleGoHome}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                padding: '14px 28px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Home style={{ width: 18, height: 18 }} />
              Go to Home
            </button>

            <p style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>
              Smart Computers Panel · Your Google Sheets data is never affected by app errors
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
