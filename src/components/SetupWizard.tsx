'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  Store, FileSpreadsheet, Code, ExternalLink, Copy, CheckCircle2,
  Loader2, AlertCircle, Sparkles, ArrowRight, ShieldCheck, Cloud
} from 'lucide-react'

export function SetupWizard() {
  const { toast } = useToast()
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [configStatus, setConfigStatus] = useState<{ configured: boolean } | null>(null)

  const checkConfig = async () => {
    try {
      const r = await fetch('/api/config')
      const data = await r.json()
      setConfigStatus(data)
      if (data.configured) {
        window.location.reload()
      }
    } catch {}
  }

  useEffect(() => {
    // Poll every 5 seconds to check if env var has been set
    const interval = setInterval(checkConfig, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleTest = async () => {
    setTesting(true)
    try {
      const r = await fetch('/api/config', { method: 'POST' })
      const res = await r.json()
      if (res.success) {
        toast({ title: 'Connection successful!', description: 'Your Google Sheet is ready.' })
      } else {
        toast({ title: 'Connection failed', description: res.message, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText('apps-script/code.gs')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-3 sm:p-4 safe-top safe-bottom">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/30 mb-4">
            <Store className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-2">Welcome to Smart Computers</h1>
          <p className="text-sm sm:text-base text-slate-400 px-2">Let's set up your shop panel. This is a one-time setup.</p>
        </div>

        {/* Status banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-200">Setup Required</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              APPS_SCRIPT_URL environment variable is not set. Follow the steps below to complete setup.
            </p>
          </div>
        </div>

        {/* Steps */}
        <Card className="bg-white/95 backdrop-blur border-0 shadow-2xl">
          <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">One-Time Setup (3 Steps)</h2>
            </div>

            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-700">1</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm sm:text-base">Create Google Sheet & Add Apps Script</p>
                <p className="text-xs text-slate-600 mt-1">
                  Go to{' '}
                  <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline inline-flex items-center gap-0.5">
                    sheets.new <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  → Extensions → Apps Script → Paste code from{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">apps-script/code.gs</code>
                </p>
                <Button size="sm" variant="outline" onClick={copyCode} className="mt-2 h-7 text-xs">
                  {copied ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Copy file path</>}
                </Button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-700">2</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm sm:text-base">Deploy as Web App</p>
                <p className="text-xs text-slate-600 mt-1">
                  In Apps Script: Deploy → New deployment → Web app<br />
                  Execute as: <strong>Me</strong> · Who has access: <strong>Anyone</strong><br />
                  Copy the Web App URL (ends with <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">/exec</code>)
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-700">3</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm sm:text-base">Set Environment Variable</p>
                <p className="text-xs text-slate-600 mt-1">
                  Set <code className="bg-slate-900 text-emerald-400 px-1.5 py-0.5 rounded text-[10px]">APPS_SCRIPT_URL</code> in your deployment:
                </p>
                <div className="mt-2 bg-slate-900 rounded-lg p-3 font-mono text-[10px] sm:text-xs text-slate-300 overflow-x-auto">
                  <div className="text-slate-500"># Vercel / Render Environment Variables:</div>
                  <div className="mt-1 break-all"><span className="text-emerald-400">APPS_SCRIPT_URL</span>=<span className="text-amber-300">https://script.google.com/macros/s/AKfycb.../exec</span></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  After setting this, the app will automatically detect it and load. No need to refresh manually.
                </p>
              </div>
            </div>

            {/* Test button */}
            <div className="pt-3 border-t border-slate-200">
              <Button onClick={handleTest} disabled={testing} className="w-full bg-slate-900 hover:bg-slate-800 h-11">
                {testing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Testing...</> : <><ShieldCheck className="w-4 h-4 mr-1.5" /> Test Connection</>}
              </Button>
              <p className="text-xs text-slate-500 text-center mt-2">
                <Cloud className="w-3 h-3 inline mr-1" />
                Multi-device ready · Data saved to Google Sheets · Free on Render/Vercel
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-4 sm:mt-6">
          Need help? Check the README.md file in your project for detailed instructions.
        </p>
      </div>
    </div>
  )
}
