'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiDelete } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/calc'
import { DocForm } from './DocForm'
import { PDF_TEMPLATES } from '@/lib/pdf'
import { Plus, Search, FileText, Eye, Trash2, Share2, Edit3, CreditCard, Sparkles, Printer, Download } from 'lucide-react'

export function InvoicesPanel() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const { data: invoices, loading, refetch } = useFetch<any[]>('/api/invoices?limit=200', undefined)

  const filtered = (invoices || []).filter((inv) => {
    if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false
    if (typeFilter !== 'all' && inv.paymentType !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return String(inv?.number || '').toLowerCase().includes(q) || String(inv?.customer?.name || inv?.customerName || '').toLowerCase().includes(q) || String(inv?.customer?.phone || inv?.customerPhone || '').includes(q)
    }
    return true
  })

  const handleCreate = () => { setEditing(null); setDialogOpen(true) }
  const handleEdit = (invoice: any) => { setEditing(invoice); setDialogOpen(true) }

  const handleShareWhatsApp = async (invoice: any) => {
    try {
      const res = await apiPost('/api/whatsapp/send', { action: 'shareInvoice', id: invoice.id })
      window.open(res.link, '_blank')
      toast({ title: 'WhatsApp opened with invoice details ✓' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handlePaymentLink = async (invoice: any) => {
    try {
      const res = await apiPost('/api/razorpay/create-link', { invoiceId: invoice.id })
      if (res.success) {
        window.open(res.shortUrl, '_blank')
        toast({ title: res.method === 'upi' ? 'UPI payment link opened' : 'Payment link sent', description: `Amount: Rs.${res.amount}` })
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice? Stock will be restored and customer credit adjusted.')) return
    try { await apiDelete(`/api/invoices/${id}`); toast({ title: 'Invoice deleted ✓' }); refetch() }
    catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            Invoices <span className="text-[10px] px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold">10 Premium GST Templates • A4 Perfect</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Create GST invoices - Professional A4 printable - 10 premium designs - HSN summary - UPI QR</p>
        </div>
        <Button onClick={handleCreate} className="bg-slate-900 hover:bg-slate-800 h-11 font-bold"><Plus className="w-4 h-4 mr-1.5" /> New Invoice</Button>
      </div>

      <Card className="border-slate-200 bg-white"><CardContent className="p-3"><div className="flex flex-wrap items-center gap-2"><div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" /><Input placeholder="Search number, customer, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 bg-white border-slate-200" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-36 h-11 bg-white border-slate-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent></Select><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-36 h-11 bg-white border-slate-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit">Credit</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div></CardContent></Card>

      <div className="sm:hidden space-y-3">
        {loading ? <Card><CardContent className="text-center py-8 text-slate-600">Loading...</CardContent></Card> : filtered.length === 0 ? <Card><CardContent className="text-center py-8 text-slate-500"><FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />No invoices</CardContent></Card> : filtered.map((inv) => (
          <Card key={inv.id} className="border-slate-200 bg-white"><CardContent className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="font-bold text-slate-900 text-sm">{inv.number}</p><p className="text-[10px] text-slate-500">{new Date(inv?.date || Date.now()).toLocaleDateString('en-IN')}</p></div><div className="flex gap-1 flex-shrink-0"><Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border" onClick={() => setPreviewId(inv.id)}><Eye className="w-3.5 h-3.5" /></Button><Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border" onClick={() => handleEdit(inv)}><Edit3 className="w-3.5 h-3.5 text-blue-600" /></Button><Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border" onClick={() => handleShareWhatsApp(inv)}><Share2 className="w-3.5 h-3.5 text-green-600" /></Button></div></div><p className="text-sm font-semibold text-slate-800 mt-1 truncate">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p><div className="flex items-center justify-between mt-2"><div><p className="text-base font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</p><p className={`text-[10px] font-bold ${inv.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Profit: {formatCurrency(inv.profit)}</p></div><div className="flex flex-col items-end gap-1"><Badge variant="outline" className="bg-white text-slate-700 border-slate-200 text-[9px] font-bold">{inv.paymentType}</Badge><Badge variant="outline" className={`${inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : inv.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'} text-[9px] font-bold`}>{inv.paymentStatus}</Badge></div></div></CardContent></Card>
        ))}
      </div>

      <Card className="border-slate-200 bg-white hidden sm:block"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead className="font-bold text-slate-700">Invoice #</TableHead><TableHead className="font-bold text-slate-700">Date</TableHead><TableHead className="font-bold text-slate-700">Customer</TableHead><TableHead className="text-right font-bold text-slate-700">Total</TableHead><TableHead className="text-right font-bold text-slate-700">Profit</TableHead><TableHead className="text-center font-bold text-slate-700">Type</TableHead><TableHead className="text-center font-bold text-slate-700">Status</TableHead><TableHead className="text-right font-bold text-slate-700">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-600">Loading...</TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">No invoices</TableCell></TableRow> : filtered.map((inv) => (<TableRow key={inv.id} className="hover:bg-slate-50"><TableCell className="font-bold text-slate-900">{inv.number}</TableCell><TableCell className="text-sm text-slate-700">{new Date(inv?.date || Date.now()).toLocaleDateString('en-IN')}</TableCell><TableCell><p className="text-sm font-bold text-slate-900">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p>{inv?.customer?.phone && <p className="text-[10px] text-slate-500">{inv.customer.phone}</p>}</TableCell><TableCell className="text-right font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</TableCell><TableCell className="text-right text-sm font-bold"><span className={inv.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(inv.profit)}</span></TableCell><TableCell className="text-center"><Badge variant="outline" className="bg-white text-slate-700 border-slate-200 text-[10px] font-bold">{inv.paymentType}</Badge></TableCell><TableCell className="text-center"><Badge variant="outline" className={`${inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : inv.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'} text-[10px] font-bold`}>{inv.paymentStatus}</Badge></TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setPreviewId(inv.id)} className="h-8 w-8 p-0 bg-white border hover:bg-slate-50"><Eye className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleEdit(inv)} className="h-8 w-8 p-0 bg-white border hover:bg-blue-50"><Edit3 className="w-4 h-4 text-blue-600" /></Button><Button variant="ghost" size="sm" onClick={() => handleShareWhatsApp(inv)} className="h-8 w-8 p-0 bg-white border hover:bg-green-50"><Share2 className="w-4 h-4 text-green-600" /></Button></div></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>

      <DocForm key={editing?.id || 'new'} open={dialogOpen} onOpenChange={setDialogOpen} docType="invoice" editing={editing} onSaved={() => { setDialogOpen(false); refetch() }} />
      {previewId && <PdfPreview url={`/api/pdf/${previewId}?type=invoice`} onClose={() => setPreviewId(null)} />}
    </div>
  )
}

export function PdfPreview({ url, onClose }: { url: string; onClose: () => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState('tally-classic')

  const currentUrl = url + (url.includes('?') ? '&' : '?') + `template=${selectedTemplate}`
  const activeTemplate = PDF_TEMPLATES.find(t => t.id === selectedTemplate)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[95vh] flex flex-col shadow-2xl border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center"><FileText className="w-5 h-5 text-white" /></div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">PDF Preview - A4 Perfect Fit <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">10 Premium GST Templates • Printable</span></h3>
              <p className="text-[11px] text-slate-500">Active: <span className="font-bold text-slate-800">{activeTemplate?.name}</span> - {activeTemplate?.description} <span className="ml-2 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-bold">{activeTemplate?.badge}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={currentUrl} download target="_blank" rel="noreferrer"><Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-9"><Download className="w-4 h-4 mr-1" />Download PDF</Button></a>
            <Button size="sm" variant="outline" onClick={onClose} className="bg-white border-slate-200 h-9">Close</Button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-b overflow-x-auto flex-shrink-0">
          <div className="flex gap-2 min-w-max">
            {PDF_TEMPLATES.map((tpl) => {
              const isActive = selectedTemplate === tpl.id
              return (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all min-w-[160px] ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-md scale-[1.02]' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `rgb(${tpl.accent.join(',')})` }}><Sparkles className="w-3 h-3 text-white" /></div>
                    <span className="text-xs font-bold text-slate-900 truncate">{tpl.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight">{tpl.description}</p>
                  <div className="flex gap-1 mt-2">
                    <span className="w-4 h-2 rounded-full" style={{ background: `rgb(${tpl.headerBg.join(',')})`, border: `1px solid rgb(${tpl.accent.join(',')})` }}></span>
                    <span className="w-4 h-2 rounded-full" style={{ background: `rgb(${tpl.accent.join(',')})` }}></span>
                    <span className="w-4 h-2 rounded-full" style={{ background: `rgb(${tpl.tableHead.join(',')})` }}></span>
                  </div>
                  <span className="absolute -top-2 -right-2 text-[8px] px-1.5 py-0.5 bg-amber-400 text-amber-900 font-bold rounded-full border border-amber-500 shadow-sm">{tpl.badge}</span>
                  {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                </button>
              )
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2 text-[10px]">
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-full text-slate-600">✓ GST Compliant - HSN, GSTIN, State Code, CGST/SGST/IGST</span>
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-full text-slate-600">✓ A4 Perfect Fit (12mm margins = 186mm usable)</span>
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-full text-slate-600">✓ Printable - Light backgrounds, 0.15mm borders</span>
            <span className="px-2 py-1 bg-white border border-slate-200 rounded-full text-slate-600">✓ Bank Details + UPI QR + HSN Summary + Round Off</span>
          </div>
        </div>

        <div className="flex-1 flex gap-0 min-h-0">
          <iframe src={currentUrl} className="flex-1 w-full bg-white" title="PDF Preview A4" />
          <div className="hidden xl:block w-64 border-l bg-slate-50 p-3 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />Print Tips - A4 Perfect</h4>
            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside">
              <li>Print on A4 (210x297mm) - Margins 12mm</li>
              <li>Scale: 100% (no shrink)</li>
              <li>Background graphics: ON for premium look</li>
              <li>All templates are GST compliant</li>
              <li>HSN summary auto shows if multiple HSN</li>
              <li>Bank + UPI QR for easy payment</li>
              <li>Amount in words, terms, signature included</li>
              <li>Total 10 templates - choose per client</li>
              <li>Service invoice same design via /api/service-pdf</li>
              <li>For low ink, use Minimal White Pro</li>
            </ul>
            <div className="mt-3 p-2.5 bg-white border-2 border-indigo-200 rounded-xl">
              <p className="text-[11px] font-bold text-indigo-900">Active Template</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{activeTemplate?.name}</p>
              <p className="text-[10px] text-slate-600 mt-1">{activeTemplate?.description}</p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <div className="text-center"><div className="w-full h-6 rounded" style={{ background: `rgb(${activeTemplate?.headerBg.join(',')})`, border: '1px solid #e2e8f0' }}></div><p className="text-[8px] text-slate-500 mt-0.5">Header</p></div>
                <div className="text-center"><div className="w-full h-6 rounded" style={{ background: `rgb(${activeTemplate?.accent.join(',')})` }}></div><p className="text-[8px] text-slate-500 mt-0.5">Accent</p></div>
                <div className="text-center"><div className="w-full h-6 rounded" style={{ background: `rgb(${activeTemplate?.tableHead.join(',')})` }}></div><p className="text-[8px] text-slate-500 mt-0.5">Table</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


