'use client'

/**
 * Service WhatsApp Modal — shows 5 pre-built message templates and opens
 * wa.me link in a new tab when clicked. Mirrors the vanilla JS PWA's
 * `showWhatsAppModal()` + `sendWAMsg()` functions.
 *
 * Templates: received / progress / completed / payment / delivered
 */

import { useFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { buildWhatsAppMessage, buildWhatsAppLink, WHATSAPP_TEMPLATES } from '@/lib/whatsapp-templates'
import { X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Props {
  jobId: string
  onClose: () => void
}

export function ServiceWhatsAppModal({ jobId, onClose }: Props) {
  const { toast } = useToast()
  const { data: job } = useFetch<any>(`/api/jobs/${jobId}`, undefined)
  const { data: shop } = useFetch<any>('/api/shop', undefined)
  const [mounted, setMounted] = useState(false)

  // Avoid SSR/hydration mismatch — wa.me links must be built on client only
  useEffect(() => { setMounted(true) }, [])

  if (!job) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-2xl p-8">
          <p className="text-slate-500">Loading job...</p>
        </div>
      </div>
    )
  }

  const bn = shop?.name || 'Smart Computers Sales & Service'

  const sendTemplate = (type: typeof WHATSAPP_TEMPLATES[number]['type']) => {
    if (!mounted) return
    const msg = buildWhatsAppMessage(type, {
      id: job.jobId,
      customerName: job.customerName,
      customerMobile: job.customerMobile,
      deviceType: job.deviceType,
      brandModel: job.brandModel,
      problemDesc: job.problemDesc,
      accessories: job.accessories,
      date: job.date,
      estimatedAmount: Number(job.estimatedAmount) || 0,
      advanceAmount: Number(job.advanceAmount) || 0,
      paidAmount: Number(job.paidAmount) || 0,
      finalAmount: Number(job.finalAmount) || 0,
      serviceCharge: Number(job.serviceCharge) || 0,
      spareParts: (job.partsUsed || []).map((p: any) => ({
        name: p.name,
        qty: Number(p.qty) || 1,
        total: (Number(p.sellPrice || p.price || 0)) * (Number(p.qty) || 1),
      })),
    }, {
      businessName: bn,
      businessMobile: shop?.phone || '',
      businessAddress: shop?.address || '',
      whatsappNumber: shop?.whatsappNumber || '',
      upiId: shop?.upiId || '',
    })
    window.open(buildWhatsAppLink(job.customerMobile, msg), '_blank')
    toast({ title: 'WhatsApp opened', description: `Template: ${type}` })
    onClose()
  }

  const colorClasses: Record<string, { bg: string; hover: string; icon: string }> = {
    blue:   { bg: 'bg-blue-50',   hover: 'hover:bg-blue-100',   icon: 'bg-blue-500'   },
    amber:  { bg: 'bg-amber-50',  hover: 'hover:bg-amber-100',  icon: 'bg-amber-500'  },
    green:  { bg: 'bg-green-50',  hover: 'hover:bg-green-100',  icon: 'bg-green-500'  },
    purple: { bg: 'bg-purple-50', hover: 'hover:bg-purple-100', icon: 'bg-purple-500' },
    gray:   { bg: 'bg-gray-50',   hover: 'hover:bg-gray-100',   icon: 'bg-gray-500'   },
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60] p-4"
      style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-fade">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-800">Send WhatsApp</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">{job.customerName} ({job.customerMobile})</p>
        <div className="space-y-2">
          {WHATSAPP_TEMPLATES.map((t) => {
            const c = colorClasses[t.color]
            return (
              <button
                key={t.type}
                onClick={() => sendTemplate(t.type)}
                className={`w-full p-3 ${c.bg} rounded-xl text-left ${c.hover} flex items-center gap-3 transition`}
              >
                <div className={`w-10 h-10 ${c.icon} rounded-lg flex items-center justify-center`}>
                  <i className={`fas ${t.icon} text-white`}></i>
                </div>
                <div>
                  <p className="font-medium text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-3 bg-gray-100 rounded-xl font-medium text-gray-600 hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  )
}
