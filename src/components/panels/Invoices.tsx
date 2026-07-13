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
import { Plus, Search, FileText, Eye, Trash2, Share2, IndianRupee, Edit3, CreditCard } from 'lucide-react'

export function InvoicesPanel() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const { data: invoices, loading, refetch } = useFetch<any[]>(
    `/api/invoices?limit=200`,
    undefined
  )

  const filtered = (invoices || []).filter((inv) => {
    if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false
    if (typeFilter !== 'all' && inv.paymentType !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        String(inv?.number || '').toLowerCase().includes(q) ||
        String(inv?.customer?.name || inv?.customerName || '').toLowerCase().includes(q) ||
        String(inv?.customer?.phone || inv?.customerPhone || '').includes(q)
      )
    }
    return true
  })

  const handleCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEdit = (invoice: any) => {
    setEditing(invoice)
    setDialogOpen(true)
  }

  const handleShareWhatsApp = async (invoice: any) => {
    try {
      const res = await apiPost('/api/whatsapp/send', {
        action: 'shareInvoice',
        id: invoice.id,
      })
      window.open(res.link, '_blank')
      toast({ title: 'WhatsApp opened with invoice details' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handlePaymentLink = async (invoice: any) => {
    try {
      const res = await apiPost('/api/razorpay/create-link', { invoiceId: invoice.id })
      if (res.success) {
        if (res.method === 'upi') {
          // UPI link — open in new tab (will prompt UPI app)
          window.open(res.shortUrl, '_blank')
          toast({ title: 'UPI payment link opened', description: `Amount: Rs.${res.amount}` })
        } else {
          // Razorpay link — open in new tab
          window.open(res.shortUrl, '_blank')
          toast({ title: 'Payment link sent', description: `Customer can pay Rs.${res.amount} online` })
        }
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice? Stock will be restored and customer credit adjusted.')) return
    try {
      await apiDelete(`/api/invoices/${id}`)
      toast({ title: 'Invoice deleted' })
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Create GST invoices with profit tracking</p>
        </div>
        <Button onClick={handleCreate} className="bg-slate-900 hover:bg-slate-800 h-11">
          <Plus className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">New Invoice</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" />
              <Input
                placeholder="Search number, customer, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-36 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mobile card layout */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="text-center py-8 text-slate-500">Loading...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No invoices found
          </CardContent></Card>
        ) : (
          filtered.map((inv) => (
            <Card key={inv.id} className="border-slate-200">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 text-sm">{inv.number}</p>
                    <p className="text-[10px] text-slate-500">{new Date(inv?.date || Date.now()).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setPreviewId(inv.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(inv)}>
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    </Button>
                    {Number(inv.amountDue) > 0 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handlePaymentLink(inv)} title="Send Payment Link">
                        <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleShareWhatsApp(inv)}>
                      <Share2 className="w-3.5 h-3.5 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDelete(inv.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-slate-700 mt-1 truncate">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <p className="text-base font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</p>
                    <p className={`text-[10px] ${inv.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Profit: {formatCurrency(inv.profit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={
                      inv.paymentType === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]'
                      : inv.paymentType === 'credit' ? 'bg-orange-50 text-orange-700 border-orange-200 text-[9px]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 text-[9px]'
                    }>{inv.paymentType}</Badge>
                    <Badge variant="outline" className={
                      inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200 text-[9px]'
                      : inv.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200 text-[9px]'
                      : 'bg-red-50 text-red-700 border-red-200 text-[9px]'
                    }>{inv.paymentStatus}</Badge>
                    {inv.amountDue > 0 && (
                      <p className="text-[9px] text-red-500">Due: {formatCurrency(inv.amountDue)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop table layout */}
      <Card className="border-slate-200 hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-900">{inv.number}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(inv?.date || Date.now()).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p>
                          {inv?.customer?.phone && (
                            <p className="text-[10px] text-slate-500">{inv.customer.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(inv.grandTotal)}</TableCell>
                      <TableCell className="text-right text-sm">
                        <span className={inv.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {formatCurrency(inv.profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            inv.paymentType === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                            : inv.paymentType === 'credit' ? 'bg-orange-50 text-orange-700 border-orange-200 text-[10px]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 text-[10px]'
                          }
                        >
                          {inv.paymentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200 text-[10px]'
                            : inv.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                            : 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                          }
                        >
                          {inv.paymentStatus}
                        </Badge>
                        {inv.amountDue > 0 && (
                          <p className="text-[10px] text-red-500 mt-0.5">Due: {formatCurrency(inv.amountDue)}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewId(inv.id)}
                            title="View PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(inv)}
                            title="Edit Invoice"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                          </Button>
                          {Number(inv.amountDue) > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePaymentLink(inv)}
                              title="Send Payment Link"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShareWhatsApp(inv)}
                            title="Share on WhatsApp"
                          >
                            <Share2 className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(inv.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DocForm
        key={editing?.id || 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        docType="invoice"
        editing={editing}
        onSaved={() => {
          setDialogOpen(false)
          refetch()
        }}
      />

      {previewId && (
        <PdfPreview
          url={`/api/pdf/${previewId}?type=invoice`}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  )
}

export function PdfPreview({ url, onClose }: { url: string; onClose: () => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState('indigo-clean')

  const templates = [
    { id: 'indigo-clean', name: 'Indigo Clean', colors: 'from-indigo-600 to-indigo-500' },
    { id: 'saffron-white', name: 'Saffron White', colors: 'from-orange-600 to-orange-400' },
    { id: 'emerald-pro', name: 'Emerald Pro', colors: 'from-emerald-600 to-emerald-500' },
    { id: 'navy-formal', name: 'Navy Formal', colors: 'from-blue-900 to-blue-700' },
    { id: 'graphite-gold', name: 'Graphite Gold', colors: 'from-slate-800 to-amber-600' },
  ]

  const currentUrl = url + (url.includes('?') ? '&' : '?') + `template=${selectedTemplate}`

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header with template selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="font-medium text-sm sm:text-base truncate text-slate-800 dark:text-slate-200">PDF Preview (A4)</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Template selector */}
            <div className="flex gap-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`w-7 h-7 rounded-lg bg-gradient-to-br ${t.colors} transition-all ${selectedTemplate === t.id ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
                  title={t.name}
                />
              ))}
            </div>
            <a href={currentUrl} download target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">Download</Button>
            </a>
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
        {/* Template name */}
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Template: <span className="font-medium text-slate-700 dark:text-slate-300">{templates.find(t => t.id === selectedTemplate)?.name}</span>
          </p>
        </div>
        <iframe src={currentUrl} className="flex-1 w-full" title="PDF Preview" />
      </div>
    </div>
  )
}
