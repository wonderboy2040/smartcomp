'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiPut, apiDelete } from '@/lib/api'
import { safeJsonParse } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/calc'
import {
  Wrench, Plus, Search, Phone, Laptop, Printer, Monitor, Battery, ScanLine,
  Smartphone, ClipboardList, CheckCircle2, Clock, Package, IndianRupee,
  User, Trash2, Edit3, RefreshCw, Send, Eye, ArrowRight, TrendingUp,
  ExternalLink, Copy
} from 'lucide-react'

const DEVICE_ICONS: Record<string, any> = {
  Laptop: Laptop,
  Desktop: Monitor,
  Printer: Printer,
  Monitor: Monitor,
  UPS: Battery,
  Scanner: ScanLine,
  Other: Smartphone,
}

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Delivered: 'bg-purple-50 text-purple-700 border-purple-200',
}

export function JobsPanel() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailJob, setDetailJob] = useState<any | null>(null)
  const [editing, setEditing] = useState<any | null>(null)

  const { data: jobs, loading, refetch } = useFetch<any[]>('/api/jobs', undefined)

  const filtered = (jobs || []).filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return String(j?.jobId || '').toLowerCase().includes(q) ||
             String(j?.customerName || '').toLowerCase().includes(q) ||
             String(j?.customerMobile || '').includes(q) ||
             String(j?.brandModel || '').toLowerCase().includes(q)
    }
    return true
  })

  const stats = {
    total: (jobs || []).length,
    pending: (jobs || []).filter((j) => j.status === 'Pending').length,
    progress: (jobs || []).filter((j) => j.status === 'In Progress').length,
    completed: (jobs || []).filter((j) => j.status === 'Completed').length,
    delivered: (jobs || []).filter((j) => j.status === 'Delivered').length,
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job? Job record will be soft-deleted (data safe in Sheets).')) return
    try {
      await apiDelete(`/api/jobs/${id}`)
      toast({ title: 'Job deleted' })
      refetch()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
            <span className="truncate">Service Jobs</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage computer/laptop/printer repair jobs with engineer tracking and profit sharing
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="bg-blue-600 hover:bg-blue-700 h-11">
          <Plus className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">New Job</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-600 uppercase">Total</span>
              <ClipboardList className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-600 uppercase">Pending</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-600 uppercase">In Progress</span>
              <RefreshCw className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{stats.progress}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-600 uppercase">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-emerald-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-600 uppercase">Delivered</span>
              <Package className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-purple-600">{stats.delivered}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-3 text-slate-400" />
          <Input
            placeholder="Search job ID, customer, mobile, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 h-11">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="text-center py-8 text-slate-500">Loading...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-slate-500">
            <Wrench className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            No jobs yet. Tap "New" to create one.
          </CardContent></Card>
        ) : (
          filtered.map((j) => {
            const Icon = DEVICE_ICONS[j.deviceType] || Smartphone
            return (
              <Card key={j.id} className="border-slate-200">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{j.customerName || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{j.jobId}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${STATUS_COLORS[j.status] || ''} text-[9px] flex-shrink-0`}>
                      {j.status}
                    </Badge>
                  </div>
                  <div className="text-xs space-y-0.5 text-slate-600">
                    <p className="truncate"><span className="font-medium">{j.deviceType}</span>{j.brandModel ? ` · ${j.brandModel}` : ''}</p>
                    <p className="truncate text-slate-500">{j.problemDesc}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(j.finalAmount || j.estimatedAmount)}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setDetailJob(j)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { setEditing(j); setDialogOpen(true) }}>
                        <Edit3 className="w-3.5 h-3.5" />
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
                  <TableHead>Job ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
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
                      <Wrench className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No jobs found. Click "New Job" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((j) => {
                    const Icon = DEVICE_ICONS[j.deviceType] || Smartphone
                    return (
                      <TableRow key={j.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDetailJob(j)}>
                        <TableCell className="font-mono text-xs font-medium">{j.jobId}</TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{j.customerName || 'Unknown'}</div>
                          <div className="text-[10px] text-slate-500">{j.customerMobile}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm">{j.deviceType}</span>
                          </div>
                          <div className="text-[10px] text-slate-500">{j.brandModel}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">{j.problemDesc}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${STATUS_COLORS[j.status] || ''} text-[10px]`}>
                            {j.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(j.finalAmount || j.estimatedAmount)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setDetailJob(j)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => { setEditing(j); setDialogOpen(true) }}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDelete(j.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* New/Edit Job Dialog */}
      {dialogOpen && (
        <NewJobDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSaved={() => { setDialogOpen(false); refetch() }}
        />
      )}

      {/* Job Detail Dialog */}
      {detailJob && (
        <JobDetailDialog
          job={detailJob}
          onClose={() => setDetailJob(null)}
          onUpdated={() => { refetch(); setDetailJob(null) }}
        />
      )}
    </div>
  )
}

// ===== New Job Dialog =====
function NewJobDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: any | null
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    customerName: editing?.customerName || '',
    customerMobile: editing?.customerMobile || '',
    deviceType: editing?.deviceType || 'Laptop',
    brandModel: editing?.brandModel || '',
    serialNumber: editing?.serialNumber || '',
    problemDesc: editing?.problemDesc || '',
    accessories: editing?.accessories || '',
    estimatedAmount: editing?.estimatedAmount || 0,
    advanceAmount: editing?.advanceAmount || 0,
    advanceMode: editing?.advanceMode || 'Cash',
    assignedEngineer: editing?.assignedEngineer || '',
    notes: editing?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.customerName || !form.customerMobile || !form.problemDesc) {
      toast({ title: 'Customer name, mobile, and problem description are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await apiPut(`/api/jobs/${editing.id}`, { action: 'update', ...form })
        toast({ title: 'Job updated' })
      } else {
        await apiPost('/api/jobs', form)
        toast({ title: 'Job created', description: `Job ID: will be generated` })
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
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            {editing ? 'Edit Job' : 'New Service Job'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Customer Name *</Label>
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Enter name" className="h-10" />
            </div>
            <div>
              <Label className="text-xs">Mobile *</Label>
              <Input value={form.customerMobile} onChange={(e) => setForm({ ...form, customerMobile: e.target.value })} placeholder="10-digit number" className="h-10" inputMode="tel" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Device Type *</Label>
              <Select value={form.deviceType} onValueChange={(v) => setForm({ ...form, deviceType: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Laptop">💻 Laptop</SelectItem>
                  <SelectItem value="Desktop">🖥️ Desktop</SelectItem>
                  <SelectItem value="Printer">🖨️ Printer</SelectItem>
                  <SelectItem value="Monitor">🖵 Monitor</SelectItem>
                  <SelectItem value="UPS">🔋 UPS</SelectItem>
                  <SelectItem value="Scanner">📠 Scanner</SelectItem>
                  <SelectItem value="Other">📱 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Brand / Model</Label>
              <Input value={form.brandModel} onChange={(e) => setForm({ ...form, brandModel: e.target.value })} placeholder="e.g., HP Pavilion" className="h-10" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Serial Number</Label>
            <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Device serial number" className="h-10" />
          </div>
          <div>
            <Label className="text-xs">Problem Description *</Label>
            <Textarea value={form.problemDesc} onChange={(e) => setForm({ ...form, problemDesc: e.target.value })} placeholder="Describe the issue..." rows={3} />
          </div>
          <div>
            <Label className="text-xs">Accessories Received</Label>
            <Input value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} placeholder="e.g., Charger, Battery, Mouse" className="h-10" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Estimated (Rs.)</Label>
              <Input type="number" value={form.estimatedAmount} onChange={(e) => setForm({ ...form, estimatedAmount: Number(e.target.value) })} className="h-10" />
            </div>
            <div>
              <Label className="text-xs">Advance (Rs.)</Label>
              <Input type="number" value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: Number(e.target.value) })} className="h-10" />
            </div>
            <div>
              <Label className="text-xs">Advance Mode</Label>
              <Select value={form.advanceMode} onValueChange={(v) => setForm({ ...form, advanceMode: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Assigned Engineer</Label>
            <Input value={form.assignedEngineer} onChange={(e) => setForm({ ...form, assignedEngineer: e.target.value })} placeholder="Engineer name (optional)" className="h-10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : (editing ? 'Update Job' : 'Create Job')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Job Detail Dialog =====
function JobDetailDialog({ job, onClose, onUpdated }: {
  job: any
  onClose: () => void
  onUpdated: () => void
}) {
  const { toast } = useToast()
  const [status, setStatus] = useState(job?.status || 'Pending')
  const [partsUsed, setPartsUsed] = useState<any[]>(safeJsonParse<any[]>(job?.partsUsedJson, []))
  const [finalAmount, setFinalAmount] = useState(Number(job?.finalAmount) || 0)
  const [paymentMode, setPaymentMode] = useState(job?.paymentMode || 'Cash')
  const [engineerSharePct, setEngineerSharePct] = useState(50)
  const [newPart, setNewPart] = useState({ name: '', costPrice: 0, sellPrice: 0, qty: 1 })
  const [saving, setSaving] = useState(false)
  const [showComplete, setShowComplete] = useState(false)

  const partsTotalCost = partsUsed.reduce((s, p) => s + (Number(p.costPrice) || 0) * (Number(p.qty) || 1), 0)
  const partsTotalSell = partsUsed.reduce((s, p) => s + (Number(p.sellPrice) || 0) * (Number(p.qty) || 1), 0)
  const partsProfit = partsTotalSell - partsTotalCost

  const handleUpdateStatus = async () => {
    setSaving(true)
    try {
      await apiPut(`/api/jobs/${job.id}`, { action: 'updateStatus', status, assignedEngineer: job.assignedEngineer })
      toast({ title: 'Status updated', description: `Job is now ${status}` })
      onUpdated()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddPart = () => {
    if (!newPart.name) return
    setPartsUsed([...partsUsed, { ...newPart }])
    setNewPart({ name: '', costPrice: 0, sellPrice: 0, qty: 1 })
  }

  const handleRemovePart = (i: number) => {
    setPartsUsed(partsUsed.filter((_, idx) => idx !== i))
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      await apiPut(`/api/jobs/${job.id}`, {
        action: 'complete',
        partsUsed,
        finalAmount,
        paymentMode,
        engineerSharePct,
      })
      toast({ title: 'Job completed!', description: 'Profit shares calculated and payment recorded' })
      onUpdated()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeliver = async () => {
    if (!confirm('Mark this job as Delivered?')) return
    setSaving(true)
    try {
      await apiPut(`/api/jobs/${job.id}`, { action: 'deliver' })
      toast({ title: 'Job delivered' })
      onUpdated()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const Icon = DEVICE_ICONS[job.deviceType] || Smartphone

  return (
    <Dialog open={!!job} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-blue-600" />
            <span className="font-mono text-sm">{job.jobId}</span>
            <Badge variant="outline" className={`${STATUS_COLORS[job.status] || ''} text-[10px]`}>{job.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer + Device info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Customer</p>
              <p className="font-medium">{job.customerName}</p>
              <p className="text-xs text-slate-600">{job.customerMobile}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Device</p>
              <p className="font-medium">{job.deviceType}</p>
              <p className="text-xs text-slate-600">{job.brandModel}</p>
              {job.serialNumber && <p className="text-[10px] text-slate-400">S/N: {job.serialNumber}</p>}
            </div>
          </div>

          {/* Problem */}
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <p className="text-xs font-medium text-amber-700 mb-1">Problem Description</p>
            <p className="text-sm text-slate-800">{job.problemDesc}</p>
            {job.accessories && <p className="text-xs text-slate-500 mt-1">Accessories: {job.accessories}</p>}
          </div>

          {/* Tracking Link */}
          {job.trackUrl && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Customer Tracking Link
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white px-2 py-1.5 rounded border border-blue-200 truncate">
                  {typeof window !== 'undefined' ? window.location.origin + job.trackUrl : job.trackUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 flex-shrink-0"
                  onClick={() => {
                    const fullUrl = (typeof window !== 'undefined' ? window.location.origin : '') + job.trackUrl
                    navigator.clipboard.writeText(fullUrl)
                    toast({ title: 'Link copied!', description: 'Share with customer via WhatsApp/SMS' })
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <a
                  href={`https://wa.me/${String(job.customerMobile || '').replace(/\D/g, '').length === 10 ? '91' : ''}${String(job.customerMobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${job.customerName}, track your repair here: ${(typeof window !== 'undefined' ? window.location.origin : '') + job.trackUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium flex-shrink-0"
                >
                  <Send className="w-3 h-3" /> Share
                </a>
              </div>
              <p className="text-[10px] text-blue-600 mt-1">Send this link to customer — they can track repair status online</p>
            </div>
          )}

          {/* Status update */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs">Update Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateStatus} disabled={saving || status === job.status} className="bg-blue-600 hover:bg-blue-700 h-10">
              Update Status
            </Button>
            {job.status === 'Completed' && (
              <Button onClick={handleDeliver} disabled={saving} className="bg-purple-600 hover:bg-purple-700 h-10">
                <Package className="w-4 h-4 mr-1" /> Mark Delivered
              </Button>
            )}
          </div>

          {/* Parts used */}
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Parts Used</Label>
              <div className="text-xs text-slate-500">
                Cost: Rs.{partsTotalCost} · Sell: Rs.{partsTotalSell} · Profit: <span className="font-semibold text-emerald-600">Rs.{partsProfit}</span>
              </div>
            </div>
            {partsUsed.length > 0 && (
              <div className="space-y-1 mb-3">
                {partsUsed.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded">
                    <span className="flex-1 font-medium">{p.name}</span>
                    <span>Qty: {p.qty}</span>
                    <span>Cost: Rs.{p.costPrice}</span>
                    <span>Sell: Rs.{p.sellPrice}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => handleRemovePart(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-5 gap-2">
              <Input placeholder="Part name" value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} className="h-9 text-xs col-span-2" />
              <Input type="number" placeholder="Cost" value={newPart.costPrice} onChange={(e) => setNewPart({ ...newPart, costPrice: Number(e.target.value) })} className="h-9 text-xs" />
              <Input type="number" placeholder="Sell" value={newPart.sellPrice} onChange={(e) => setNewPart({ ...newPart, sellPrice: Number(e.target.value) })} className="h-9 text-xs" />
              <Button size="sm" onClick={handleAddPart} className="h-9"><Plus className="w-3 h-3" /></Button>
            </div>
          </div>

          {/* Complete job */}
          {job.status !== 'Completed' && job.status !== 'Delivered' && (
            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-blue-900">Complete Job</Label>
                <Button size="sm" variant="ghost" onClick={() => setShowComplete(!showComplete)} className="text-blue-700 text-xs">
                  {showComplete ? 'Hide' : 'Show'}
                </Button>
              </div>
              {showComplete && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-blue-700">Final Amount (Rs.)</Label>
                      <Input type="number" value={finalAmount} onChange={(e) => setFinalAmount(Number(e.target.value))} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-blue-700">Payment Mode</Label>
                      <Select value={paymentMode} onValueChange={setPaymentMode}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-blue-700">Engineer Share %</Label>
                      <Input type="number" value={engineerSharePct} onChange={(e) => setEngineerSharePct(Number(e.target.value))} min={0} max={100} className="h-9 text-sm" />
                    </div>
                  </div>
                  <Button onClick={handleComplete} disabled={saving || finalAmount <= 0} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Completing...</> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Complete Job & Calculate Profit</>}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Profit summary (if completed) */}
          {(job.status === 'Completed' || job.status === 'Delivered') && Number(job.engineerShare) > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center">
                <p className="text-[10px] text-slate-600">Service Profit</p>
                <p className="font-bold text-emerald-700">Rs.{job.serviceProfit || 0}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg text-center">
                <p className="text-[10px] text-slate-600">Engineer Share</p>
                <p className="font-bold text-blue-700">Rs.{job.engineerShare || 0}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-2 rounded-lg text-center">
                <p className="text-[10px] text-slate-600">Admin Share</p>
                <p className="font-bold text-purple-700">Rs.{job.adminShare || 0}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
