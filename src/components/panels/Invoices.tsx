'use client'

import { useState, useMemo } from 'react'
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
import { usePdfPreview } from '@/lib/preview-context'
import { DocForm } from './DocForm'
import { Plus, Search, FileText, Eye, Trash2, Share2, Edit3, CreditCard } from 'lucide-react'

export function InvoicesPanel() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const { data: shopSettings } = useFetch<any>('/api/shop', undefined)
  const { openPreview } = usePdfPreview()

  const { data: invoices, loading, refetch } = useFetch<any[]>('/api/invoices?limit=200', undefined)

  const filtered = useMemo(() => {
    return (invoices || []).filter((inv) => {
      if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false
      if (typeFilter !== 'all' && inv.paymentType !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return String(inv?.number || '').toLowerCase().includes(q) || String(inv?.customer?.name || inv?.customerName || '').toLowerCase().includes(q) || String(inv?.customer?.phone || inv?.customerPhone || '').includes(q)
      }
      return true
    })
  }, [invoices, statusFilter, typeFilter, search])

  const handleCreate = () => { setEditing(null); setDialogOpen(true) }
  const handleEdit = (invoice: any) => { setEditing(invoice); setDialogOpen(true) }

  const handleShareWhatsApp = async (invoice: any) => {
    try {
      const res = await apiPost('/api/whatsapp/send', { action: 'shareInvoice', id: invoice.id })
      window.open(res.link, '_blank')
      toast({
        title: 'WhatsApp opened with invoice details ✓',
        duration: 3500,
      })
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handlePaymentLink = async (invoice: any) => {
    try {
      const res = await apiPost('/api/razorpay/create-link', { invoiceId: invoice.id })
      if (res.success) {
        window.open(res.shortUrl, '_blank')
        toast({
          title: res.method === 'upi' ? 'UPI payment link opened' : 'Payment link sent',
          description: `Amount: Rs.${res.amount}`,
          duration: 4000,
        })
      } else {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
          duration: 6000,
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice? Stock will be restored and customer credit adjusted.')) return
    try {
      await apiDelete(`/api/invoices/${id}`)
      toast({
        title: 'Invoice deleted ✓',
        description: 'Removed locally - syncing to cloud',
        duration: 3500,
      })
      refetch()
    } catch (e: any) {
      toast({
        title: 'Delete failed',
        description: e.message,
        variant: 'destructive',
        duration: 6000,
      })
    }
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
          <Card key={inv.id} className="border-slate-200 bg-white"><CardContent className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="font-bold text-slate-900 text-sm">{inv.number}</p><p className="text-[10px] text-slate-500">{new Date(inv?.date || Date.now()).toLocaleDateString('en-IN')}</p></div><div className="flex gap-1 flex-shrink-0"><Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border" onClick={() => openPreview(`/api/pdf/${inv.id}?type=invoice&template=${encodeURIComponent(shopSettings?.pdfTemplate || 'tally-classic')}&banner=${encodeURIComponent(shopSettings?.adBannerVariant || 'grid')}`, `Invoice ${inv.number}`, inv)}><Eye className="w-3.5 h-3.5" /></Button><Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border" onClick={() => handleEdit(inv)}><Edit3 className="w-3.5 h-3.5 text-blue-600" /></Button><Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white border" onClick={() => handleShareWhatsApp(inv)}><Share2 className="w-3.5 h-3.5 text-green-600" /></Button></div></div><p className="text-sm font-semibold text-slate-800 mt-1 truncate">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p><div className="flex items-center justify-between mt-2"><div><p className="text-base font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</p><p className={`text-[10px] font-bold ${inv.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Profit: {formatCurrency(inv.profit)}</p></div><div className="flex flex-col items-end gap-1"><Badge variant="outline" className="bg-white text-slate-700 border-slate-200 text-[9px] font-bold">{inv.paymentType}</Badge><Badge variant="outline" className={`${inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : inv.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'} text-[9px] font-bold`}>{inv.paymentStatus}</Badge></div></div></CardContent></Card>
        ))}
      </div>

      <Card className="border-slate-200 bg-white hidden sm:block"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead className="font-bold text-slate-700">Invoice #</TableHead><TableHead className="font-bold text-slate-700">Date</TableHead><TableHead className="font-bold text-slate-700">Customer</TableHead><TableHead className="text-right font-bold text-slate-700">Total</TableHead><TableHead className="text-right font-bold text-slate-700">Profit</TableHead><TableHead className="text-center font-bold text-slate-700">Type</TableHead><TableHead className="text-center font-bold text-slate-700">Status</TableHead><TableHead className="text-right font-bold text-slate-700">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-600">Loading...</TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">No invoices</TableCell></TableRow> : filtered.map((inv) => (<TableRow key={inv.id} className="hover:bg-slate-50"><TableCell className="font-bold text-slate-900">{inv.number}</TableCell><TableCell className="text-sm text-slate-700">{new Date(inv?.date || Date.now()).toLocaleDateString('en-IN')}</TableCell><TableCell><p className="text-sm font-bold text-slate-900">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p>{inv?.customer?.phone && <p className="text-[10px] text-slate-500">{inv.customer.phone}</p>}</TableCell><TableCell className="text-right font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</TableCell><TableCell className="text-right text-sm font-bold"><span className={inv.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(inv.profit)}</span></TableCell><TableCell className="text-center"><Badge variant="outline" className="bg-white text-slate-700 border-slate-200 text-[10px] font-bold">{inv.paymentType}</Badge></TableCell><TableCell className="text-center"><Badge variant="outline" className={`${inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : inv.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'} text-[10px] font-bold`}>{inv.paymentStatus}</Badge></TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openPreview(`/api/pdf/${inv.id}?type=invoice&template=${encodeURIComponent(shopSettings?.pdfTemplate || 'tally-classic')}&banner=${encodeURIComponent(shopSettings?.adBannerVariant || 'grid')}`, `Invoice ${inv.number}`, inv)} className="h-8 w-8 p-0 bg-white border hover:bg-slate-50"><Eye className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleEdit(inv)} className="h-8 w-8 p-0 bg-white border hover:bg-blue-50"><Edit3 className="w-4 h-4 text-blue-600" /></Button><Button variant="ghost" size="sm" onClick={() => handleShareWhatsApp(inv)} className="h-8 w-8 p-0 bg-white border hover:bg-green-50"><Share2 className="w-4 h-4 text-green-600" /></Button></div></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>

      <DocForm key={editing?.id || 'new'} open={dialogOpen} onOpenChange={setDialogOpen} docType="invoice" editing={editing} onSaved={() => { setDialogOpen(false); refetch() }} />
    </div>
  )
}
