'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import {
  Wrench, Clock, CheckCircle2, Package, Phone, MapPin, Mail,
  Laptop, Printer, Monitor, Battery, ScanLine, Smartphone,
  Calendar, Shield, AlertCircle, Loader2, MessageSquare, ArrowRight,
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

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  Pending: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock, label: 'Pending' },
  'In Progress': { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Loader2, label: 'In Progress' },
  Completed: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2, label: 'Ready for Pickup' },
  Delivered: { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Package, label: 'Delivered' },
}

export default function TrackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800">
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    }>
      <TrackInner />
    </Suspense>
  )
}

function TrackInner() {
  // The URL format is /track/SC20260708001-abc12345
  // Next.js dynamic route param "jobId" = "SC20260708001-abc12345"
  const params = useParams()
  const rawJobId = String(params?.jobId || '')

  // Split on the LAST dash to separate jobId from token
  // jobId format: SC20260708001 (no dashes), token format: abc12345 (no dashes)
  const lastDash = rawJobId.lastIndexOf('-')
  const jobId = lastDash > 0 ? rawJobId.slice(0, lastDash) : ''
  const token = lastDash > 0 ? rawJobId.slice(lastDash + 1) : ''

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId || !token) {
      setError('Invalid tracking link')
      setLoading(false)
      return
    }
    fetch(`/api/track?job=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load')
        setData(d)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [jobId, token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800">
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 to-red-800 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-center border border-border">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Tracking Error</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <p className="text-xs text-slate-500 mt-3">Please contact the shop for assistance.</p>
        </div>
      </div>
    )
  }

  const job = data?.job
  const shop = data?.shop
  const statusCfg = STATUS_CONFIG[job?.status] || STATUS_CONFIG.Pending
  const StatusIcon = statusCfg.icon
  const DeviceIcon = DEVICE_ICONS[job?.deviceType] || Smartphone

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-5 h-5" />
            <h1 className="text-lg font-bold">{shop?.name || 'Smart Computers'}</h1>
          </div>
          <p className="text-xs text-blue-100">Repair Tracking</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Job ID + Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Job ID</p>
              <p className="font-mono text-lg font-bold text-slate-900">{job?.jobId}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${statusCfg.bg}`}>
              <StatusIcon className={`w-4 h-4 ${statusCfg.color} ${job?.status === 'In Progress' ? 'animate-spin' : ''}`} />
              <span className={`text-xs font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
            </div>
          </div>

          {/* Device info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <DeviceIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{job?.deviceType}</p>
              {job?.brandModel && <p className="text-xs text-slate-500">{job.brandModel}</p>}
            </div>
          </div>

          {/* Problem */}
          {job?.problemDesc && (
            <div className="mt-3">
              <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Issue Reported</p>
              <p className="text-sm text-slate-700">{job.problemDesc}</p>
            </div>
          )}
        </div>

        {/* Status Timeline */}
        {job?.statusHistory && job.statusHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Status Timeline
            </p>
            <div className="space-y-3">
              {job.statusHistory.map((h: any, i: number) => {
                const cfg = STATUS_CONFIG[h.status] || STATUS_CONFIG.Pending
                const HIcon = cfg.icon
                const isLast = i === job.statusHistory.length - 1
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} border`}>
                        <HIcon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      {!isLast && <div className="w-0.5 h-6 bg-slate-200 mt-1" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-xs text-slate-500">
                        {h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        }) : ''}
                      </p>
                      {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Amount (only if completed/delivered) */}
        {(job?.status === 'Completed' || job?.status === 'Delivered') && Number(job?.finalAmount) > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl shadow-sm border border-emerald-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 font-medium uppercase">Total Amount</p>
                <p className="text-2xl font-bold text-emerald-700">Rs.{job.finalAmount}</p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            {job?.status === 'Completed' && (
              <p className="text-xs text-emerald-600 mt-2">Please collect your device and pay at the shop.</p>
            )}
          </div>
        )}

        {/* Warranty (if delivered) */}
        {job?.status === 'Delivered' && job?.warrantyExpiry && (
          <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-semibold text-blue-900">Warranty Active</p>
            </div>
            <p className="text-xs text-blue-700">
              {job.warrantyDays}-day repair warranty valid until{' '}
              <strong>{new Date(job.warrantyExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
            </p>
          </div>
        )}

        {/* Diagnosis notes (if completed) */}
        {job?.diagnosisNotes && (job?.status === 'Completed' || job?.status === 'Delivered') && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-900 mb-1">Repair Details</p>
            <p className="text-sm text-slate-600">{job.diagnosisNotes}</p>
          </div>
        )}

        {/* Shop contact */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-900 mb-3">Contact Shop</p>
          <div className="space-y-2">
            {shop?.phone && (
              <a href={`tel:${shop.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                <Phone className="w-4 h-4 text-blue-500" /> {shop.phone}
              </a>
            )}
            {shop?.email && (
              <a href={`mailto:${shop.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                <Mail className="w-4 h-4 text-blue-500" /> {shop.email}
              </a>
            )}
            {shop?.address && (
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" /> {shop.address}
              </div>
            )}
          </div>
          {shop?.phone && (
            <a
              href={`https://wa.me/${shop.phone.replace(/\D/g, '').length === 10 ? '91' : ''}${shop.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> Chat on WhatsApp
            </a>
          )}
        </div>

        {/* Estimated completion (if pending/in-progress) */}
        {(job?.status === 'Pending' || job?.status === 'In Progress') && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-xs text-amber-700">
              Your device is being serviced. We'll notify you when it's ready.
            </p>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-500 pt-2 pb-4">
          Powered by {shop?.name || 'Smart Computers'} · Tracking ID: {job?.jobId}
        </p>
      </div>
    </div>
  )
}
