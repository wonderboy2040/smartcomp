'use client'

import { useState, useEffect } from 'react'
import { useFetch, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/calc'
import { Plus, Search, Pencil, Trash2, Users, Phone, Mail } from 'lucide-react'

export function CustomersPanel() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const { data: customers, loading, refetch } = useFetch<any[]>(
    `/api/customers?search=${encodeURIComponent(search)}`,
    undefined
  )

  const handleAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEdit = (c: any) => {
    setEditing(c)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer? Invoices will remain but reference will be lost.')) return
    try {
      await apiDelete(`/api/customers/${id}`)
      toast({ title: 'Customer deleted' })
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage customer database and credit balances</p>
        </div>
        <Button onClick={handleAdd} className="bg-slate-900 hover:bg-slate-800 h-11">
          <Plus className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">Add Customer</span><span className="sm:hidden">Add</span>
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" />
            <Input
              placeholder="Search name, phone, GST..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mobile card layout */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="text-center py-8 text-slate-500">Loading...</CardContent></Card>
        ) : (customers || []).length === 0 ? (
          <Card><CardContent className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No customers found
          </CardContent></Card>
        ) : (
          (customers || []).map((c) => (
            <Card key={c.id} className="border-slate-200">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 text-sm truncate">{c?.name || ""}</p>
                    {c.address && <p className="text-[10px] text-slate-500 truncate">{c.address}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="truncate"><span className="text-slate-500">Ph: </span>{c.phone || '-'}</div>
                  <div className="truncate"><span className="text-slate-500">State: </span>{c.state || '-'}</div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="outline" className="text-[9px]">{c._count?.invoices || 0} invoices</Badge>
                  {c.creditBalance > 0 ? (
                    <span className="text-sm font-semibold text-orange-600">{formatCurrency(c.creditBalance)} due</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">No dues</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop table */}
      <Card className="border-slate-200 hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-center">Invoices</TableHead>
                  <TableHead className="text-right">Credit Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">Loading...</TableCell>
                  </TableRow>
                ) : (customers || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  (customers || []).map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium text-slate-900">{c?.name || ""}</div>
                        {c.address && <div className="text-[10px] text-slate-500 truncate max-w-xs">{c.address}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{c.phone || '-'}</TableCell>
                      <TableCell className="text-sm">{c.email || '-'}</TableCell>
                      <TableCell className="text-sm">{c.state || '-'}</TableCell>
                      <TableCell className="text-xs">{c.gstNumber || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px]">{c._count?.invoices || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.creditBalance > 0 ? (
                          <span className="text-sm font-semibold text-orange-600">{formatCurrency(c.creditBalance)}</span>
                        ) : (
                          <span className="text-sm text-slate-400">{formatCurrency(0)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
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

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false)
          refetch()
        }}
      />
    </div>
  )
}

function CustomerDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: any | null
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
          : { name: '', phone: '', email: '', address: '', gstNumber: '', state: '' }
      )
    }
  }, [open, editing])

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await apiPut(`/api/customers/${editing.id}`, form)
        toast({ title: 'Customer updated' })
      } else {
        await apiPost('/api/customers', form)
        toast({ title: 'Customer added' })
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
      <DialogContent className="sm:max-w-lg max-h-[100dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Name *</Label>
            <Input
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer or business name"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="9876543210"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="customer@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label>State</Label>
            <Input
              value={form.state || ''}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              placeholder="Karnataka"
              className="mt-1"
            />
          </div>
          <div>
            <Label>GSTIN</Label>
            <Input
              value={form.gstNumber || ''}
              onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
              placeholder="29ABCDE1234F1Z5"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address"
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 w-full sm:w-auto">
            {saving ? 'Saving...' : editing ? 'Update' : 'Add Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
