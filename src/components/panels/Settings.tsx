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
  ExternalLink, Loader2, ShieldCheck, Zap, Cloud
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
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="shop" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
            <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline sm:inline">Shop</span><span className="xs:hidden sm:hidden">Shop</span>
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
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    setTesting(true)
    try {
      const r = await fetch('/api/settings', { method: 'POST' })
      const res = await r.json()
      if (res.success) {
        toast({ title: 'Connection successful!', description: 'Your Google Sheet is connected.' })
      } else {
        toast({ title: 'Connection failed', description: res.message, variant: 'destructive' })
      }
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
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
