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
    if (pin.length < 4) {
      setError('Enter a valid PIN')
      return
    }
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

  // If PIN is not required, bounce to home
  useEffect(() => {
    if (pinRequired === false) {
      router.replace('/')
    }
  }, [pinRequired, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Decorative glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Smart Computers</h1>
          <p className="text-xs text-slate-400 mt-1">Sales &amp; Service Panel</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Enter PIN</h2>
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
              className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
              disabled={loading}
            />

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Unlock
                </>
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
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
