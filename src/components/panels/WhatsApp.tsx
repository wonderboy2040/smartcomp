'use client'

import { useState, useEffect } from 'react'
import { useFetch, apiPost, apiPut, invalidate } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/calc'
import {
  MessageSquare, Send, Search, Users, Package, RefreshCw,
  MessageCircle, Check, FileText, ExternalLink, Calendar, Bot
} from 'lucide-react'

export function WhatsAppPanel() {
  const { toast } = useToast()
  const [tab, setTab] = useState<'enquiries' | 'send'>('enquiries')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [responseDialog, setResponseDialog] = useState<any | null>(null)
  const [responseText, setResponseText] = useState('')
  const [parsedRates, setParsedRates] = useState<any[]>([])

  const { data: enquiries, loading, refetch } = useFetch<any[]>('/api/enquiries?limit=100', undefined)
  const { data: suppliers } = useFetch<any[]>('/api/suppliers?active=true', undefined)
  const { data: items } = useFetch<any[]>('/api/items', undefined)
  const { data: waStatus } = useFetch<any>('/api/whatsapp/status', undefined)
  const cloudApiOn = !!waStatus?.configured

  // Auto-refresh every 15s when on the enquiries tab, so incoming webhook replies show up live.
  useEffect(() => {
    if (tab !== 'enquiries') return
    const id = setInterval(() => {
      invalidate('/api/enquiries')
    }, 15000)
    return () => clearInterval(id)
  }, [tab])

  const filteredEnquiries = (enquiries || []).filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    // Defensive: supplier may be undefined for soft-deleted/old enquiries
    const supplierName = String(e?.supplier?.name || e?.supplierName || '').toLowerCase()
    const status = String(e?.status || '').toLowerCase()
    const supplierPhone = String(e?.supplier?.phone || e?.supplierPhone || '').toLowerCase()
    return supplierName.includes(q) || status.includes(q) || supplierPhone.includes(q)
  })

  const handleSendEnquiry = async (payload: {
    supplierIds: string[]
    itemIds: string[]
    allItems: boolean
  }) => {
    try {
      const res = await apiPost('/api/enquiries', {
        supplierIds: payload.supplierIds,
        itemIds: payload.itemIds,
        allItems: payload.allItems,
      })

      if (cloudApiOn && res.results?.[0]?.autoSent) {
        // Cloud API: messages were sent automatically from the server.
        const sent = res.results.filter((r: any) => r.sendStatus === 'sent').length
        const failed = res.results.filter((r: any) => r.sendStatus === 'failed').length
        toast({
          title: `${sent} enquiry message(s) sent automatically`,
          description: failed > 0 ? `${failed} failed — check supplier phone numbers` : 'Replies will appear here automatically',
          variant: failed > 0 ? 'destructive' : 'default',
        })
      } else {
        // Fallback wa.me mode — open tabs for manual send
        for (const r of res.results) {
          if (r.whatsappLink) window.open(r.whatsappLink, '_blank')
        }
        toast({
          title: `${res.results.length} enquiry message(s) generated`,
          description: 'WhatsApp opened - please send each message manually',
        })
      }
      setDialogOpen(false)
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleOpenResponse = (enquiry: any) => {
    setResponseDialog(enquiry)
    setResponseText(enquiry.response || '')
    setParsedRates(enquiry.ratesJson ? JSON.parse(enquiry.ratesJson) : [])
  }

  const handleParseResponse = async () => {
    try {
      const items = JSON.parse(responseDialog.itemsJson || '[]')
      const res = await apiPost('/api/whatsapp/parse', {
        response: responseText,
        items,
      })
      setParsedRates(res.parsed)
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message, variant: 'destructive' })
    }
  }

  const handleSaveResponse = async () => {
    try {
      const res = await apiPut(`/api/enquiries/${responseDialog.id}`, {
        action: 'respond',
        response: responseText,
      })
      toast({ title: 'Response saved', description: `${res.parsedRates?.length || 0} rates detected` })
      setParsedRates(res.parsedRates || [])
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleApplyRates = async () => {
    if (!confirm('Apply these rates to your dashboard items? This will update cost prices and GST settings.')) return
    try {
      const res = await apiPut(`/api/enquiries/${responseDialog.id}`, { action: 'applyRates' })
      toast({ title: 'Rates applied', description: `${res.appliedCount} items updated` })
      setResponseDialog(null)
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const sentCount = (enquiries || []).filter((e) => e.status === 'sent').length
  const respondedCount = (enquiries || []).filter((e) => e.status === 'responded').length
  const updatedCount = (enquiries || []).filter((e) => e.status === 'rate_updated').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
            <span className="truncate">WhatsApp Rate Enquiry</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Send bulk enquiries to suppliers and capture rate responses
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-green-600 hover:bg-green-700 h-11 flex-shrink-0">
          <Send className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">New Enquiry</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Total Sent</span>
              <Send className="w-4 h-4 text-blue-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{enquiries?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Awaiting Reply</span>
              <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-amber-600">{sentCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Responded</span>
              <MessageCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{respondedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Rates Applied</span>
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-emerald-600">{updatedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cloud API status banner */}
      {waStatus && (
        <div className={`rounded-lg p-3 flex items-start gap-3 ${cloudApiOn ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          {cloudApiOn ? <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /> : <Bot className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
          <div className="text-sm flex-1">
            <p className={`font-medium ${cloudApiOn ? 'text-emerald-900' : 'text-amber-900'}`}>
              {cloudApiOn ? 'WhatsApp Cloud API: Connected' : 'WhatsApp Cloud API: Not configured (manual mode)'}
            </p>
            <p className={`text-xs mt-0.5 ${cloudApiOn ? 'text-emerald-700' : 'text-amber-700'}`}>
              {cloudApiOn
                ? `Messages will auto-send from your business number (${waStatus.businessNumber}). Supplier replies will appear here automatically. Template: ${waStatus.templateName}`
                : 'Generate Messages will open wa.me tabs — you must manually hit Send in each. Configure WA_TOKEN / WA_PHONE_NUMBER_ID env vars for automatic sending + reply capture.'}
            </p>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
        <Bot className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-900">Auto Enquiry Schedule</p>
          <p className="text-blue-700 text-xs mt-0.5">
            Enquiries are scheduled on 1st and 15th of every month for active suppliers. Click "New Enquiry" to send manually anytime.
            When supplier replies, paste their response to auto-parse rates and apply to dashboard.
          </p>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="text-center py-8 text-slate-500">Loading...</CardContent></Card>
        ) : filteredEnquiries.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-slate-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No enquiries yet. Tap "New" to begin.
          </CardContent></Card>
        ) : (
          filteredEnquiries.map((e) => {
            const items = JSON.parse(e.itemsJson || '[]')
            return (
              <Card key={e.id} className="border-slate-200">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-slate-900 text-sm truncate">{e?.supplier?.name || e?.supplierName || 'Unknown'}</p>
                        {e.isAuto && (
                          <Bot className="w-3 h-3 text-violet-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">{new Date(e.sentAt).toLocaleDateString('en-IN')} · {new Date(e.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <Badge variant="outline" className={
                      e.status === 'rate_updated' ? 'bg-green-50 text-green-700 border-green-200 text-[9px]'
                      : e.status === 'responded' ? 'bg-blue-50 text-blue-700 border-blue-200 text-[9px]'
                      : 'bg-amber-50 text-amber-700 border-amber-200 text-[9px]'
                    } flex-shrink-0>
                      {String(e.status || 'sent').replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-600 truncate">
                      {items.map((i: any) => i.name).join(', ')}
                    </p>
                    <Badge variant="outline" className="text-[9px] mt-0.5">{items.length} items</Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleOpenResponse(e)} className="w-full mt-2 h-9">
                    {e.status === 'sent' ? 'Add Response' : 'View & Apply'}
                  </Button>
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
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Items Asked</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Responded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : filteredEnquiries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No enquiries yet. Click "New Enquiry" to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEnquiries.map((e) => {
                    const items = JSON.parse(e.itemsJson || '[]')
                    return (
                      <TableRow key={e.id} className="hover:bg-slate-50">
                        <TableCell className="text-sm">
                          {new Date(e.sentAt).toLocaleDateString('en-IN')}
                          <div className="text-[10px] text-slate-500">
                            {new Date(e.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {e.isAuto && (
                            <Badge variant="outline" className="mt-1 text-[9px] bg-violet-50 text-violet-700 border-violet-200">
                              <Bot className="w-2.5 h-2.5 mr-0.5" /> Auto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{e?.supplier?.name || e?.supplierName || 'Unknown'}</div>
                          <div className="text-[10px] text-slate-500">{e?.supplier?.phone || e?.supplierPhone || ''}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-600 max-w-xs truncate">
                            {items.map((i: any) => i.name).join(', ')}
                          </div>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{items.length} items</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              e.status === 'rate_updated' ? 'bg-green-50 text-green-700 border-green-200 text-[10px]'
                              : e.status === 'responded' ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                              : 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                            }
                          >
                            {String(e.status || 'sent').replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {e.respondedAt ? new Date(e.respondedAt).toLocaleDateString('en-IN') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleOpenResponse(e)}>
                            {e.status === 'sent' ? 'Add Response' : 'View & Apply'}
                          </Button>
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

      {/* Send enquiry dialog - stable key to prevent remount/flicker */}
      <SendEnquiryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        suppliers={suppliers || []}
        items={items || []}
        onSend={handleSendEnquiry}
        cloudApiOn={cloudApiOn}
      />

      {/* Response dialog */}
      <Dialog open={!!responseDialog} onOpenChange={(v) => !v && setResponseDialog(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg truncate">Rate Response - {responseDialog?.supplier?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Original Message Sent:</p>
              <p className="text-xs whitespace-pre-wrap font-mono">{responseDialog?.message}</p>
            </div>

            <div>
              <Label>Paste Supplier's Response Here</Label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Paste the WhatsApp reply from supplier here. The system will auto-detect rates from patterns like '1. Item Name: Rs.1000' or 'Item - 1000 (GST: Yes)'"
                rows={6}
                className="font-mono text-xs"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={handleParseResponse}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Preview Parsed Rates
                </Button>
                <Button size="sm" variant="outline" onClick={handleSaveResponse}>
                  Save Response
                </Button>
              </div>
            </div>

            {parsedRates.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-200">
                  <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                    <Check className="w-4 h-4" /> {parsedRates.length} rates detected
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Rate (Rs.)</TableHead>
                      <TableHead className="text-center">GST</TableHead>
                      <TableHead className="text-center">GST Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRates.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{r.itemName}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(r.rate)}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.gstApplicable === null ? (
                            <Badge variant="outline" className="text-[10px]">Unknown</Badge>
                          ) : r.gstApplicable ? (
                            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-[10px]">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {r.gstRate ? `${r.gstRate}%` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {parsedRates.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-900 mb-2">
                  Click below to apply these rates to your dashboard items. This will update cost prices and GST settings.
                </p>
                <Button onClick={handleApplyRates} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
                  <Check className="w-4 h-4 mr-1" /> Apply Rates to Dashboard
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setResponseDialog(null)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SendEnquiryDialog({
  open, onOpenChange, suppliers, items, onSend, cloudApiOn,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  suppliers: any[]
  items: any[]
  onSend: (payload: { supplierIds: string[]; itemIds: string[]; allItems: boolean }) => void
  cloudApiOn: boolean
}) {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [allItems, setAllItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')

  const filteredItems = items.filter((i) => {
    if (!itemSearch) return true
    const q = itemSearch.toLowerCase()
    return i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
  })

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSend = () => {
    if (selectedSuppliers.length === 0) return
    if (!allItems && selectedItems.length === 0) return
    onSend({ supplierIds: selectedSuppliers, itemIds: selectedItems, allItems })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Send Rate Enquiry</DialogTitle>
          {cloudApiOn ? (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Auto-send enabled — messages will be sent automatically from your business number
            </p>
          ) : (
            <p className="text-xs text-amber-600 mt-1">Manual mode — wa.me links will open, you must hit Send in each tab</p>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Suppliers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1 text-sm">
                <Users className="w-4 h-4" /> Suppliers ({selectedSuppliers.length})
              </Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedSuppliers(suppliers.map((s) => s.id))}
                className="h-8 text-xs"
              >
                Select All
              </Button>
            </div>
            <div className="border border-slate-200 rounded-lg max-h-60 sm:max-h-72 overflow-y-auto scrollbar-thin">
              {suppliers.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No active suppliers</p>
              ) : (
                suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 p-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 min-h-[44px]"
                  >
                    <Checkbox
                      checked={selectedSuppliers.includes(s.id)}
                      onCheckedChange={() => toggleSupplier(s.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{s.whatsappNumber || s.phone}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1 text-sm">
                <Package className="w-4 h-4" /> Items
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="all-items"
                  checked={allItems}
                  onCheckedChange={(v) => {
                    setAllItems(v === true)
                    if (v) setSelectedItems([])
                  }}
                />
                <Label htmlFor="all-items" className="text-xs cursor-pointer">All Items</Label>
              </div>
            </div>
            {!allItems && (
              <Input
                placeholder="Search items..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="h-9 text-sm"
              />
            )}
            <div className="border border-slate-200 rounded-lg max-h-56 sm:max-h-64 overflow-y-auto scrollbar-thin">
              {allItems ? (
                <p className="text-sm text-center py-4 text-slate-500">
                  All {items.length} items will be included
                </p>
              ) : filteredItems.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No items found</p>
              ) : (
                filteredItems.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center gap-2 p-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 min-h-[44px]"
                  >
                    <Checkbox
                      checked={selectedItems.includes(i.id)}
                      onCheckedChange={() => toggleItem(i.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{i.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {i.sku} · Cost: {formatCurrency(i.costPrice)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!allItems && (
              <p className="text-xs text-slate-500">{selectedItems.length} items selected</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={selectedSuppliers.length === 0 || (!allItems && selectedItems.length === 0)}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
          >
            <Send className="w-4 h-4 mr-1.5" /> {cloudApiOn ? 'Send Enquiries' : 'Generate Messages'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
