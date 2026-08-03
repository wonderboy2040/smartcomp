'use client'

import { useState, useCallback } from 'react'
import { useFetch, apiPost, apiPut, invalidate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Edit, Trash2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface AMC {
  id: string
  customerName: string
  deviceType?: string
  startDate: string
  endDate: string
  amount: number
  status: 'active' | 'expired' | 'cancelled'
  notes?: string
  visitLog?: string
}

export function AMCPanel() {
  const { data: contracts = [], refresh } = useFetch('/api/amc', undefined, { sheet: 'AMCContracts' })
  const [editing, setEditing] = useState<AMC | null>(null)
  const [saving, setSaving] = useState(false)

  const handleLogVisit = useCallback(async (contract: AMC) => {
    const visitNotes = prompt('Enter visit notes:', '')
    if (visitNotes === null) return

    const newLog = { date: new Date().toISOString(), notes: visitNotes }
    const existingLogs = contract.visitLog ? JSON.parse(contract.visitLog) : []
    const updatedLogs = [...existingLogs, newLog]

    try {
      await apiPut(`/api/amc/${contract.id}`, { ...contract, visitLog: JSON.stringify(updatedLogs) })
      toast.success('Visit logged')
      invalidate('/api/amc')
      refresh()
    } catch (err: any) {
      toast.error('Failed: ' + err.message)
    }
  }, [refresh])

  const handleSave = useCallback(async (contract: AMC) => {
    setSaving(true)
    try {
      if (contract.id) {
        await apiPut(`/api/amc/${contract.id}`, contract)
      } else {
        await apiPost('/api/amc', contract)
      }
      toast.success(contract.id ? 'Updated' : 'Created')
      setEditing(null)
      invalidate('/api/amc')
      refresh()
    } catch (err: any) {
      toast.error('Failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }, [refresh])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">AMC Contracts</h2>
        <Button onClick={() => setEditing({ id: '', customerName: '', startDate: '', endDate: '', amount: 0, status: 'active' })}>
          <Plus className="h-4 w-4 mr-1" /> New AMC
        </Button>
      </div>

      <div className="grid gap-3">
        {contracts.map((c: AMC) => (
          <Card key={c.id} className="group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{c.customerName}</div>
                  <div className="text-sm text-muted-foreground">{c.deviceType || 'Device'}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}</span>
                    <span>₹{c.amount?.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                  <button onClick={() => handleLogVisit(c)} className="p-1.5 hover:bg-green-500/10 rounded-md" title="Log Visit">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </button>
                  <button onClick={() => setEditing(c)} className="p-1.5 hover:bg-accent rounded-md">
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {contracts.length === 0 && <div className="text-center text-muted-foreground py-8">No AMC contracts</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl p-6 w-full max-w-md space-y-3 shadow-2xl">
            <h3 className="text-lg font-semibold">{editing.id ? 'Edit AMC' : 'New AMC'}</h3>
            <Input placeholder="Customer Name" value={editing.customerName} onChange={e => setEditing({...editing, customerName: e.target.value})} />
            <Input placeholder="Device Type" value={editing.deviceType || ''} onChange={e => setEditing({...editing, deviceType: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={editing.startDate?.split('T')[0]} onChange={e => setEditing({...editing, startDate: e.target.value})} />
              <Input type="date" value={editing.endDate?.split('T')[0]} onChange={e => setEditing({...editing, endDate: e.target.value})} />
            </div>
            <Input type="number" placeholder="Amount" value={editing.amount || ''} onChange={e => setEditing({...editing, amount: parseFloat(e.target.value) || 0})} />
            <Input placeholder="General Notes" value={editing.notes || ''} onChange={e => setEditing({...editing, notes: e.target.value})} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => handleSave(editing)} disabled={saving || !editing.customerName}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
