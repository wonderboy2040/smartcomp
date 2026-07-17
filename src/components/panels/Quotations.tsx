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
import { Plus, Search, FileText, Eye, Trash2, Share2, FileCheck2, Edit3 } from 'lucide-react'

export function QuotationsPanel() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const { data: shopSettings } = useFetch<any>('/api/shop', undefined)

  const { data: quotations, loading, refetch } = useFetch<any[]>(
    `/api/quotations?limit=200`,
    undefined
  )

  const filtered = (quotations || []).filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        q.number.toLowerCase().includes(s) ||
        String(q?.customer?.name || q?.customerName || '').toLowerCase().includes(s) ||
        String(q?.customer?.phone || q?.customerPhone || '').includes(s)
      )
    }
    return true
  })

  const handleCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEdit = (q: any) => {
    setEditing(q)
    setDialogOpen(true)
  }

  const handleShareWhatsApp = async (q: any) => {
    try {
      const res = await apiPost('/api/whatsapp/send', {
        action: 'shareQuotation',
        id: q.id,
      })
      window.open(res.link, '_blank')
      toast({ title: 'WhatsApp opened with quotation details' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleConvert = async (q: any) => {
    if (!confirm(`Convert quotation ${q.number} to invoice? Stock will be deducted.`)) return
    try {
      const res = await apiPost(`/api/quotations/${q.id}`, { action: 'convert' })
      toast({ title: 'Converted to invoice', description: `Invoice: ${res.invoiceNumber}` })
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quotation?')) return
    try {
      await apiDelete(`/api/quotations/${id}`)
      toast({ title: 'Quotation deleted' })
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quotations</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Create quotes and convert to invoices</p>
        </div>
        <Button onClick={handleCreate} className="bg-slate-900 hover:bg-slate-800 h-11">
          <Plus className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">New Quotation</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" />
              <Input
                placeholder="Search number, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
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
            No quotations found
          </CardContent></Card>
        ) : (
          filtered.map((q) => {
            const expired = new Date(q?.validTill || Date.now()) < new Date() && q.status === 'draft'
            return (
              <Card key={q.id} className="border-slate-200">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm">{q.number}</p>
                      <p className="text-[10px] text-slate-500">{new Date(q?.date || Date.now()).toLocaleDateString('en-IN')}</p>
                    </div>
                    <Badge variant="outline" className={
                      q.status === 'converted' ? 'bg-green-50 text-green-700 border-green-200 text-[9px]'
                      : q.status === 'accepted' ? 'bg-blue-50 text-blue-700 border-blue-200 text-[9px]'
                      : q.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 text-[9px]'
                      : q.status === 'sent' ? 'bg-amber-50 text-amber-700 border-amber-200 text-[9px]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 text-[9px]'
                    }>{q.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-700 mt-1 truncate">{q?.customer?.name || q?.customerName || 'Walk-in'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <p className="text-base font-bold text-slate-900">{formatCurrency(q.grandTotal)}</p>
                      <p className="text-[10px] text-slate-500">
                        Valid: {new Date(q?.validTill || Date.now()).toLocaleDateString('en-IN')}
                        {expired && <span className="text-red-500 ml-1">Expired</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {q.status !== 'converted' && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleConvert(q)}>
                          <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => window.open(`/api/pdf/${q.id}?type=quotation&template=${encodeURIComponent(shopSettings?.pdfTemplate || 'tally-classic')}&banner=${encodeURIComponent(shopSettings?.adBannerVariant || 'grid')}`, '_blank')}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(q)} title="Edit Quotation">
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleShareWhatsApp(q)}>
                        <Share2 className="w-3.5 h-3.5 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDelete(q.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Desktop table */}
      <Card className="border-slate-200 hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Valid Till</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No quotations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((q) => {
                    const expired = new Date(q?.validTill || Date.now()) < new Date() && q.status === 'draft'
                    return (
                      <TableRow key={q.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">{q.number}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {new Date(q?.date || Date.now()).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {new Date(q?.validTill || Date.now()).toLocaleDateString('en-IN')}
                          {expired && <span className="block text-[10px] text-red-500">Expired</span>}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{q?.customer?.name || q?.customerName || 'Walk-in'}</p>
                            {q?.customer?.phone && (
                              <p className="text-[10px] text-slate-500">{q.customer.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(q.grandTotal)}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              q.status === 'converted' ? 'bg-green-50 text-green-700 border-green-200 text-[10px]'
                              : q.status === 'accepted' ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                              : q.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                              : q.status === 'sent' ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                              : 'bg-slate-50 text-slate-700 border-slate-200 text-[10px]'
                            }
                          >
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {q.status !== 'converted' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConvert(q)}
                                title="Convert to Invoice"
                              >
                                <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/api/pdf/${q.id}?type=quotation&template=${encodeURIComponent(shopSettings?.pdfTemplate || 'tally-classic')}&banner=${encodeURIComponent(shopSettings?.adBannerVariant || 'grid')}`, '_blank')}
                              title="View PDF"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(q)}
                              title="Edit Quotation"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShareWhatsApp(q)}
                              title="Share on WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(q.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
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
        docType="quotation"
        editing={editing}
        onSaved={() => {
          setDialogOpen(false)
          refetch()
        }}
      />

    </div>
  )
}
