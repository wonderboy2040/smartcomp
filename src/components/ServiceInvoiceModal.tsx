'use client'

/**
 * Service Invoice Modal - UPGRADED v3.0.3
 * 
 * FIXES:
 * - Now matches Invoices & Quotations design exactly (Tally templates)
 * - 5 premium templates: Tally Classic, Modern, Corporate, Elegant, Bold
 * - Same header with shop GSTIN, same table design, same totals with Grand Total highlight
 * - Amount in words, UPI QR, terms, signature, footer - all same as regular invoices
 * - Download PDF via new /api/service-pdf/[id] endpoint using same PDF engine
 * - Print optimized with same styling
 * 
 * BEFORE: Simple black/white table with basic totals
 * AFTER: Professional GST invoice matching regular invoices
 */

import { useState } from 'react'
import { useFetch } from '@/lib/api'
import { formatCurrency, numberToWords } from '@/lib/calc'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Printer, FileText, Share2, X, Download, Eye } from 'lucide-react'
import { PDF_TEMPLATES, AD_BANNER_VARIANTS } from '@/lib/pdf'

interface Props {
  jobId: string
  onClose: () => void
}

export function ServiceInvoiceModal({ jobId, onClose }: Props) {
  const { toast } = useToast()
  const [selectedTemplate, setSelectedTemplate] = useState('tally-classic')
  const [bannerStyle, setBannerStyle] = useState('grid')
  
  const { data: job } = useFetch<any>(`/api/jobs/${jobId}`, undefined)
  const { data: shop } = useFetch<any>('/api/shop', undefined)

  if (!job) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <p className="text-slate-600">Loading job {jobId}...</p>
        </div>
      </div>
    )
  }

  const template = PDF_TEMPLATES.find(t => t.id === selectedTemplate) || PDF_TEMPLATES[0]
  const bn = shop?.name || 'Smart Computers Sales & Service'
  const tot = Number(job.finalAmount) || Number(job.estimatedAmount) || 0
  const paid = (Number(job.paidAmount) || 0) + (Number(job.advanceAmount) || 0)
  const bal = Math.max(0, tot - paid)
  const parts = job.partsUsed || []
  const pt = parts.reduce((s: number, p: any) => s + (Number(p.sellPrice || p.price || 0) * Number(p.qty || 1)), 0)
  const svc = Number(job.serviceCharge) || 0
  const invDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const jobDate = new Date(job.createdAt || job.date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const printInvoice = () => window.print()

  const downloadPDF = () => {
    const url = `/api/service-pdf/${jobId}?template=${selectedTemplate}&banner=${bannerStyle}`
    window.open(url, '_blank')
    toast({ title: 'PDF opening...', description: 'Save from browser print dialog or download' })
  }

  const shareWhatsApp = () => {
    const msg = `🔧 *Service Invoice - ${bn}*\n\n` +
      `*Invoice:* INV-${job.jobId}\n` +
      `*Date:* ${invDate}\n` +
      `*Customer:* ${job.customerName}\n` +
      `*Device:* ${job.deviceType} ${job.brandModel ? '- ' + job.brandModel : ''}\n` +
      `*Problem:* ${job.problemDesc}\n\n` +
      `*Parts:*\n${parts.map((p: any) => `• ${p.name} x${p.qty} = Rs.${Number(p.sellPrice || 0) * Number(p.qty || 1)}`).join('\n') || 'No parts'}\n` +
      `• Service Charge = Rs.${svc}\n\n` +
      `*Total:* Rs.${tot}\n` +
      `*Paid:* Rs.${paid}\n` +
      `*Balance Due:* Rs.${bal}\n\n` +
      `Thank you for your business!\n${bn} - ${shop?.phone || ''}`
    
    const phone = String(job.customerMobile || '').replace(/\D/g, '')
    const waPhone = phone.length === 10 ? `91${phone}` : phone
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const headerBg = `rgb(${template.headerBg.join(',')})`
  const headerText = `rgb(${template.headerText.join(',')})`
  const accent = `rgb(${template.accent.join(',')})`
  const tableHead = `rgb(${template.tableHead.join(',')})`

  const AD_IMGS = [
    { src: '/posters/gaming-pc.webp', label: 'Computers' },
    { src: '/posters/laptop-sale.webp', label: 'Laptops' },
    { src: '/posters/printer-offer.webp', label: 'Printers' },
    { src: '/posters/accessories.webp', label: 'Accessories' },
  ]
  const renderAdBanner = (style: string) => {
    // Full-width "merged" band: spans the content width (no side margins) so
    // it reads as one continuous advertising strip — exactly like the jsPDF
    // engine's placeCover(). Images use object-fit: cover to fill the box.
    const fullBleed = { marginLeft: '-20px', marginRight: '-20px' }
    const caption = (
      <>
        <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, color: accent, marginTop: '7px', letterSpacing: '0.4px' }}>
          CHECK OUT OUR LATEST OFFERS!
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
          {shop?.phone ? `Call ${shop.phone}  •  Computers • Laptops • Printers • Accessories` : 'Computers • Laptops • Printers • Accessories'}
        </div>
      </>
    )
    if (style === 'flyer' || style === 'grid') {
      const poster = style === 'flyer'
        ? '/posters/smartcomputers-a4-flyer-landscape.webp'
        : '/posters/smartcomputers-product-grid.webp'
      return (
        <div style={{ ...fullBleed, marginTop: '22px' }}>
          <div style={{ borderTop: `3px solid ${accent}`, borderBottom: `3px solid ${accent}`, background: '#fff', lineHeight: 0 }}>
            <img src={poster} alt="Smart Computers latest offers" style={{ width: '100%', height: 'auto', aspectRatio: '1000 / 285', objectFit: 'contain', display: 'block', borderRadius: '4px' }} />
          </div>
          {caption}
        </div>
      )
    }
    if (style === 'featured') {
      return (
        <div style={{ ...fullBleed, marginTop: '22px', padding: '12px 14px', borderTop: `3px solid ${accent}`, borderBottom: `3px solid ${accent}`, background: `linear-gradient(135deg, ${accent}08, ${accent}15)` }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flexShrink: 0, width: '150px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: accent, lineHeight: 1.05 }}>WE<br />ALSO<br />SUPPLY</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', fontWeight: 600 }}>{bn}</div>
              {shop?.phone && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Call: {shop.phone}</div>}
            </div>
            <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
              {AD_IMGS.map((p) => (
                <div key={p.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ background: '#fff', border: `1px solid ${accent}40`, borderRadius: '8px', padding: '4px', height: '84px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={p.src} alt={p.label} style={{ maxHeight: '74px', maxWidth: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{p.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    // strip
    return (
      <div style={{ ...fullBleed, marginTop: '22px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', borderTop: `3px solid ${accent}`, borderBottom: `3px solid ${accent}`, background: `linear-gradient(135deg, ${accent}08, ${accent}15)` }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: accent, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>We Also Supply</div>
        <div style={{ display: 'flex', gap: '16px', flex: 1, justifyContent: 'space-between' }}>
          {AD_IMGS.map((p) => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src={p.src} alt={p.label} style={{ height: '34px', width: '34px', objectFit: 'contain' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{p.label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 800, color: accent, whiteSpace: 'nowrap' }}>{shop?.phone ? `Call: ${shop.phone}` : bn}</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden my-2">
        
        {/* Template Selector - No Print */}
        <div className="no-print bg-slate-50 border-b p-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700">Template:</span>
            <div className="flex gap-1.5">
              {PDF_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border-2 ${
                    selectedTemplate === tpl.id 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' 
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                  title={tpl.description}
                >
                  {tpl.name}
                </button>
              ))}
            </div>
            <span className="text-xs font-medium text-slate-700 ml-2">Banner:</span>
            <div className="flex gap-1.5">
              {AD_BANNER_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setBannerStyle(v.id)}
                  title={v.description}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all border-2 ${
                    bannerStyle === v.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={printInvoice} className="h-8 text-xs">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" onClick={downloadPDF} className="h-8 text-xs bg-purple-600 hover:bg-purple-700">
              <Download className="w-3.5 h-3.5 mr-1" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Invoice Content - Same design as regular invoices */}
        <div className="flex-1 overflow-y-auto p-0">
          <div id="serviceInvoiceContent" className="print-paper">
            <div className="print-invoice" style={{ fontFamily: 'Inter, Arial, sans-serif', maxWidth: '210mm', margin: '0 auto', background: '#fff', color: '#000' }}>
              
              {/* Header - Same as regular invoice */}
              <div style={{ background: headerBg, padding: '16px 20px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: headerText, letterSpacing: '-0.5px' }}>{bn}</div>
                    <div style={{ fontSize: '11px', color: headerBg.startsWith('rgb(255') ? '#4b5563' : '#d1d5db', marginTop: '4px', maxWidth: '300px' }}>
                      {shop?.address || 'Computer, Laptop & Printer Service Center'}
                      {shop?.state ? `, ${shop.state}` : ''}
                    </div>
                    {(shop?.phone || shop?.email) && (
                      <div style={{ fontSize: '10px', color: headerBg.startsWith('rgb(255') ? '#6b7280' : '#9ca3af', marginTop: '2px' }}>
                        {shop?.phone ? `${shop.phone}` : ''}{shop?.phone && shop?.email ? ' | ' : ''}{shop?.email || ''}
                      </div>
                    )}
                    {shop?.gstNumber && (
                      <div style={{ fontSize: '10px', color: headerBg.startsWith('rgb(255') ? '#6b7280' : '#9ca3af', marginTop: '2px', fontWeight: 600 }}>
                        GSTIN: {shop.gstNumber}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 800, 
                      color: accent,
                      border: `2px solid ${accent}`,
                      padding: '6px 16px',
                      borderRadius: '6px',
                      background: headerBg.startsWith('rgb(255') ? '#fff' : 'rgba(255,255,255,0.1)',
                      display: 'inline-block'
                    }}>
                      SERVICE INVOICE
                    </div>
                    <div style={{ fontSize: '11px', color: headerBg.startsWith('rgb(255') ? '#374151' : '#e5e7eb', marginTop: '8px', fontWeight: 600 }}>
                      INV-{job.jobId}
                    </div>
                    <div style={{ fontSize: '10px', color: headerBg.startsWith('rgb(255') ? '#6b7280' : '#9ca3af', marginTop: '2px' }}>
                      Date: {invDate}
                    </div>
                    <div style={{ fontSize: '10px', color: headerBg.startsWith('rgb(255') ? '#6b7280' : '#9ca3af' }}>
                      Job Date: {jobDate}
                    </div>
                  </div>
                </div>
                {/* Accent strip */}
                <div style={{ height: '3px', background: accent, marginTop: '12px', borderRadius: '2px' }} />
              </div>

              <div style={{ padding: '16px 20px' }}>
                {/* Bill To + Job Details - Same as regular */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: accent, borderBottom: `1px solid ${accent}30`, paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>Bill To</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{job.customerName || 'Walk-in Customer'}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>Mobile: {job.customerMobile || '-'}</div>
                    {job.customerName && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{job.customerName}</div>}
                  </div>
                  <div style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: accent, borderBottom: `1px solid ${accent}30`, paddingBottom: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>Job Details</div>
                    <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.5' }}>
                      <div><strong>Job #:</strong> {job.jobId}</div>
                      <div><strong>Device:</strong> {job.deviceType} {job.brandModel ? `- ${job.brandModel}` : ''}</div>
                      <div><strong>Status:</strong> <span style={{ 
                        background: job.status === 'Completed' ? '#ecfdf5' : job.status === 'Pending' ? '#fffbeb' : '#eff6ff',
                        color: job.status === 'Completed' ? '#065f46' : job.status === 'Pending' ? '#92400e' : '#1e40af',
                        padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600
                      }}>{job.status}</span></div>
                      {job.priority && <div><strong>Priority:</strong> {job.priority}</div>}
                      {job.serviceType && <div><strong>Service:</strong> {job.serviceType === 'Onsite' ? '🚗 Onsite' : '🏪 In-Shop'}</div>}
                    </div>
                  </div>
                </div>

                {/* Device banner - Enhanced */}
                <div style={{ 
                  background: `linear-gradient(135deg, ${accent}08, ${accent}15)`, 
                  border: `1px solid ${accent}30`, 
                  borderLeft: `4px solid ${accent}`,
                  padding: '10px 14px', 
                  marginBottom: '16px', 
                  borderRadius: '8px',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      {job.deviceType}{job.brandModel ? ` - ${job.brandModel}` : ''} {job.serialNumber ? `(S/N: ${job.serialNumber})` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>{job.problemDesc}</div>
                    {job.accessories && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>Accessories: {job.accessories}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {job.priority && (
                      <div style={{ 
                        background: job.priority === 'High' ? '#fef2f2' : job.priority === 'Medium' ? '#fffbeb' : '#f0fdf4',
                        color: job.priority === 'High' ? '#991b1b' : job.priority === 'Medium' ? '#92400e' : '#065f46',
                        border: `1px solid ${job.priority === 'High' ? '#fecaca' : job.priority === 'Medium' ? '#fde68a' : '#a7f3d0'}`,
                        padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 700
                      }}>
                        {job.priority === 'High' ? '🔴' : job.priority === 'Medium' ? '🟡' : '🟢'} {job.priority} Priority
                      </div>
                    )}
                  </div>
                </div>

                {/* Items table - Same design as regular invoices */}
                <div style={{ marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ background: tableHead, color: '#fff', padding: '10px 12px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', width: '40px' }}>#</th>
                        <th style={{ background: tableHead, color: '#fff', padding: '10px 12px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Item Description</th>
                        <th style={{ background: tableHead, color: '#fff', padding: '10px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, width: '60px' }}>Qty</th>
                        <th style={{ background: tableHead, color: '#fff', padding: '10px 12px', textAlign: 'right', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, width: '90px' }}>Rate</th>
                        <th style={{ background: tableHead, color: '#fff', padding: '10px 12px', textAlign: 'right', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, width: '100px' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.length > 0 ? parts.map((p: any, i: number) => {
                        const rate = Number(p.sellPrice || p.price || p.costPrice || 0)
                        const qty = Number(p.qty || 1)
                        const amount = rate * qty
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{p.name}</div>
                              {p.sku && <div style={{ fontSize: '10px', color: '#6b7280' }}>{p.sku}</div>}
                              {p.itemId && <div style={{ fontSize: '9px', color: '#9ca3af' }}>Stock ID: {p.itemId.slice(0,8)}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', textAlign: 'center', color: '#374151' }}>{qty}</td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', textAlign: 'right', color: '#374151' }}>Rs.{rate.toFixed(2)}</td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>Rs.{amount.toFixed(2)}</td>
                          </tr>
                        )
                      }) : (
                        <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>No spare parts used - Service only</td></tr>
                      )}
                      <tr style={{ background: '#f8fafc', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px' }}></td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                          Service & Repair Charge
                          <div style={{ fontSize: '10px', fontWeight: 400, color: '#6b7280' }}>{job.serviceType || 'Service'}</div>
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', textAlign: 'center' }}>1</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', textAlign: 'right' }}>Rs.{svc.toFixed(2)}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', textAlign: 'right', fontWeight: 700 }}>Rs.{svc.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Totals - Same as regular invoice with Grand Total highlight */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    {/* Amount in words - Same as regular */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px', marginBottom: '6px' }}>Amount in Words</div>
                      <div style={{ fontSize: '12px', color: '#111827', fontWeight: 500, lineHeight: '1.4' }}>
                        {numberToWords(tot)}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '280px' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f3f4f6', background: '#ffffff' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>Parts Total</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>Rs.{pt.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>Service Charge</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>Rs.{svc.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: accent, color: '#ffffff' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grand Total</span>
                        <span style={{ fontSize: '14px', fontWeight: 800 }}>Rs.{tot.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #f3f4f6', background: '#ffffff' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>Advance / Paid</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>- Rs.{paid.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: bal > 0 ? '#fef2f2' : '#ecfdf5', borderTop: `2px solid ${bal > 0 ? '#fecaca' : '#a7f3d0'}` }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: bal > 0 ? '#991b1b' : '#065f46', textTransform: 'uppercase' }}>Balance Due</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: bal > 0 ? '#dc2626' : '#059669' }}>{bal > 0 ? `Rs.${bal.toFixed(2)}` : 'PAID ✓'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes + Terms - Same as regular */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: '6px' }}>Notes</div>
                    <div style={{ fontSize: '11px', color: '#78350f', lineHeight: '1.4' }}>
                      {job.diagnosisNotes || job.notes || `Service completed for ${job.deviceType}. ${Number(job.warrantyDays) || 30} days warranty.`}
                    </div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: '6px' }}>Terms & Warranty</div>
                    <div style={{ fontSize: '10px', color: '#064e3b', lineHeight: '1.4' }}>
                      • {Number(job.warrantyDays) || 30} days service warranty<br/>
                      • Parts warranty as per manufacturer<br/>
                      • Collect within 30 days<br/>
                      • {shop?.termsInvoice || 'Goods once sold will not be taken back.'}
                    </div>
                  </div>
                </div>

                {/* Signature - Same */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                    <div>Thank you for your business!</div>
                    <div style={{ marginTop: '4px', fontWeight: 600 }}>{bn}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '140px', height: '1px', background: '#000', marginBottom: '6px' }} />
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>Authorised Signatory</div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>{bn}</div>
                  </div>
                </div>

                {/* Bank Details — always shown (wired from shop settings) */}
                {(shop?.bankName || shop?.bankAccount) && (
                  <div style={{ marginTop: '16px', border: `1px solid ${accent}`, borderRadius: '8px', padding: '10px 14px', background: 'linear-gradient(135deg, #f8fafc, #ffffff)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Bank Details</div>
                    <div style={{ fontSize: '11px', color: '#334155', lineHeight: 1.6 }}>
                      {shop?.bankName && <div><span style={{ fontWeight: 700 }}>Bank:</span> {shop.bankName}{shop?.bankBranch ? `, ${shop.bankBranch}` : ''}</div>}
                      {shop?.bankAccount && <div><span style={{ fontWeight: 700 }}>A/c:</span> {shop.bankAccount}{shop?.bankIfsc ? `  |  IFSC: ${shop.bankIfsc}` : ''}</div>}
                    </div>
                  </div>
                )}

                {renderAdBanner(bannerStyle)}

                {/* Footer - Same */}
                <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '1px dashed #d1d5db', fontSize: '9px', color: '#9ca3af' }}>
                  This is a computer generated invoice • {bn} • {shop?.phone || ''} • {new Date().toLocaleDateString('en-IN')} • Thank you!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons - No Print */}
        <div className="no-print bg-white border-t p-3 flex flex-wrap gap-2 flex-shrink-0">
          <Button onClick={printInvoice} className="flex-1 bg-slate-900 hover:bg-slate-800 h-10 text-sm">
            <Printer className="w-4 h-4 mr-2" /> Print Invoice
          </Button>
          <Button onClick={downloadPDF} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-10 text-sm">
            <FileText className="w-4 h-4 mr-2" /> Download PDF
          </Button>
          <Button onClick={shareWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700 h-10 text-sm">
            <Share2 className="w-4 h-4 mr-2" /> WhatsApp
          </Button>
          <Button onClick={onClose} variant="outline" className="h-10 px-4">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
