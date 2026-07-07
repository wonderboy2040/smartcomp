'use client'

import { useState, useEffect, useMemo } from 'react'
import { useFetch, apiPost, apiPut } from '@/lib/api'
import { safeJsonParse } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { computeInvoice, formatCurrency, type LineItem } from '@/lib/calc'
import { Plus, Trash2, Search, FileText } from 'lucide-react'

interface DocFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  docType: 'invoice' | 'quotation'
  editing?: any | null
  onSaved: (doc: any) => void
}

export function DocForm({ open, onOpenChange, docType, editing, onSaved }: DocFormProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [courierCharges, setCourierCharges] = useState(0)
  const [otherCharges, setOtherCharges] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [paymentType, setPaymentType] = useState('cash')
  const [amountPaid, setAmountPaid] = useState(0)
  const [notes, setNotes] = useState('')
  const [validTill, setValidTill] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))

  const { data: customers } = useFetch<any[]>('/api/customers', undefined)
  const { data: stockItems } = useFetch<any[]>('/api/items', undefined)
  const [itemSearch, setItemSearch] = useState('')
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [customItem, setCustomItem] = useState({ name: '', rate: 0, qty: 1 })

  useEffect(() => {
    if (open) {
      if (editing) {
        setCustomerId(editing.customerId)
        const parsedItems = (safeJsonParse<any[]>(editing.itemsJson, []) as any[]).map((i) => ({
          ...i,
          discount: i.discount || 0,
        }))
        setItems(parsedItems)
        setCourierCharges(editing.courierCharges || 0)
        setOtherCharges(editing.otherCharges || 0)
        setDiscount(editing.discount || 0)
        setPaymentType(editing.paymentType || 'cash')
        setAmountPaid(editing.amountPaid || 0)
        setNotes(editing.notes || '')
        setValidTill(editing.validTill ? new Date(editing.validTill).toISOString().slice(0, 10) : '')
        setDate(editing.date ? new Date(editing.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
      } else {
        setCustomerId('')
        setItems([])
        setCourierCharges(0)
        setOtherCharges(0)
        setDiscount(0)
        setPaymentType('cash')
        setAmountPaid(0)
        setNotes('')
        setValidTill(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        setDate(new Date().toISOString().slice(0, 10))
      }
    }
  }, [open, editing])

  const calc = useMemo(
    () => computeInvoice(items, { courierCharges, otherCharges, discount }),
    [items, courierCharges, otherCharges, discount]
  )

  const filteredStock = (stockItems || []).filter((i) => {
    if (!itemSearch) return true
    const q = itemSearch.toLowerCase()
    return String(i?.name || '').toLowerCase().includes(q) || String(i?.sku || '').toLowerCase().includes(q)
  })

  const addStockItem = (item: any) => {
    setItems([
      ...items,
      {
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        hsnCode: item.hsnCode,
        quantity: 1,
        rate: item.sellingPrice,
        gstApplicable: item.gstApplicable,
        gstRate: item.gstRate,
        costPrice: item.costPrice,
        discount: 0,
      },
    ])
    setShowItemPicker(false)
    setItemSearch('')
  }

  const addCustomItem = () => {
    if (!customItem.name) return
    setItems([
      ...items,
      {
        name: customItem.name,
        quantity: customItem.qty,
        rate: customItem.rate,
        gstApplicable: false,
        gstRate: 0,
        discount: 0,
      },
    ])
    setCustomItem({ name: '', rate: 0, qty: 1 })
  }

  const updateItem = (idx: number, updates: Partial<LineItem>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...updates } : it)))
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!customerId) {
      toast({ title: 'Please select a customer', variant: 'destructive' })
      return
    }
    if (items.length === 0) {
      toast({ title: 'Add at least one item', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        customerId,
        items,
        courierCharges,
        otherCharges,
        discount,
        notes,
        date,
      }
      if (docType === 'invoice') {
        payload.paymentType = paymentType
        payload.amountPaid = amountPaid
      } else {
        payload.validTill = validTill
      }
      const url = editing
        ? `/api/${docType === 'invoice' ? 'invoices' : 'quotations'}/${editing.id}`
        : `/api/${docType === 'invoice' ? 'invoices' : 'quotations'}`
      const result = editing
        ? await apiPut(url, payload)
        : await apiPost(url, payload)
      toast({ title: `${docType === 'invoice' ? 'Invoice' : 'Quotation'} ${editing ? 'updated' : 'created'}` })
      onSaved(result)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[100dvh] sm:max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">
              {editing ? `Edit ${docType === 'invoice' ? 'Invoice' : 'Quotation'}` : `Create New ${docType === 'invoice' ? 'Invoice' : 'Quotation'}`}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Top section: customer + date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {(customers || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.phone ? `· ${c.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            {docType === 'quotation' && (
              <div>
                <Label>Valid Till</Label>
                <Input type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} className="mt-1" />
              </div>
            )}
          </div>

          {/* Items section */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
              <span className="text-sm font-medium">Items</span>
              <Button size="sm" variant="outline" onClick={() => setShowItemPicker(true)} className="h-9">
                <Plus className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Add from Stock</span><span className="sm:hidden">Add Stock</span>
              </Button>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white">
                    <TableHead>Item</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-28">Rate</TableHead>
                    <TableHead className="w-24">Disc</TableHead>
                    <TableHead className="w-20 text-center">GST</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                    <TableHead className="w-28 text-right">GST Amt</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6 text-slate-400 text-sm">
                        No items added. Click "Add from Stock" to begin.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, idx) => {
                      const computed = computeInvoice([item]).items[0]
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium text-sm">{item.name}</div>
                            {item.sku && <div className="text-[10px] text-slate-500">{item.sku}</div>}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.discount || 0}
                              onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.gstApplicable}
                              onCheckedChange={(v) => updateItem(idx, { gstApplicable: v === true })}
                            />
                            {item.gstApplicable && (
                              <span className="block text-[10px] text-slate-500 mt-1">{item.gstRate}%</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(computed.amount)}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(computed.gstAmount)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatCurrency(computed.total)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-slate-200">
              {items.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm px-3">
                  No items added. Tap "Add Stock" to begin.
                </div>
              ) : (
                items.map((item, idx) => {
                  const computed = computeInvoice([item]).items[0]
                  return (
                    <div key={idx} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.sku && <div className="text-[10px] text-slate-500">{item.sku}</div>}
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={() => removeItem(idx)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[9px] text-slate-500">Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-[9px] text-slate-500">Rate</Label>
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-[9px] text-slate-500">Disc</Label>
                          <Input
                            type="number"
                            value={item.discount || 0}
                            onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={item.gstApplicable}
                            onCheckedChange={(v) => updateItem(idx, { gstApplicable: v === true })}
                          />
                          <span className="text-slate-600">GST {item.gstApplicable ? `${item.gstRate}%` : 'No'}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500">
                            Amt: {formatCurrency(computed.amount)} · GST: {formatCurrency(computed.gstAmount)}
                          </div>
                          <div className="font-medium text-sm">{formatCurrency(computed.total)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Custom item quick add */}
            <div className="bg-slate-50 p-2 border-t border-slate-200">
              <Label className="text-[10px] text-slate-500 block mb-1">Quick Add Custom Item</Label>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <Input
                    value={customItem.name}
                    onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                    className="h-9 text-sm"
                    placeholder="Item name"
                  />
                </div>
                <div className="w-16">
                  <Input
                    type="number"
                    value={customItem.qty}
                    onChange={(e) => setCustomItem({ ...customItem, qty: Number(e.target.value) })}
                    className="h-9 text-sm"
                    placeholder="Qty"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    value={customItem.rate}
                    onChange={(e) => setCustomItem({ ...customItem, rate: Number(e.target.value) })}
                    className="h-9 text-sm"
                    placeholder="Rate"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={addCustomItem} className="h-9">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>
          </div>

          {/* Charges & totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {docType === 'invoice' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Payment Type</Label>
                      <Select value={paymentType} onValueChange={setPaymentType}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Amount Paid (Rs.)</Label>
                      <Input
                        type="number"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  {amountPaid < calc.grandTotal && (
                    <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
                      Due Amount: <strong>{formatCurrency(Math.max(0, calc.grandTotal - amountPaid))}</strong> (Credit)
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Courier (Rs.)</Label>
                  <Input
                    type="number"
                    value={courierCharges}
                    onChange={(e) => setCourierCharges(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Other (Rs.)</Label>
                  <Input
                    type="number"
                    value={otherCharges}
                    onChange={(e) => setOtherCharges(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Discount (Rs.)</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="h-9"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(calc.subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount:</span>
                  <span>- {formatCurrency(calc.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">GST Amount:</span>
                <span className="font-medium">{formatCurrency(calc.gstAmount)}</span>
              </div>
              {courierCharges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Courier:</span>
                  <span className="font-medium">{formatCurrency(calc.courierCharges)}</span>
                </div>
              )}
              {otherCharges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Other Charges:</span>
                  <span className="font-medium">{formatCurrency(calc.otherCharges)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-1.5 flex justify-between text-base font-bold">
                <span>Grand Total:</span>
                <span className="text-slate-900">{formatCurrency(calc.grandTotal)}</span>
              </div>
              {docType === 'invoice' && (
                <div className="pt-1.5 text-xs text-slate-500 flex justify-between">
                  <span>Profit (Subtotal - Cost):</span>
                  <span className={calc.profit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                    {formatCurrency(calc.profit)}
                  </span>
                </div>
              )}
              <div className="text-xs text-slate-500 flex justify-between">
                <span>Total Items:</span>
                <span>{items.length}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 w-full sm:w-auto">
            {saving ? 'Saving...' : editing ? 'Update' : `Create ${docType === 'invoice' ? 'Invoice' : 'Quotation'}`}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Item picker dialog */}
      <Dialog open={showItemPicker} onOpenChange={setShowItemPicker}>
        <DialogContent className="sm:max-w-2xl max-h-[100dvh] sm:max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Select Item from Stock</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" />
            <Input
              placeholder="Search items..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 sticky top-0">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">GST</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-[10px] text-slate-500">{item.sku}</div>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {item.gstApplicable ? `${item.gstRate}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(item.sellingPrice)}</TableCell>
                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => addStockItem(item)}>Add</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
