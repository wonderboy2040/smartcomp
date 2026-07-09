'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Store, Loader2, Lock, ShieldCheck } from 'lucide-react'

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pinRequired, setPinRequired] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((d) => setPinRequired(!!d.pinRequired))
      .catch(() => setPinRequired(true))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 4) { setError('Enter a valid PIN'); return }
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error || 'Login failed')
        setPin('')
        inputRef.current?.focus()
        return
      }
      const next = params.get('next') || '/'
      router.replace(next)
      router.refresh()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pinRequired === false) router.replace('/')
  }, [pinRequired, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #e0e3ed 0%, #eef0f6 50%, #e8eaf2 100%)' }}>
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
              boxShadow: '6px 6px 16px rgba(99,102,241,0.4), -4px -4px 12px rgba(255,255,255,0.7)',
            }}
          >
            <Store className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Smart Computers</h1>
          <p className="text-xs text-slate-500 mt-1">Sales &amp; Service Panel</p>
        </div>

        {/* Clay Card */}
        <div
          className="rounded-3xl p-6 sm:p-8"
          style={{
            background: 'var(--clay-surface)',
            boxShadow: '10px 10px 24px rgba(163,177,198,0.5), -10px -10px 24px rgba(255,255,255,0.8)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--clay-surface)', boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.4), inset -2px -2px 5px rgba(255,255,255,0.7)' }}
            >
              <Lock className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Enter PIN</h2>
              <p className="text-[11px] text-slate-500">Access protected</p>
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
              }}
              placeholder="• • • •"
              className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-4 rounded-2xl focus:outline-none transition-all text-slate-900 placeholder:text-slate-300"
              style={{
                background: 'var(--clay-surface)',
                boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.4), inset -4px -4px 8px rgba(255,255,255,0.7)',
                border: 'none',
              }}
              disabled={loading}
            />

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 text-center" style={{ boxShadow: 'inset 2px 2px 4px rgba(239,68,68,0.15)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full h-12 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 text-white disabled:opacity-40"
              style={{
                background: loading || pin.length < 4 ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                boxShadow: loading || pin.length < 4 ? 'none' : '4px 4px 12px rgba(99,102,241,0.4), -4px -4px 10px rgba(255,255,255,0.5)',
                border: 'none',
              }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Unlock</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6">
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
