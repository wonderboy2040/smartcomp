'use client'

import { useState, useCallback, useMemo } from 'react'
import { useFetch, apiPost, apiPut, apiDelete, invalidate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Plus, Trash2, FileText, Edit, Eye, UserPlus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface QuotationItem {
  id?: string
  itemId?: string
  name: string
  description?: string
  quantity: number
  unitPrice: number
  gstRate?: number
  hsnCode?: string
}

interface Quotation {
  id: string
  quotationNumber?: string
  customerId?: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  date: string
  validUntil?: string
  items: QuotationItem[]
  subtotal: number
  gstAmount: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  notes?: string
  terms?: string
}

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
}

interface Item {
  id: string
  name: string
  description?: string
  sellPrice?: number
  gstRate?: number
  hsnCode?: string
}

export function QuotationsPanel() {
  const { data: rawQuotations, refetch: refetchQuotations } = useFetch<Quotation[]>('/api/quotations', undefined)
  const { data: rawCustomers } = useFetch<any[]>('/api/customers', undefined)
  const { data: rawItems } = useFetch<any[]>('/api/items', undefined)
  const quotations = rawQuotations || []
  const customers = rawCustomers || []
  const items = rawItems || []

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Quotation | null>(null)
  const [viewing, setViewing] = useState<Quotation | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return quotations
    const q = search.toLowerCase()
    return quotations.filter((qt: Quotation) =>
      qt.customerName?.toLowerCase().includes(q) ||
      qt.quotationNumber?.toLowerCase().includes(q)
    )
  }, [quotations, search])

  const stats = useMemo(() => ({
    total: quotations.length,
    draft: quotations.filter((q: Quotation) => q.status === 'draft').length,
    sent: quotations.filter((q: Quotation) => q.status === 'sent').length,
    accepted: quotations.filter((q: Quotation) => q.status === 'accepted').length,
    totalValue: quotations.reduce((s: number, q: Quotation) => s + (q.total || 0), 0),
  }), [quotations])

  const handleSave = useCallback(async (quotation: Quotation) => {
    setSaving(true)
    try {
      if (quotation.id) {
        await apiPut(`/api/quotations/${quotation.id}`, quotation)
      } else {
        await apiPost('/api/quotations', quotation)
      }
      toast.success(quotation.id ? 'Quotation updated' : 'Quotation created')
      setEditing(null)
      invalidate('/api/quotations')
      refetchQuotations()
    } catch (err: any) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }, [refetchQuotations])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this quotation?')) return
    try {
      await apiDelete(`/api/quotations/${id}`)
      toast.success('Deleted')
      invalidate('/api/quotations')
      refetchQuotations()
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    }
  }, [refetchQuotations])

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-500',
    sent: 'bg-blue-500/10 text-blue-500',
    accepted: 'bg-green-500/10 text-green-500',
    rejected: 'bg-red-500/10 text-red-500',
    expired: 'bg-amber-500/10 text-amber-500',
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><div className="text-xl font-bold">{stats.total}</div><p className="text-[10px] text-muted-foreground uppercase">Total</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xl font-bold text-slate-500">{stats.draft}</div><p className="text-[10px] text-muted-foreground uppercase">Draft</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xl font-bold text-blue-500">{stats.sent}</div><p className="text-[10px] text-muted-foreground uppercase">Sent</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xl font-bold text-green-500">{stats.accepted}</div><p className="text-[10px] text-muted-foreground uppercase">Accepted</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xl font-bold">₹{stats.totalValue.toLocaleString()}</div><p className="text-[10px] text-muted-foreground uppercase">Total Value</p></CardContent></Card>
      </div>

      {/* Search & Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search quotations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setEditing({
          id: '', customerName: '', date: new Date().toISOString().split('T')[0],
          items: [], subtotal: 0, gstAmount: 0, total: 0, status: 'draft'
        })}>
          <Plus className="h-4 w-4 mr-1" /> New Quotation
        </Button>
      </div>

      {/* Quotations List */}
      <div className="space-y-3">
        {filtered.map((qt: Quotation) => {
          const isExpanded = expandedId === qt.id
          return (
            <Card key={qt.id} className="group overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedId(isExpanded ? null : qt.id)} className="p-0.5 hover:bg-accent rounded">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <span className="font-mono font-medium text-sm">{qt.quotationNumber || qt.id.slice(0, 8)}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusColors[qt.status] || ''}`}>{qt.status}</Badge>
                    </div>
                    <div className="mt-1 font-medium">{qt.customerName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(qt.date).toLocaleDateString()} — Valid until {qt.validUntil ? new Date(qt.validUntil).toLocaleDateString() : 'N/A'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">₹{qt.total?.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{qt.items?.length || 0} items</div>
                  </div>
                </div>

                {/* Expanded Items */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {qt.items?.map((item: QuotationItem, idx: number) => (
                      <div key={idx} className="flex items-start justify-between text-sm">
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                          )}
                        </div>
                        <div className="text-right text-muted-foreground">
                          {item.quantity} × ₹{item.unitPrice?.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <button onClick={() => setViewing(qt)} className="p-1.5 hover:bg-accent rounded-md"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                      <button onClick={() => setEditing(qt)} className="p-1.5 hover:bg-accent rounded-md"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                      <button onClick={() => handleDelete(qt.id)} className="p-1.5 hover:bg-red-500/10 rounded-md"><Trash2 className="h-4 w-4 text-red-500" /></button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-8">No quotations found</div>}
      </div>

      {/* Edit Modal */}
      {editing && (
        <QuotationForm
          quotation={editing}
          customers={customers}
          items={items}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Quotation #{viewing.quotationNumber}</h3>
              <button onClick={() => setViewing(null)} className="p-1 hover:bg-accent rounded"><X className="h-5 w-5" /></button>
            </div>
            <QuotationPreview quotation={viewing} />
          </div>
        </div>
      )}
    </div>
  )
}

// ===== QUOTATION FORM WITH NEW CUSTOMER OPTION =====
function QuotationForm({ quotation, customers, items, onSave, onCancel, saving }: {
  quotation: Quotation; customers: Customer[]; items: Item[];
  onSave: (q: Quotation) => void; onCancel: () => void; saving: boolean
}) {
  const [form, setForm] = useState<Quotation>({ ...quotation })
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', gstin: '' })
  const [selectedItemId, setSelectedItemId] = useState('')
  const [newItemQty, setNewItemQty] = useState(1)

  // Auto-fill customer details when selecting existing customer
  const handleCustomerSelect = (customerId: string) => {
    if (customerId === '__new__') {
      setShowNewCustomer(true)
      setForm({ ...form, customerId: undefined, customerName: '' })
      return
    }
    const customer = customers.find((c: Customer) => c.id === customerId)
    if (customer) {
      setForm({
        ...form,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerAddress: customer.address,
      })
      setShowNewCustomer(false)
    }
  }

  // Save new customer inline
  const handleAddNewCustomer = async () => {
    if (!newCustomer.name) {
      toast.error('Customer name required')
      return
    }
    try {
      // Create customer via API
      const res = await apiPost('/api/customers', newCustomer)
      const createdCustomer = res.data || res
      setForm({
        ...form,
        customerId: createdCustomer.id,
        customerName: createdCustomer.name,
        customerPhone: createdCustomer.phone,
        customerEmail: createdCustomer.email,
        customerAddress: createdCustomer.address,
      })
      setShowNewCustomer(false)
      setNewCustomer({ name: '', phone: '', email: '', address: '', gstin: '' })
      toast.success('Customer added')
      invalidate('/api/customers')
    } catch (err: any) {
      toast.error('Failed to add customer: ' + err.message)
    }
  }

  // Add item from stock
  const handleAddItem = () => {
    if (!selectedItemId) return
    const item = items.find((i: Item) => i.id === selectedItemId)
    if (!item) return
    const newItem: QuotationItem = {
      itemId: item.id,
      name: item.name,
      description: item.description || '',
      quantity: newItemQty,
      unitPrice: item.sellPrice || 0,
      gstRate: item.gstRate || 18,
      hsnCode: item.hsnCode || '',
    }
    const updatedItems = [...(form.items || []), newItem]
    recalcTotals(updatedItems)
    setSelectedItemId('')
    setNewItemQty(1)
  }

  // Add custom item
  const handleAddCustomItem = () => {
    const newItem: QuotationItem = {
      name: 'New Item',
      description: '',
      quantity: 1,
      unitPrice: 0,
      gstRate: 18,
    }
    const updatedItems = [...(form.items || []), newItem]
    recalcTotals(updatedItems)
  }

  // Remove item
  const handleRemoveItem = (idx: number) => {
    const updated = form.items.filter((_, i) => i !== idx)
    recalcTotals(updated)
  }

  // Update item
  const handleUpdateItem = (idx: number, field: keyof QuotationItem, value: any) => {
    const updated = form.items.map((item, i) => i === idx ? { ...item, [field]: value } : item)
    recalcTotals(updated)
  }

  // Recalculate totals
  const recalcTotals = (items: QuotationItem[]) => {
    const subtotal = items.reduce((s, item) => s + (item.quantity * item.unitPrice), 0)
    const gstAmount = items.reduce((s, item) => {
      const itemTotal = item.quantity * item.unitPrice
      return s + (itemTotal * (item.gstRate || 0) / 100)
    }, 0)
    setForm({ ...form, items, subtotal, gstAmount, total: subtotal + gstAmount })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{form.id ? 'Edit Quotation' : 'New Quotation'}</h3>
            <button onClick={onCancel} className="p-1 hover:bg-accent rounded"><X className="h-5 w-5" /></button>
          </div>

          {/* Customer Section */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!showNewCustomer ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={form.customerId || ''}
                      onChange={e => handleCustomerSelect(e.target.value)}
                    >
                      <option value="">Select Customer...</option>
                      {customers.map((c: Customer) => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                      <option value="__new__">+ Add New Customer</option>
                    </select>
                  </div>
                  {form.customerName && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> {form.customerName}</div>
                      {form.customerPhone && <div><span className="text-muted-foreground">Phone:</span> {form.customerPhone}</div>}
                      {form.customerEmail && <div><span className="text-muted-foreground">Email:</span> {form.customerEmail}</div>}
                      {form.customerAddress && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {form.customerAddress}</div>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Add New Customer</span>
                    <button onClick={() => setShowNewCustomer(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Name *" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                    <Input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                    <Input placeholder="GSTIN" value={newCustomer.gstin} onChange={e => setNewCustomer({...newCustomer, gstin: e.target.value})} />
                  </div>
                  <Textarea placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} rows={2} />
                  <Button size="sm" onClick={handleAddNewCustomer} disabled={!newCustomer.name}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Customer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valid Until</label>
              <Input type="date" value={form.validUntil || ''} onChange={e => setForm({...form, validUntil: e.target.value})} />
            </div>
          </div>

          {/* Items Section */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Items</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Add from Stock */}
              <div className="flex gap-2">
                <select
                  className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                >
                  <option value="">Add from Stock...</option>
                  {items.map((i: Item) => (
                    <option key={i.id} value={i.id}>{i.name} (₹{i.sellPrice})</option>
                  ))}
                </select>
                <Input type="number" className="w-20" value={newItemQty} onChange={e => setNewItemQty(parseInt(e.target.value) || 1)} min={1} />
                <Button size="sm" onClick={handleAddItem} disabled={!selectedItemId}><Plus className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={handleAddCustomItem}>Custom</Button>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {form.items?.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input className="flex-1 text-sm" value={item.name} onChange={e => handleUpdateItem(idx, 'name', e.target.value)} placeholder="Item name" />
                      <button onClick={() => handleRemoveItem(idx)} className="p-1.5 hover:bg-red-500/10 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>
                    </div>

                    {/* ===== PRODUCT DESCRIPTION FIELD ===== */}
                    <Textarea
                      className="text-sm resize-none"
                      rows={2}
                      placeholder="Product description / specifications (e.g. Intel i5, 16GB RAM, 512GB SSD...)"
                      value={item.description || ''}
                      onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                    />

                    <div className="grid grid-cols-4 gap-2">
                      <Input type="number" className="text-sm" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 0)} placeholder="Qty" />
                      <Input type="number" className="text-sm" value={item.unitPrice} onChange={e => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="Price" />
                      <Input type="number" className="text-sm" value={item.gstRate || ''} onChange={e => handleUpdateItem(idx, 'gstRate', parseFloat(e.target.value) || 0)} placeholder="GST %" />
                      <Input className="text-sm" value={item.hsnCode || ''} onChange={e => handleUpdateItem(idx, 'hsnCode', e.target.value)} placeholder="HSN" />
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      Line Total: ₹{(item.quantity * item.unitPrice).toLocaleString()}
                      {item.gstRate ? ` + ₹${((item.quantity * item.unitPrice) * item.gstRate / 100).toLocaleString()} GST` : ''}
                    </div>
                  </div>
                ))}
                {(!form.items || form.items.length === 0) && (
                  <div className="text-center text-muted-foreground text-sm py-4">No items added yet</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Subtotal: ₹{form.subtotal?.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">GST: ₹{form.gstAmount?.toLocaleString()}</div>
              <div className="text-xl font-bold">Total: ₹{form.total?.toLocaleString()}</div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-2 gap-3">
            <Textarea placeholder="Notes" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
            <Textarea placeholder="Terms & Conditions" value={form.terms || ''} onChange={e => setForm({...form, terms: e.target.value})} rows={2} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onSave(form)} disabled={saving || !form.customerName || !form.items?.length}>
              {saving ? 'Saving...' : 'Save Quotation'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== QUOTATION PREVIEW =====
function QuotationPreview({ quotation }: { quotation: Quotation }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div>
          <div className="font-bold text-lg">QUOTATION</div>
          <div className="text-sm text-muted-foreground">#{quotation.quotationNumber}</div>
        </div>
        <div className="text-right text-sm">
          <div>Date: {new Date(quotation.date).toLocaleDateString()}</div>
          <div>Valid Until: {quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}</div>
        </div>
      </div>

      <div className="border rounded-lg p-3">
        <div className="font-medium">To:</div>
        <div>{quotation.customerName}</div>
        {quotation.customerPhone && <div className="text-sm text-muted-foreground">{quotation.customerPhone}</div>}
        {quotation.customerEmail && <div className="text-sm text-muted-foreground">{quotation.customerEmail}</div>}
        {quotation.customerAddress && <div className="text-sm text-muted-foreground">{quotation.customerAddress}</div>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">#</th>
            <th className="text-left py-2">Item</th>
            <th className="text-left py-2">Description</th>
            <th className="text-right py-2">Qty</th>
            <th className="text-right py-2">Price</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items?.map((item, idx) => (
            <tr key={idx} className="border-b border-dashed">
              <td className="py-2 text-muted-foreground">{idx + 1}</td>
              <td className="py-2 font-medium">{item.name}</td>
              <td className="py-2 text-muted-foreground text-xs">{item.description || '-'}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">₹{item.unitPrice?.toLocaleString()}</td>
              <td className="py-2 text-right">₹{(item.quantity * item.unitPrice).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="text-right space-y-1 w-48">
          <div className="flex justify-between text-sm"><span>Subtotal:</span><span>₹{quotation.subtotal?.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm"><span>GST:</span><span>₹{quotation.gstAmount?.toLocaleString()}</span></div>
          <div className="flex justify-between font-bold text-lg border-t pt-1"><span>Total:</span><span>₹{quotation.total?.toLocaleString()}</span></div>
        </div>
      </div>

      {quotation.notes && <div className="text-sm"><span className="font-medium">Notes:</span> {quotation.notes}</div>}
      {quotation.terms && <div className="text-sm"><span className="font-medium">Terms:</span> {quotation.terms}</div>}
    </div>
  )
}
