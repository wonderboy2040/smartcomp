'use client'

import { useState, useEffect } from 'react'
import { useFetch, apiPost, apiPut } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Store, Settings as SettingsIcon, FileSpreadsheet, RefreshCw,
  CheckCircle2, AlertCircle, Database, Sparkles, Code, Copy,
  ExternalLink, Loader2, ShieldCheck, Zap, Cloud, Send, X
} from 'lucide-react'

export function SettingsPanel() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
            <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Settings</h1>
            <p className="text-xs sm:text-sm text-slate-300 truncate">Configure your shop info and view sync status</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="shop">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="shop" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
            <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline sm:inline">Shop</span><span className="xs:hidden sm:hidden">Shop</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
            <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Sync
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
            <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="mt-4">
          <ShopSettings />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4 space-y-4">
          <WhatsAppSettings />
          <MigrationHelper />
        </TabsContent>
        <TabsContent value="sync" className="mt-4">
          <SyncStatus />
        </TabsContent>
        <TabsContent value="data" className="mt-4">
          <DataSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ShopSettings() {
  const { toast } = useToast()
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const { data: shop, refetch } = useFetch<any>('/api/shop', undefined)

  useEffect(() => {
    if (shop) setForm({ ...shop })
  }, [shop])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiPut('/api/shop', form)
      toast({ title: 'Shop settings saved' })
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-emerald-600" />
          </div>
          Shop Information
        </CardTitle>
        <CardDescription>This info appears on your invoices and quotations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Shop Name *</Label>
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Owner Name</Label>
            <Input value={form.owner || ''} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>GST Number</Label>
            <Input value={form.gstNumber || ''} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} placeholder="29ABCDE1234F1Z5" className="mt-1" />
          </div>
          <div>
            <Label>State</Label>
            <Input value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Invoice Prefix</Label>
            <Input value={form.invoicePrefix || ''} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Quotation Prefix</Label>
            <Input value={form.quotationPrefix || ''} onChange={(e) => setForm({ ...form, quotationPrefix: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>UPI ID (for Invoice QR Code)</Label>
            <Input value={form.upiId || ''} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="yourname@upi" className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Textarea value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>Default Invoice Terms</Label>
            <Textarea value={form.termsInvoice || ''} onChange={(e) => setForm({ ...form, termsInvoice: e.target.value })} rows={2} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>Default Quotation Terms</Label>
            <Textarea value={form.termsQuotation || ''} onChange={(e) => setForm({ ...form, termsQuotation: e.target.value })} rows={2} className="mt-1" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 mt-2 w-full sm:w-auto">
          {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...</> : 'Save Shop Info'}
        </Button>
      </CardContent>
    </Card>
  )
}

function SyncStatus() {
  const { toast } = useToast()
  const { data: status, refetch } = useFetch<any>('/api/sheets/sync', undefined)
  const { data: settingsInfo } = useFetch<any>('/api/settings', undefined)
  const [testing, setTesting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setLastError(null)
    setLastSuccess(null)
    try {
      const r = await fetch('/api/settings', { method: 'POST' })
      const res = await r.json()
      if (res.success) {
        setLastSuccess(res.message || 'Connected to Google Sheets successfully!')
        toast({ title: 'Connection successful!', description: 'Your Google Sheet is connected.' })
      } else {
        setLastError(res.message || 'Connection failed')
        toast({ title: 'Connection failed', description: 'See details below', variant: 'destructive', duration: 10000 })
      }
      refetch()
    } catch (e: any) {
      setLastError(e.message || 'Network error')
      toast({ title: 'Error', description: e.message, variant: 'destructive', duration: 10000 })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Cloud className="w-4 h-4 text-violet-600" />
            </div>
            Google Sheets Sync Status
          </CardTitle>
          <CardDescription>Your data is stored directly in Google Sheets via Apps Script</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Show the configured URL (masked) so user can verify format */}
          {settingsInfo?.urlConfigured && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Code className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-700">Configured APPS_SCRIPT_URL:</span>
              </div>
              <code className="block text-[10px] sm:text-xs bg-white px-2 py-1.5 rounded border border-slate-200 break-all font-mono text-slate-600">
                {settingsInfo.urlPreview || '(not set)'}
              </code>
              <div className="flex items-center gap-2 flex-wrap">
                {settingsInfo.urlEndsWithExec ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> URL ends with /exec ✓
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                    <AlertCircle className="w-3 h-3 mr-1" /> URL does NOT end with /exec ✗
                  </Badge>
                )}
                {settingsInfo.urlPreview && (
                  <a
                    href={settingsInfo.urlPreview.includes('...')
                      ? '#'
                      : settingsInfo.urlPreview + '?action=test&t=' + Date.now()}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 ${settingsInfo.urlPreview.includes('...') ? 'pointer-events-none opacity-50' : ''}`}
                    onClick={(e) => {
                      if (settingsInfo.urlPreview.includes('...')) {
                        e.preventDefault()
                        toast({ title: 'Cannot open masked URL', description: 'The URL is masked for security. Open it manually in your browser.', variant: 'destructive' })
                      }
                    }}
                  >
                    <ExternalLink className="w-3 h-3" /> Open in browser
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {status?.enabled ? 'Connected to Google Sheets' : 'Not Connected'}
                </p>
                <p className="text-xs text-slate-600">
                  {status?.enabled ? 'All data syncs in real-time' : 'APPS_SCRIPT_URL not set'}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Active
            </Badge>
          </div>

          {status?.counts && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 rounded-xl text-center border border-blue-100">
                <p className="text-2xl font-bold text-blue-700">{status.counts.invoices}</p>
                <p className="text-xs text-blue-600 mt-0.5">Invoices</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 p-3 rounded-xl text-center border border-cyan-100">
                <p className="text-2xl font-bold text-cyan-700">{status.counts.quotations}</p>
                <p className="text-xs text-cyan-600 mt-0.5">Quotations</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-3 rounded-xl text-center border border-emerald-100">
                <p className="text-2xl font-bold text-emerald-700">{status.counts.payments}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Payments</p>
              </div>
            </div>
          )}

          <Button variant="outline" onClick={handleTest} disabled={testing} className="w-full">
            {testing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Testing...</> : <><Zap className="w-4 h-4 mr-1.5" /> Test Connection</>}
          </Button>

          {/* Persistent error/success display — stays visible until dismissed */}
          {lastError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-red-800 mb-1">Connection Failed</p>
                <p className="text-xs text-red-700 break-words whitespace-pre-wrap">{lastError}</p>
              </div>
              <button onClick={() => setLastError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {lastSuccess && !lastError && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-800 mb-1">Connected!</p>
                <p className="text-xs text-emerald-700 break-words">{lastSuccess}</p>
              </div>
              <button onClick={() => setLastSuccess(null)} className="text-emerald-400 hover:text-emerald-600 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Data is stored directly in your Google Sheet (no other database)</li>
                  <li>APPS_SCRIPT_URL env var connects your app to the Sheet</li>
                  <li>6 sheets auto-created: Shop, Items, Customers, Suppliers, Invoices, Quotations, Payments, Enquiries</li>
                  <li>Multi-device support: any device accessing this URL sees the same data</li>
                  <li>Works on Render/Vercel free tier (no database needed)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Code className="w-4 h-4 text-white" />
            </div>
            Apps Script Setup Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium text-slate-900">Open Google Sheets</p>
                <p className="text-xs text-slate-600">
                  <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                    sheets.new <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium text-slate-900">Open Apps Script</p>
                <p className="text-xs text-slate-600">Extensions → Apps Script</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium text-slate-900">Paste code from apps-script/code.gs</p>
                <p className="text-xs text-slate-600">Then Deploy → Web app → Anyone access</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium text-slate-900">Set APPS_SCRIPT_URL env var</p>
                <p className="text-xs text-slate-600">In Render/Vercel dashboard, add environment variable</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

function DataSettings() {
  const { toast } = useToast()
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    if (!confirm('Load sample data? This will add demo items, customers, and suppliers. Existing data will not be modified.')) return
    setSeeding(true)
    try {
      await apiPost('/api/seed/init', {})
      toast({ title: 'Sample data loaded', description: 'Demo items, customers, and suppliers added' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <Database className="w-4 h-4 text-orange-600" />
          </div>
          Data Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-1">Quick Setup</p>
              <p className="text-xs text-blue-700 mb-3">
                Load demo data to quickly explore the system. Includes sample items (laptops, RAM, SSDs, etc.), customers, and suppliers with WhatsApp numbers.
              </p>
              <Button onClick={handleSeed} disabled={seeding} size="sm" className="bg-blue-600 hover:bg-blue-700">
                {seeding ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Loading...</> : 'Load Sample Data'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-2">
          <p className="font-medium text-slate-700">Data Storage Info:</p>
          <p>All data is stored in your Google Sheet (configured via APPS_SCRIPT_URL).</p>
          <p>No local database - works on Render/Vercel free tier.</p>
          <p>Multi-device support: all devices share the same Google Sheet data.</p>
          <p>To view raw data: open your Google Sheet directly.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function WhatsAppSettings() {
  const { toast } = useToast()
  const { data: status, refetch } = useFetch<any>('/api/whatsapp/status', undefined)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('Hello from Smart Computers Panel — this is a test message.')
  const [sending, setSending] = useState(false)

  const handleTest = async () => {
    if (!testPhone) {
      toast({ title: 'Enter a phone number', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      const r = await apiPost('/api/whatsapp/test-send', { phone: testPhone, message: testMsg })
      if (r.success) {
        toast({ title: 'Test message sent', description: `Message ID: ${r.messageId || 'OK'}` })
      } else {
        toast({ title: 'Send failed', description: r.error || 'Unknown error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const configured = !!status?.configured

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Cloud className="w-5 h-5 text-green-600" /> WhatsApp Cloud API
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Configure automatic message sending and incoming reply capture. Set the env vars below in your Render dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className={`rounded-lg p-3 ${configured ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-start gap-2">
            {configured ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
            <div className="text-sm flex-1">
              <p className={`font-medium ${configured ? 'text-emerald-900' : 'text-amber-900'}`}>
                {configured ? 'Cloud API: Connected' : 'Cloud API: Not configured'}
              </p>
              {configured ? (
                <div className="text-xs text-emerald-700 mt-1 space-y-0.5">
                  <p>Business number: <code className="bg-white px-1 rounded">{status?.businessNumber}</code></p>
                  <p>Phone Number ID: <code className="bg-white px-1 rounded">{status?.phoneNumberId}</code></p>
                  <p>Template: <code className="bg-white px-1 rounded">{status?.templateName}</code></p>
                  <p>Webhook verify token: {status?.verifyTokenSet ? '✓ set' : '✗ not set'}</p>
                </div>
              ) : (
                <p className="text-xs text-amber-700 mt-1">
                  Set the env vars below in Render dashboard to enable automatic sending + reply capture.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Required env vars */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Required Environment Variables (set in Render dashboard):</p>
          <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono space-y-1 overflow-x-auto">
            <div><span className="text-emerald-400">WA_TOKEN</span>=your_permanent_access_token</div>
            <div><span className="text-emerald-400">WA_PHONE_NUMBER_ID</span>=123456789012345</div>
            <div><span className="text-emerald-400">WA_BUSINESS_NUMBER</span>=919876543210</div>
            <div><span className="text-emerald-400">WA_VERIFY_TOKEN</span>=smartcomp_wh_2026</div>
            <div><span className="text-emerald-400">WA_TEMPLATE_NAME</span>=rate_enquiry  <span className="text-slate-500"># optional, default: rate_enquiry</span></div>
          </div>
        </div>

        {/* Setup steps */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Setup steps (one-time, ~15 min):</p>
          <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
            <li>Go to <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">business.facebook.com</a> → create a Meta Business account (free).</li>
            <li>Add a new app → choose "Business" type → add "WhatsApp" product.</li>
            <li>Get a new SIM with a number you don't use for personal WhatsApp. Add it as a test number in Meta.</li>
            <li>Copy the <strong>Permanent Access Token</strong> and <strong>Phone Number ID</strong> from WhatsApp → API Setup.</li>
            <li>Set these as <code className="bg-slate-100 px-1 rounded">WA_TOKEN</code> and <code className="bg-slate-100 px-1 rounded">WA_PHONE_NUMBER_ID</code> env vars in Render.</li>
            <li>Create a message template named <code className="bg-slate-100 px-1 rounded">rate_enquiry</code> in WhatsApp → Message Templates (body: "Hello {'{1}'}, please provide rates for: {'{2}'}"). Wait for approval (~2 hours).</li>
            <li>In WhatsApp → Configuration, set webhook URL to <code className="bg-slate-100 px-1 rounded">https://your-render-url/api/whatsapp/webhook</code> and verify token = <code className="bg-slate-100 px-1 rounded">WA_VERIFY_TOKEN</code> value. Subscribe to "messages" field.</li>
            <li>Redeploy on Render. Done — messages auto-send and replies auto-capture.</li>
          </ol>
        </div>

        {/* Test message */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <p className="text-sm font-medium text-slate-700">Send Test Message</p>
          <p className="text-xs text-slate-500">Verify your Cloud API setup is working. The recipient must have messaged your business number in the last 24h (otherwise use a template).</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder="e.g. 919876543210"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="sm:col-span-1"
            />
            <Input
              placeholder="Message"
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              className="sm:col-span-2"
            />
          </div>
          <Button onClick={handleTest} disabled={!configured || sending} size="sm" className="bg-green-600 hover:bg-green-700">
            {sending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...</> : <><Send className="w-3.5 h-3.5 mr-1" /> Send Test</>}
          </Button>
          {!configured && (
            <p className="text-xs text-amber-600 mt-1">Configure WA_TOKEN and WA_PHONE_NUMBER_ID first.</p>
          )}
        </div>

        {/* Webhook URL reminder */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <p className="font-medium flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Webhook URL for Meta dashboard:</p>
          <code className="block bg-white px-2 py-1 rounded mt-1 break-all">https://your-render-domain.com/api/whatsapp/webhook</code>
          <p className="mt-1">Verify token: the value you set as <code className="bg-white px-1 rounded">WA_VERIFY_TOKEN</code> env var.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MigrationHelper() {
  const { toast } = useToast()
  const { data: status } = useFetch<any>('/api/whatsapp/status', undefined)
  const [step, setStep] = useState<'idle' | 'code-sent' | 'done'>('idle')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const configured = !!status?.configured

  const handleRequest = async () => {
    setBusy(true)
    try {
      const r = await apiPost('/api/whatsapp/migrate', { action: 'request' })
      if (r.success) {
        setStep('code-sent')
        toast({ title: 'Code sent', description: 'Check your SMS for the 6-digit code' })
      } else {
        toast({ title: 'Failed', description: r.error || r.message, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast({ title: 'Enter 6-digit code', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const r = await apiPost('/api/whatsapp/migrate', { action: 'submit', code })
      if (r.success) {
        setStep('done')
        toast({ title: 'Migration complete!', description: 'Your number is now on Cloud API' })
      } else {
        toast({ title: 'Migration failed', description: r.error || r.message, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return null
  }

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Zap className="w-5 h-5 text-amber-600" /> Migrate WhatsApp Business Number
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Move your existing WhatsApp Business app number to Cloud API. Suppliers will keep receiving messages from the same number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
          <p className="font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Important:</p>
          <p>• After migration, the WhatsApp Business app on this number will STOP working.</p>
          <p>• All sending/receiving will go through Cloud API (via this panel).</p>
          <p>• Suppliers will see messages from the same number — no disruption for them.</p>
          <p>• Make sure you have SMS access to this number (Meta sends a 6-digit code via SMS).</p>
        </div>

        {step === 'idle' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Step 1: Request migration code. Meta will SMS a 6-digit code to your business number.</p>
            <Button onClick={handleRequest} disabled={busy} className="bg-amber-600 hover:bg-amber-700">
              {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...</> : <><Send className="w-3.5 h-3.5 mr-1" /> Request Migration Code</>}
            </Button>
          </div>
        )}

        {step === 'code-sent' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Step 2: Enter the 6-digit code you received via SMS.</p>
            <Input
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-[0.5em] font-mono max-w-xs"
              inputMode="numeric"
            />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSubmit} disabled={busy || code.length !== 6} className="bg-emerald-600 hover:bg-emerald-700">
                {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Migrating...</> : <><ShieldCheck className="w-4 h-4 mr-1" /> Complete Migration</>}
              </Button>
              <Button variant="outline" onClick={handleRequest} disabled={busy}>Resend code</Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Migration successful!</p>
              <p className="text-xs mt-1">Your number is now on Cloud API. You can close WhatsApp Business app on your phone. Use the WhatsApp panel to send enquiries — they'll auto-send from this number.</p>
            </div>
          </div>
        )}

        <details className="text-xs text-slate-500 pt-2 border-t border-slate-200">
          <summary className="cursor-pointer font-medium text-slate-700">Advanced: Deregister / Re-migrate</summary>
          <div className="mt-2 space-y-1">
            <p>If migration got stuck or you need to reset, click below to deregister the number from Cloud API. After this, you'll need to re-run the migration flow.</p>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={async () => {
                if (!confirm('Deregister this number from Cloud API? You will need to re-migrate to use it again.')) return
                setBusy(true)
                try {
                  const r = await apiPost('/api/whatsapp/deregister', {})
                  toast({ title: r.success ? 'Deregistered' : 'Failed', description: r.error || r.message, variant: r.success ? 'default' : 'destructive' })
                  if (r.success) setStep('idle')
                } catch (e: any) {
                  toast({ title: 'Error', description: e.message, variant: 'destructive' })
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy}
            >
              Deregister Number
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
