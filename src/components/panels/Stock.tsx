'use client'

import { useState, useEffect } from 'react'
import { useFetch, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/calc'
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react'

export function StockPanel() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const { toast } = useToast()

  const { data: items, loading, refetch } = useFetch<any[]>(
    `/api/items?search=${encodeURIComponent(search)}`,
    undefined
  )
  const { data: suppliers } = useFetch<any[]>('/api/suppliers?active=true', undefined)

  const categories = Array.from(new Set((items || []).map((i) => i.category).filter(Boolean)))

  const filtered = (items || []).filter((i) => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
    if (showLowOnly && i.quantity > i.minQuantity) return false
    return true
  })

  const handleAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEdit = (item: any) => {
    setEditing(item)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return
    try {
      await apiDelete(`/api/items/${id}`)
      toast({ title: 'Item deleted' })
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Stock & Inventory</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage items, GST rates, prices and quantities</p>
        </div>
        <Button onClick={handleAdd} className="bg-slate-900 hover:bg-slate-800 h-11">
          <Plus className="w-4 h-4 mr-1.5" /> Add Item
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" />
              <Input
                placeholder="Search name, SKU, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showLowOnly ? 'default' : 'outline'}
              onClick={() => setShowLowOnly(!showLowOnly)}
              className={`h-11 flex-1 sm:flex-none ${showLowOnly ? 'bg-red-500 hover:bg-red-600' : ''}`}
            >
              <AlertTriangle className="w-4 h-4 sm:mr-1.5" />
              <span className="sm:inline">Low Stock Only</span>
              <span className="sm:hidden">Low Stock</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mobile card layout */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="text-center py-8 text-slate-500">Loading...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No items found. Add your first item.
          </CardContent></Card>
        ) : (
          filtered.map((item) => {
            const lowStock = item.quantity <= item.minQuantity
            return (
              <Card key={item.id} className={`border-slate-200 ${lowStock ? 'border-red-200 bg-red-50/30' : ''}`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm">{item?.name || ""}</p>
                      <p className="text-[10px] text-slate-500">{item.sku}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-slate-500">Cost: </span>
                      <span className="font-medium">{formatCurrency(item.costPrice)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Selling: </span>
                      <span className="font-medium">{formatCurrency(item.sellingPrice)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[9px]">{item.category}</Badge>
                      {item.gstApplicable ? (
                        <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-[9px]">{item.gstRate}%</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">No GST</Badge>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        lowStock
                          ? 'bg-red-50 text-red-700 border-red-200 text-[9px]'
                          : 'bg-green-50 text-green-700 border-green-200 text-[9px]'
                      }
                    >
                      {item.quantity} {item.unit}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Desktop table layout */}
      <Card className="border-slate-200 hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>HSN</TableHead>
                  <TableHead className="text-center">GST</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Selling</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No items found. Add your first item.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => {
                    const lowStock = item.quantity <= item.minQuantity
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{item?.name || ""}</p>
                            <p className="text-xs text-slate-500">{item.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{item.hsnCode || '-'}</TableCell>
                        <TableCell className="text-center">
                          {item.gstApplicable ? (
                            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-[10px]">{item.gstRate}%</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">No GST</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.costPrice)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(item.sellingPrice)}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              lowStock
                                ? 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                                : 'bg-green-50 text-green-700 border-green-200 text-[10px]'
                            }
                          >
                            {item.quantity} {item.unit}
                          </Badge>
                          {lowStock && (
                            <p className="text-[10px] text-red-500 mt-0.5">Min: {item.minQuantity}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{item.supplier?.name || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
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

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        suppliers={suppliers || []}
        onSaved={() => {
          setDialogOpen(false)
          refetch()
        }}
      />
    </div>
  )
}

function ItemDialog({
  open, onOpenChange, editing, suppliers, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: any | null
  suppliers: any[]
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { ...editing }
          : {
              name: '', sku: '', category: 'General', hsnCode: '',
              gstApplicable: true, gstRate: 18,
              costPrice: 0, sellingPrice: 0, quantity: 0, minQuantity: 0,
              unit: 'pcs', supplierId: '',
            }
      )
    }
  }, [open, editing])

  const handleSave = async () => {
    if (!form.name || !form.sku) {
      toast({ title: 'Name and SKU are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await apiPut(`/api/items/${editing.id}`, form)
        toast({ title: 'Item updated' })
      } else {
        await apiPost('/api/items', form)
        toast({ title: 'Item added' })
      }
      onSaved()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Item Name *</Label>
            <Input
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. HP Laptop 15s"
              className="mt-1"
            />
          </div>
          <div>
            <Label>SKU *</Label>
            <Input
              value={form.sku || ''}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. LAP-HP-15S"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Input
              value={form.category || ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Laptop"
            />
          </div>
          <div>
            <Label>HSN Code</Label>
            <Input
              value={form.hsnCode || ''}
              onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
              placeholder="e.g. 8471"
            />
          </div>
          <div>
            <Label>Unit</Label>
            <Input
              value={form.unit || 'pcs'}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="pcs"
            />
          </div>
          <div>
            <Label>Cost Price (Rs.)</Label>
            <Input
              type="number"
              value={form.costPrice || 0}
              onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Selling Price (Rs.)</Label>
            <Input
              type="number"
              value={form.sellingPrice || 0}
              onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Quantity in Stock</Label>
            <Input
              type="number"
              value={form.quantity || 0}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Min Quantity (alert)</Label>
            <Input
              type="number"
              value={form.minQuantity || 0}
              onChange={(e) => setForm({ ...form, minQuantity: Number(e.target.value) })}
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Checkbox
              id="gst"
              checked={form.gstApplicable !== false}
              onCheckedChange={(v) => setForm({ ...form, gstApplicable: v === true })}
            />
            <Label htmlFor="gst" className="cursor-pointer">GST Applicable</Label>
            {form.gstApplicable !== false && (
              <Select
                value={String(form.gstRate ?? 18)}
                onValueChange={(v) => setForm({ ...form, gstRate: Number(v) })}
              >
                <SelectTrigger className="w-24 ml-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="18">18%</SelectItem>
                  <SelectItem value="28">28%</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Supplier</Label>
            <Select
              value={form.supplierId || 'none'}
              onValueChange={(v) => setForm({ ...form, supplierId: v === 'none' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 w-full sm:w-auto">
            {saving ? 'Saving...' : editing ? 'Update Item' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
