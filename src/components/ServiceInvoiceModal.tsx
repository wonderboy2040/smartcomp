'use client'

/**
 * Service Invoice Modal — generates a print-ready invoice for a service job,
 * with UPI QR code for balance payment. Mirrors the vanilla JS PWA's
 * `generateInvoice()` function 1:1.
 *
 * Features:
 *   - Shop header with address / GSTIN (if available)
 *   - Bill-to + Job details boxes
 *   - Itemized table (spare parts + service charge row)
 *   - Totals table: Parts Total, Service, Gross, Advance/Paid, Balance Due
 *   - UPI QR code (auto-generated via api.qrserver.com) — only shown if shop has UPI ID
 *   - Terms + contact footer
 *   - Print / Download PDF / Share on WhatsApp buttons
 */

import { useState } from 'react'
import { useFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/calc'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Printer, FileText, Share2, X, MessageSquare } from 'lucide-react'
import { buildWhatsAppMessage, buildWhatsAppLink } from '@/lib/whatsapp-templates'

interface Props {
  jobId: string
  onClose: () => void
}

export function ServiceInvoiceModal({ jobId, onClose }: Props) {
  const { toast } = useToast()
  const { data: job } = useFetch<any>(`/api/jobs/${jobId}`, undefined)
  const { data: shop } = useFetch<any>('/api/shop', undefined)

  if (!job) {
    return (
      <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl p-8">
          <p className="text-slate-500">Loading job...</p>
        </div>
      </div>
    )
  }

  const bn = shop?.name || 'Smart Computers Sales & Service'
  const tot = Number(job.finalAmount) || Number(job.estimatedAmount) || 0
  const paid = (Number(job.paidAmount) || 0) + (Number(job.advanceAmount) || 0)
  const bal = Math.max(0, tot - paid)
  const pt = (job.partsUsed || []).reduce((s: number, p: any) => s + (Number(p.sellPrice || p.price || 0) * Number(p.qty || 1)), 0)
  const svc = Number(job.serviceCharge) || 0
  const upiId = shop?.upiId || ''
  const qrAmt = bal > 0 ? bal : tot
  const upiUrl = upiId ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(bn)}&am=${qrAmt}&cu=INR&tn=Job-${job.jobId}` : ''
  const qrUrl = upiUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiUrl)}` : ''
  const invDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const jobDate = new Date(job.date || job.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const printInvoice = () => window.print()

  const downloadPDF = () => {
    const w = window.open('', '_blank')
    if (!w) {
      toast({ title: 'Popup blocked', description: 'Allow popups to download PDF', variant: 'destructive' })
      return
    }
    const content = document.getElementById('serviceInvoiceContent')?.innerHTML || ''
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice-${job.jobId}</title><style>@page{size:A4;margin:10mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#fff}</style></head><body>${content}<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();}},500)};<\/script></body></html>`)
    w.document.close()
    toast({ title: 'Save as PDF from print dialog' })
  }

  const shareWhatsApp = () => {
    const msg = buildWhatsAppMessage('completed', {
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
      finalAmount: tot,
      serviceCharge: svc,
      spareParts: (job.partsUsed || []).map((p: any) => ({ name: p.name, qty: p.qty, total: Number(p.sellPrice || p.price || 0) * Number(p.qty || 1) })),
    }, {
      businessName: bn,
      businessMobile: shop?.phone || '',
      businessAddress: shop?.address || '',
      upiId,
    })
    window.open(buildWhatsAppLink(job.customerMobile, msg), '_blank')
  }

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[60] p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div id="serviceInvoiceContent" className="p-4 md:p-6">
          <div className="print-invoice" id="serviceInvoicePrintArea" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '195mm', margin: '0 auto', padding: '8mm', background: '#fff', color: '#000', fontSize: '11px', lineHeight: 1.3 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{bn}</div>
                <div style={{ fontSize: '9px', color: '#333' }}>{shop?.address || 'Computer, Laptop & Printer Service'}</div>
                {shop?.gstNumber && <div style={{ fontSize: '9px', color: '#333' }}>GSTIN: {shop.gstNumber}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, border: '2px solid #000', padding: '4px 12px', display: 'inline-block' }}>SERVICE INVOICE</div>
                <div style={{ fontSize: '10px', marginTop: '4px' }}><strong>INV-{job.jobId}</strong></div>
                <div style={{ fontSize: '10px' }}>{invDate}</div>
              </div>
            </div>

            {/* Bill To + Job Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', gap: '10px' }}>
              <div style={{ flex: 1, padding: '8px', border: '1px solid #000' }}>
                <div style={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '4px' }}>Bill To</div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{job.customerName || 'Walk-in Customer'}</div>
                <div style={{ fontSize: '10px' }}>Mobile: {job.customerMobile || '-'}</div>
              </div>
              <div style={{ flex: 1, padding: '8px', border: '1px solid #000' }}>
                <div style={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '4px' }}>Job Details</div>
                <div style={{ fontSize: '10px' }}><strong>Job #:</strong> {job.jobId}</div>
                <div style={{ fontSize: '10px' }}><strong>Date:</strong> {jobDate}</div>
                <div style={{ fontSize: '10px' }}><strong>Status:</strong> {job.status}</div>
              </div>
            </div>

            {/* Device banner */}
            <div style={{ background: '#f5f5f5', border: '1px solid #000', padding: '8px 10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '12px' }}>{job.deviceType}{job.brandModel ? ' - ' + job.brandModel : ''}</strong>
                <br />
                <span style={{ fontSize: '10px' }}>{job.problemDesc}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {job.priority && <div style={{ border: '1px solid #000', padding: '2px 8px', fontSize: '9px', fontWeight: 700 }}>{job.priority}</div>}
                {job.serviceType && <div style={{ border: '1px solid #000', padding: '2px 8px', fontSize: '9px', fontWeight: 700 }}>{job.serviceType === 'Onsite' ? '🚗 Onsite' : '🏪 In-Shop'}</div>}
              </div>
            </div>

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#000', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: '9px', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ background: '#000', color: '#fff', padding: '6px 8px', textAlign: 'center', fontSize: '9px', width: '50px' }}>Qty</th>
                  <th style={{ background: '#000', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '9px', width: '70px' }}>Rate</th>
                  <th style={{ background: '#000', color: '#fff', padding: '6px 8px', textAlign: 'right', fontSize: '9px', width: '70px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(job.partsUsed || []).length > 0 ? (job.partsUsed || []).map((p: any, i: number) => {
                  const rate = Number(p.sellPrice || p.price || 0)
                  const qty = Number(p.qty || 1)
                  const amount = rate * qty
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '' : '#f9f9f9' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px' }}>{p.name}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px', textAlign: 'center' }}>{qty}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px', textAlign: 'right' }}>Rs.{rate}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px', textAlign: 'right' }}>Rs.{amount}</td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={4} style={{ padding: '6px 8px', textAlign: 'center', color: '#666', borderBottom: '1px solid #ddd', fontSize: '10px' }}>No spare parts used</td></tr>
                )}
                <tr style={{ background: '#eee', fontWeight: 600 }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px' }}>Service & Repair Charge</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px', textAlign: 'center' }}>1</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px', textAlign: 'right' }}>Rs.{svc}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '10px', textAlign: 'right' }}>Rs.{svc}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals + QR */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <tbody>
                    <tr><td style={{ padding: '5px 8px', border: '1px solid #000', width: '60%' }}>Parts Total</td><td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: 600 }}>Rs.{pt}</td></tr>
                    <tr><td style={{ padding: '5px 8px', border: '1px solid #000' }}>Service Charge</td><td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: 600 }}>Rs.{svc}</td></tr>
                    <tr><td style={{ padding: '5px 8px', border: '1px solid #000' }}><strong>Gross Total</strong></td><td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'right' }}><strong>Rs.{tot}</strong></td></tr>
                    <tr><td style={{ padding: '5px 8px', border: '1px solid #000' }}>Advance/Paid</td><td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: 600 }}>- Rs.{paid}</td></tr>
                    <tr><td style={{ padding: '5px 8px', border: '1px solid #000', background: '#000', color: '#fff', fontSize: '12px', fontWeight: 700 }}>BALANCE DUE</td><td style={{ padding: '5px 8px', border: '1px solid #000', background: '#000', color: '#fff', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>{bal > 0 ? 'Rs.' + bal : 'PAID'}</td></tr>
                  </tbody>
                </table>
              </div>
              {qrUrl && (
                <div style={{ width: '100px', textAlign: 'center', padding: '6px', border: '2px solid #000' }}>
                  <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase' }}>{bal > 0 ? 'SCAN TO PAY' : 'PAID'}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="QR" style={{ width: '60px', height: '60px', margin: '3px auto' }} />
                  <div style={{ fontSize: '12px', fontWeight: 700, margin: '3px 0' }}>{bal > 0 ? 'Rs.' + bal : 'Thank You!'}</div>
                  <div style={{ fontSize: '8px' }}>{upiId}</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
              <div style={{ maxWidth: '55%' }}>
                <div style={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Terms</div>
                <div style={{ color: '#333' }}>* Warranty as per company policy ({Number(job.warrantyDays) || 30} days)</div>
                <div style={{ color: '#333' }}>* Collect within 30 days</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 700 }}>Tel: {shop?.phone || ''}</div>
                <div>WhatsApp: {shop?.whatsappNumber || shop?.phone || ''}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px', fontWeight: 600, borderTop: '1px dashed #000', paddingTop: '6px' }}>Thank you for your business!</div>
          </div>
        </div>

        {/* Action buttons (hidden in print) */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex flex-wrap gap-2 no-print">
          <Button onClick={printInvoice} className="flex-1 bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button onClick={downloadPDF} className="flex-1 bg-purple-600 hover:bg-purple-700">
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button onClick={shareWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700">
            <Share2 className="w-4 h-4 mr-1" /> WhatsApp
          </Button>
          <Button onClick={onClose} variant="outline">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
