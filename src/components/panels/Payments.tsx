'use client'

import { useState, useCallback, useMemo } from 'react'
import { useFetch, apiPost, apiDelete, invalidate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Trash2, Wallet, IndianRupee } from 'lucide-react'
import { toast } from 'sonner'

interface Payment {
  id: string
  invoiceId?: string
  customerName: string
  amount: number
  method?: string
  date?: string
  notes?: string
}

export function PaymentsPanel() {
  const { data: rawPayments, refetch } = useFetch<Payment[]>('/api/payments', undefined)
  const payments = rawPayments || []
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<Partial<Payment>>({
    customerName: '', amount: 0, method: 'cash', notes: ''
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return payments
    const q = search.toLowerCase()
    return payments.filter((p: Payment) =>
      p.customerName?.toLowerCase().includes(q) ||
      p.invoiceId?.toLowerCase().includes(q)
    )
  }, [payments, search])

  const total = useMemo(() => payments.reduce((s: number, p: Payment) => s + (p.amount || 0), 0), [payments])

  const handleSave = useCallback(async () => {
    if (saving) return
    if (!form.customerName || !form.amount) {
      toast.error('Customer name and amount required')
      return
    }
    setSaving(true)
    try {
      await apiPost('/api/payments', form)
      toast.success('Payment recorded')
      setShowForm(false)
      setForm({ customerName: '', amount: 0, method: 'cash', notes: '' })
      invalidate('/api/payments')
      refetch()
    } catch (err: any) {
      toast.error('Failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }, [form, saving, refetch])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this payment?')) return
    try {
      await apiDelete(`/api/payments/${id}`)
      toast.success('Deleted')
      invalidate('/api/payments')
      refetch()
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message)
    }
  }, [refetch])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{payments.length}</div><p className="text-xs text-muted-foreground">Total Payments</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-500">₹{total.toLocaleString()}</div><p className="text-xs text-muted-foreground">Total Collected</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search payments..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Record</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Payments</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: Payment) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.customerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.invoiceId || '-'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.method || 'cash'}</Badge></TableCell>
                    <TableCell className="text-right font-mono font-medium">₹{p.amount?.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.date ? new Date(p.date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-500/10 rounded-md"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl p-6 w-full max-w-md space-y-3 shadow-2xl">
            <h3 className="text-lg font-semibold">Record Payment</h3>
            <Input placeholder="Customer Name *" value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Amount *" value={form.amount || ''} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} />
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.method} onChange={e => setForm({...form, method: e.target.value})}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <Input placeholder="Notes" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.customerName || !form.amount}>
                {saving ? 'Saving...' : 'Save Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
