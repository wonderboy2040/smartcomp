'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Store, Loader2, Lock, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pinRequired, setPinRequired] = useState<boolean | null>(null)
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    // Check if PIN is required with no-cache to avoid stale response
    fetch('/api/auth/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPinRequired(!!d.pinRequired))
      .catch(() => setPinRequired(true))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 4) { setError('Enter a valid PIN (4-8 digits)'); return }
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
        credentials: 'include', // Important: include cookies
        cache: 'no-store',
      })
      const d = await r.json().catch(() => ({}))
      
      if (!r.ok) {
        setError(d.error || `Login failed (HTTP ${r.status})`)
        setPin('')
        setTimeout(() => inputRef.current?.focus(), 100)
        return
      }
      
      // Success - show message then hard redirect
      setSuccess(true)
      setError('')
      
      // Get next url - sanitize it
      let nextUrl = params.get('next') || '/'
      // Prevent open redirect - only allow internal paths
      if (!nextUrl.startsWith('/')) nextUrl = '/'
      if (nextUrl.startsWith('//')) nextUrl = '/'
      
      // Hard redirect with window.location to ensure cookie is sent
      // Small delay to show success state
      setTimeout(() => {
        // Use window.location for full page reload - ensures cookie is included
        window.location.href = nextUrl
      }, 500)
      
    } catch (err: any) {
      setError(err?.message || 'Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pinRequired === false) {
      window.location.href = '/'
    }
  }, [pinRequired])

  if (pinRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--clay-bg, #eef0f6)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'var(--clay-bg, #eef0f6)' }}>
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #34d399, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              boxShadow: '6px 6px 16px rgba(0,0,0,0.15), -4px -4px 12px rgba(255,255,255,0.8)',
            }}
          >
            <Store className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Smart Computers</h1>
          <p className="text-xs mt-1 text-slate-500">Sales & Service Panel v3.0.1 Fixed</p>
        </div>

        {/* Clay Card */}
        <div
          className="rounded-3xl p-6 sm:p-8 bg-white"
          style={{
            boxShadow: '10px 10px 24px rgba(0,0,0,0.08), -10px -10px 24px rgba(255,255,255,0.9)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50"
              style={{ boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.08), inset -2px -2px 5px rgba(255,255,255,0.8)' }}
            >
              <Lock className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Enter PIN</h2>
              <p className="text-[11px] text-slate-500">Access protected • PIN: 2023</p>
            </div>
            <div className="ml-auto">
              <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">v3.0.1 Fixed</span>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              pattern="\d{4,8}"
              autoFocus
              autoComplete="off"
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                setPin(v)
                if (error) setError('')
                if (success) setSuccess(false)
              }}
              placeholder="• • • •"
              className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all placeholder:text-slate-300 border border-slate-200 bg-slate-50"
              disabled={loading || success}
            />

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {success && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>PIN correct! Redirecting...</span>
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length < 4 || success}
              className="w-full h-12 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: loading || pin.length < 4 || success ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                boxShadow: loading || pin.length < 4 ? 'none' : '4px 4px 12px rgba(0,0,0,0.1)',
                border: 'none',
              }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              ) : success ? (
                <><CheckCircle2 className="w-4 h-4" /> Unlocked!</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Unlock with PIN 2023</>
              )}
            </button>

            <div className="text-center">
              <p className="text-[11px] text-slate-500">
                Forgot PIN? Check Render dashboard → Environment → <code className="bg-slate-100 px-1 rounded">APP_PIN</code>
              </p>
              <button
                type="button"
                onClick={() => {
                  // Clear cookies and retry
                  document.cookie = 'smartcomp_auth=; path=/; max-age=0'
                  window.location.reload()
                }}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 mt-2 underline"
              >
                Clear cache & reload
              </button>
            </div>
          </form>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-[11px] font-medium text-amber-800">🔧 v3.0.1 Fix Applied:</p>
          <ul className="text-[10px] text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
            <li>Fixed SALT mismatch: login & proxy now use same token</li>
            <li>Added backward compatibility for old tokens</li>
            <li>Hard redirect ensures cookie is sent</li>
            <li>Clear cache button for troubleshooting</li>
          </ul>
        </div>

        <p className="text-center text-[11px] mt-4 text-slate-500">
          Protected access · Data stays safe in your Google Sheet
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#eef0f6' }}>
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
