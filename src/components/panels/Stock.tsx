'use client'

import { useState, useCallback, useMemo } from 'react'
import { useFetch, apiPost, apiPut, apiDelete, invalidate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Plus, Minus, Package, AlertTriangle, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface Item {
  id: string
  name: string
  sku?: string
  category?: string
  description?: string
  quantity: number
  costPrice?: number
  sellPrice?: number
  minStock?: number
  hsnCode?: string
  gstRate?: number
}

export function StockPanel() {
  const { data: rawItems, refetch } = useFetch<Item[]>('/api/items', undefined)
  const items = rawItems || []
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Item | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((i: Item) =>
      i.name?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    )
  }, [items, search])

  const lowStock = useMemo(() =>
    filtered.filter((i: Item) => i.minStock && i.quantity <= i.minStock),
    [filtered]
  )

  const quickUpdateStock = useCallback(async (id: string, delta: number) => {
    const item = items.find((i: Item) => i.id === id)
    if (!item) return
    const newQty = Math.max(0, (item.quantity || 0) + delta)
    invalidate('/api/items')
    try {
      await apiPut(`/api/items/${id}`, { ...item, quantity: newQty })
      toast.success(`${delta > 0 ? '+' : ''}${delta} stock updated`)
      refetch()
    } catch (err: any) {
      toast.error('Stock update failed: ' + err.message)
      refetch()
    }
  }, [items, refetch])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this item?')) return
    try {
      await apiDelete(`/api/items/${id}`)
      toast.success('Item deleted')
      refetch()
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    }
  }, [refetch])

  const handleSave = useCallback(async (item: Item) => {
    setSaving(true)
    try {
      if (item.id) {
        await apiPut(`/api/items/${item.id}`, item)
      } else {
        await apiPost('/api/items', item)
      }
      toast.success(item.id ? 'Item updated' : 'Item created')
      setEditing(null)
      refetch()
    } catch (err: any) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }, [refetch])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{items.length}</div><p className="text-xs text-muted-foreground">Total Items</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-amber-500">{lowStock.length}</div><p className="text-xs text-muted-foreground">Low Stock</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{items.reduce((s: number, i: Item) => s + (i.quantity || 0), 0)}</div><p className="text-xs text-muted-foreground">Total Qty</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">₹{items.reduce((s: number, i: Item) => s + ((i.sellPrice || 0) * (i.quantity || 0)), 0).toLocaleString()}</div><p className="text-xs text-muted-foreground">Stock Value</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items, SKU, category, specs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setEditing({ id: '', name: '', description: '', quantity: 0, sellPrice: 0, costPrice: 0 })}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Stock List</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead className="text-center">Quick</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: Item) => {
                  const isExpanded = expandedId === item.id
                  return (
                    <>
                      <TableRow key={item.id} className={item.minStock && item.quantity <= item.minStock ? 'bg-amber-500/10' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="p-0.5 hover:bg-accent rounded"
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.sku || '-'}</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={item.minStock && item.quantity <= item.minStock ? 'text-amber-500 font-bold' : ''}>
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">₹{item.costPrice?.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">₹{item.sellPrice?.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={() => quickUpdateStock(item.id, -10)} className="h-7 w-7 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center text-xs font-bold transition-colors" title="-10">-10</button>
                            <button onClick={() => quickUpdateStock(item.id, -1)} className="h-7 w-7 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center text-xs font-bold transition-colors" title="-1">-1</button>
                            <button onClick={() => quickUpdateStock(item.id, 1)} className="h-7 w-7 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center justify-center text-xs font-bold transition-colors" title="+1">+1</button>
                            <button onClick={() => quickUpdateStock(item.id, 10)} className="h-7 w-7 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center justify-center text-xs font-bold transition-colors" title="+10">+10</button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditing(item)} className="p-1.5 hover:bg-accent rounded-md transition-colors"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-500/10 rounded-md transition-colors"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && item.description && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="py-3">
                            <div className="pl-8">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Product Description / Specifications:</p>
                              <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No items found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? 'Edit Item' : 'New Item'}</DialogTitle></DialogHeader>
            <ItemForm item={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ItemForm({ item, onSave, onCancel, saving }: { item: Item; onSave: (i: Item) => void; onCancel: () => void; saving: boolean }) {
  const [form, setForm] = useState(item)
  return (
    <div className="space-y-3">
      <Input placeholder="Item Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="SKU" value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} />
        <Input placeholder="Category" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Product Description / Specifications</label>
        <Textarea
          placeholder={'e.g. Intel i5 12th Gen, 16GB DDR4 RAM, 512GB NVMe SSD, 15.6\" FHD Display, Windows 11...'}
          value={form.description || ''}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={4}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground mt-1">Add detailed specs. This will appear in quotations too.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
        <Input type="number" placeholder="Cost Price" value={form.costPrice || ''} onChange={e => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} />
        <Input type="number" placeholder="Sell Price" value={form.sellPrice || ''} onChange={e => setForm({ ...form, sellPrice: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input type="number" placeholder="Min Stock Alert" value={form.minStock || ''} onChange={e => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} />
        <Input placeholder="HSN Code" value={form.hsnCode || ''} onChange={e => setForm({ ...form, hsnCode: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.name}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
