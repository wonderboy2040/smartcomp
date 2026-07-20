'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Printer, Download, X, Eye, RefreshCw, FileText } from 'lucide-react'
import { formatCurrency, numberToWords } from '@/lib/calc'
import { AD_BANNER_VARIANTS } from '@/lib/pdf'

export interface DocumentHtmlViewerProps {
  docId?: string
  docType?: 'invoice' | 'quotation' | 'service'
  data?: any
  onClose?: () => void
}

const TEMPLATES = [
  { id: 'tally-classic', name: 'Tally Prime Premium', badge: 'BEST SELLER', primary: '#1e3a8a', accent: '#3b82f6', bgLight: '#eff6ff', headerBg: '#ffffff', headerText: '#1e3a8a' },
  { id: 'tally-modern', name: 'Modern Minimal GST', badge: 'MINIMAL', primary: '#0f172a', accent: '#10b981', bgLight: '#ecfdf5', headerBg: '#f8fafc', headerText: '#0f172a' },
  { id: 'tally-corporate', name: 'Corporate Elite Pro', badge: 'CORPORATE', primary: '#0f172a', accent: '#ca8a04', bgLight: '#fef3c7', headerBg: '#0f172a', headerText: '#ffffff' },
  { id: 'tally-elegant', name: 'Royal Executive Gold', badge: 'ROYAL', primary: '#7f1d1d', accent: '#fbbf24', bgLight: '#fef9c3', headerBg: '#7f1d1d', headerText: '#ffffff' },
  { id: 'tally-bold', name: 'Tech Store Pro', badge: 'TECH', primary: '#134e4a', accent: '#f97316', bgLight: '#ffedd5', headerBg: '#134e4a', headerText: '#ffffff' },
  { id: 'gst-premium-dark', name: 'Premium Dark Elite', badge: 'LUXURY', primary: '#000000', accent: '#eab308', bgLight: '#fefce8', headerBg: '#000000', headerText: '#ffd700' },
  { id: 'gst-classic-plus', name: 'GST Classic Plus', badge: 'GST PLUS', primary: '#111827', accent: '#2563eb', bgLight: '#eff6ff', headerBg: '#ffffff', headerText: '#111827' },
  { id: 'gst-executive-formal', name: 'Executive Formal', badge: 'FORMAL', primary: '#1e293b', accent: '#475569', bgLight: '#f8fafc', headerBg: '#f1f5f9', headerText: '#1e293b' },
  { id: 'gst-vibrant-bold', name: 'Vibrant Bold Offer', badge: 'VIBRANT', primary: '#7c2d12', accent: '#f97316', bgLight: '#ffedd5', headerBg: '#7c2d12', headerText: '#ffffff' },
  { id: 'gst-minimal-white', name: 'Minimal White Pro', badge: 'ECO PRINT', primary: '#0f172a', accent: '#0284c7', bgLight: '#f0f9ff', headerBg: '#ffffff', headerText: '#0f172a' },
]

export function DocumentHtmlViewer({ docId, docType = 'invoice', data, onClose }: DocumentHtmlViewerProps) {
  const [doc, setDoc] = useState<any>(data || null)
  const [loading, setLoading] = useState<boolean>(!data && !!docId)
  const [error, setError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string>('tally-classic')
  const [bannerVariant, setBannerVariant] = useState<string>('flyer')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (data) {
      setDoc(data)
      if (data.templateId) setTemplateId(data.templateId)
      if (data.bannerVariant || data.adBannerVariant) setBannerVariant(data.bannerVariant || data.adBannerVariant)
      setLoading(false)
      return
    }

    if (!docId) return

    setLoading(true)
    setError(null)
    fetch(`/api/doc-data/${docId}?type=${docType}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load document data')
        return res.json()
      })
      .then((d) => {
        setDoc(d)
        if (d.templateId) setTemplateId(d.templateId)
        if (d.bannerVariant || d.adBannerVariant) setBannerVariant(d.bannerVariant || d.adBannerVariant)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Error loading document')
        setLoading(false)
      })
  }, [docId, docType, data])

  const currentTpl = useMemo(() => {
    return TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0]
  }, [templateId])

  // Compute HSN summary
  const hsnSummary = useMemo(() => {
    if (!doc?.calc?.items) return []
    const map = new Map<string, { hsn: string; taxable: number; gstRate: number; cgstAmt: number; sgstAmt: number; totalGst: number }>()
    for (const item of doc.calc.items) {
      const hsn = item.hsnCode || 'N/A'
      const rate = Number(item.gstRate) || 0
      const key = `${hsn}_${rate}`
      const existing = map.get(key) || { hsn, taxable: 0, gstRate: rate, cgstAmt: 0, sgstAmt: 0, totalGst: 0 }
      const taxable = Number(item.amount) || 0
      const gstAmt = Number(item.gstAmount) || 0
      existing.taxable += taxable
      existing.totalGst += gstAmt
      existing.cgstAmt += gstAmt / 2
      existing.sgstAmt += gstAmt / 2
      map.set(key, existing)
    }
    return Array.from(map.values())
  }, [doc])

  // Effective CGST / SGST rate calculation
  const halfGstRate = useMemo(() => {
    if (!doc?.calc?.items) return 9
    const itemWithGst = doc.calc.items.find((i: any) => i.gstApplicable && Number(i.gstRate) > 0)
    return itemWithGst ? (Number(itemWithGst.gstRate) / 2) : 9
  }, [doc])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white text-slate-700 min-h-[300px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading document preview...</p>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="p-8 text-center bg-white text-slate-800">
        <p className="text-red-600 font-bold mb-2">Error Loading Document</p>
        <p className="text-xs text-slate-500">{error || 'Document data unavailable'}</p>
      </div>
    )
  }

  const isQuotation = doc.docType === 'quotation'
  const isService = doc.docType === 'service'
  const titleText = isQuotation ? 'QUOTATION' : isService ? 'SERVICE INVOICE' : 'INVOICE'

  return (
    <div className="flex flex-col h-full bg-slate-100 text-slate-900 font-sans">
      {/* Action Toolbar - Hidden on Print */}
      <div className="print:hidden sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-3 shadow-md border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <div>
            <span className="font-bold text-sm block leading-tight">{doc.number}</span>
            <span className="text-[11px] text-slate-400">{doc.customer?.name || 'Walk-in'} • {new Date(doc.date).toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-slate-300 hidden sm:inline">Theme:</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2.5 py-1.5 font-medium outline-none cursor-pointer"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-slate-300 hidden sm:inline">Banner:</label>
            <select
              value={bannerVariant}
              onChange={(e) => setBannerVariant(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2.5 py-1.5 font-medium outline-none cursor-pointer"
            >
              {AD_BANNER_VARIANTS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded shadow transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print A4</span>
          </button>

          <a
            href={`/api/pdf/${doc.id || doc.number}?type=${doc.docType}&template=${templateId}&banner=${bannerVariant}`}
            download={`Document-${doc.number}.pdf`}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-3 py-1.5 rounded transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">PDF</span>
          </a>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* A4 Canvas Container */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-6 flex justify-center bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible">
        <div
          ref={printRef}
          className="bg-white text-slate-900 shadow-xl border border-slate-300 rounded-none w-full max-w-[210mm] min-h-[297mm] p-6 sm:p-8 flex flex-col justify-between print:shadow-none print:border-none print:w-full print:max-w-none print:min-h-0 print:p-0 font-sans text-[11px] leading-tight select-text"
        >
          {/* Main Top Content */}
          <div className="space-y-5">
            {/* Header Box with Official Crest Shield Logo */}
            <div
              className="border-b-2 pb-4 flex flex-wrap items-center justify-between gap-4"
              style={{ borderColor: currentTpl.primary }}
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-[240px]">
                <img
                  src={doc.productImages?.logo || '/logo.png'}
                  alt="SMART COMPUTERS Logo"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain flex-shrink-0"
                />
                <div>
                  <h1
                    className="text-xl sm:text-2xl font-black uppercase tracking-wide leading-snug mb-0.5"
                    style={{ color: currentTpl.primary }}
                  >
                    {doc.shop?.name || 'Smart Computers'}
                  </h1>
                  {doc.shop?.address && (
                    <p className="text-slate-600 font-medium whitespace-pre-line leading-relaxed text-xs">
                      {doc.shop.address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 font-medium text-xs mt-1">
                    {doc.shop?.phone && <span>Ph: <strong>{doc.shop.phone}</strong></span>}
                    {doc.shop?.email && <span>Email: {doc.shop.email}</span>}
                    {doc.shop?.gstNumber && <span className="text-slate-900 font-bold block w-full mt-0.5">GSTIN: {doc.shop.gstNumber}</span>}
                  </div>
                </div>
              </div>

              {/* Title Badge ("INVOICE") & Doc Details */}
              <div className="text-right">
                <div
                  className="inline-block px-3 py-1 font-black text-sm uppercase tracking-wider rounded border mb-2"
                  style={{
                    backgroundColor: currentTpl.headerBg,
                    color: currentTpl.headerText,
                    borderColor: currentTpl.primary,
                  }}
                >
                  {titleText}
                </div>
                <div className="space-y-0.5 text-slate-700 font-medium text-xs">
                  <p>Number: <strong className="text-slate-900 font-bold">{doc.number}</strong></p>
                  <p>Date: <strong>{new Date(doc.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></p>
                  {isQuotation && doc.validTill && (
                    <p className="text-amber-700 font-semibold">Valid Till: {new Date(doc.validTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  )}
                  {doc.paymentType && (
                    <p className="capitalize">Type: <span className="font-semibold">{doc.paymentType}</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Bill To & Status Cards - CLEAR GAP BEFORE BILL TO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-3 pt-1">
              <div className="border border-slate-300 rounded p-3 bg-slate-50/50">
                <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Bill To / Customer Details</p>
                <p className="font-bold text-sm text-slate-900">{doc.customer?.name || 'Walk-in Customer'}</p>
                {doc.customer?.phone && <p className="text-slate-600 font-medium">Phone: {doc.customer.phone}</p>}
                {doc.customer?.gstNumber && <p className="text-slate-900 font-bold mt-1">GSTIN: {doc.customer.gstNumber}</p>}
              </div>

              {isService ? (
                <div className="border border-slate-300 rounded p-3 bg-slate-50/50">
                  <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Service Details</p>
                  <p className="font-bold text-slate-900">{doc.brandModel || 'Computer / Laptop'}</p>
                  <p className="text-slate-600">S/N: {doc.serialNumber || 'N/A'} | Issue: {doc.problemDesc || 'Service'}</p>
                  {doc.warrantyDays && <p className="text-emerald-700 font-bold mt-1">Warranty: {doc.warrantyDays} Days</p>}
                </div>
              ) : (
                <div className="border border-slate-300 rounded p-3 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Payment Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${doc.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : doc.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-300'}`}>
                      {doc.paymentStatus || 'UNPAID'}
                    </span>
                  </div>
                  {doc.amountDue > 0 && (
                    <p className="text-red-700 font-bold text-xs mt-2">Balance Due: {formatCurrency(doc.amountDue)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border border-slate-300 rounded">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr
                    className="font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: currentTpl.primary }}
                  >
                    <th className="py-2 px-2 border-b border-slate-300 text-center w-8">#</th>
                    <th className="py-2 px-2 border-b border-slate-300">Item Description</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-center w-16">HSN/SAC</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-12">Qty</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-20">Rate</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-20">Taxable</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-24">GST</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {doc.calc?.items?.map((item: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-2 px-2 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="py-2 px-2 font-semibold text-slate-900">
                        {item.name}
                        {item.sku && <span className="block text-[9px] text-slate-500 font-mono">SKU: {item.sku}</span>}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-600">{item.hsnCode || '-'}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-700">Rs.{item.rate?.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-medium text-slate-800">Rs.{item.amount?.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {item.gstAmount > 0 ? (
                          <span>Rs.{item.gstAmount?.toFixed(2)} <span className="text-[9px] text-slate-400">({item.gstRate}%)</span></span>
                        ) : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">Rs.{item.total?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* HSN Table */}
            {hsnSummary.length > 0 && hsnSummary.some((h) => h.totalGst > 0) && (
              <div className="mt-3">
                <p className="font-bold text-[10px] uppercase text-slate-500 mb-1">HSN / SAC Summary</p>
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-[9.5px]">
                    <thead className="bg-slate-100 font-bold text-slate-700 border-b">
                      <tr>
                        <th className="p-1.5">HSN/SAC</th>
                        <th className="p-1.5 text-right">Taxable Value</th>
                        <th className="p-1.5 text-right">CGST</th>
                        <th className="p-1.5 text-right">SGST</th>
                        <th className="p-1.5 text-right">Total Tax Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hsnSummary.map((h, i) => (
                        <tr key={i}>
                          <td className="p-1.5 font-semibold text-slate-800">{h.hsn} ({h.gstRate}%)</td>
                          <td className="p-1.5 text-right">Rs.{h.taxable.toFixed(2)}</td>
                          <td className="p-1.5 text-right">Rs.{h.cgstAmt.toFixed(2)}</td>
                          <td className="p-1.5 text-right">Rs.{h.sgstAmt.toFixed(2)}</td>
                          <td className="p-1.5 text-right font-bold text-slate-900">Rs.{h.totalGst.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CLEARANCE GAP AFTER TABLE */}
            <div className="pt-3">
              {/* Totals, Bank, & Words Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-7 space-y-3">
                  {/* Amount in Words */}
                  <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                    <span className="font-bold text-slate-500 block text-[9.5px] uppercase">Amount in Words</span>
                    <span className="font-bold text-slate-900 text-xs">{numberToWords(doc.calc?.grandTotal || 0)}</span>
                  </div>

                  {/* Bank Details */}
                  {(doc.shop?.bankAccount || doc.shop?.upiId || doc.upiQr) && (
                    <div className="flex gap-3 p-2.5 rounded border border-slate-200 bg-white">
                      {doc.upiQr && (
                        <div className="text-center flex-shrink-0">
                          <img src={doc.upiQr} alt="UPI QR Code" className="w-16 h-16 border rounded p-0.5" />
                          <span className="text-[8px] font-bold text-slate-500 block mt-0.5">Scan to Pay</span>
                        </div>
                      )}
                      <div className="space-y-0.5 text-[10px] text-slate-700 flex-1">
                        <p className="font-bold text-slate-900 uppercase">Bank Details & UPI</p>
                        {doc.shop?.bankName && <p>Bank: <strong>{doc.shop.bankName}</strong></p>}
                        {doc.shop?.bankAccount && <p>A/C: <strong>{doc.shop.bankAccount}</strong> | IFSC: <strong>{doc.shop.bankIfsc || '-'}</strong></p>}
                        {doc.shop?.upiId && <p className="text-blue-700 font-bold mt-1">UPI ID: {doc.shop.upiId}</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Totals Summary displaying CGST (9%) and SGST (9%) */}
                <div className="sm:col-span-5 bg-slate-50 border border-slate-300 rounded p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-700">
                    <span>Sub Total:</span>
                    <span className="font-medium">Rs.{doc.calc?.subtotal?.toFixed(2)}</span>
                  </div>
                  {doc.calc?.gstAmount > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST ({halfGstRate}%):</span>
                        <span>Rs.{doc.calc?.cgstAmount?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST ({halfGstRate}%):</span>
                        <span>Rs.{doc.calc?.sgstAmount?.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {doc.calc?.courierCharges > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Courier Charges:</span>
                      <span>Rs.{doc.calc.courierCharges.toFixed(2)}</span>
                    </div>
                  )}
                  {doc.calc?.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount:</span>
                      <span>- Rs.{doc.calc.discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-300 my-1 pt-1.5 flex justify-between text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-base" style={{ color: currentTpl.primary }}>
                      {formatCurrency(doc.calc?.grandTotal || 0)}
                    </span>
                  </div>

                  {doc.amountPaid > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold text-xs pt-1 border-t border-slate-200">
                      <span>Paid / Advance:</span>
                      <span>Rs.{doc.amountPaid.toFixed(2)}</span>
                    </div>
                  )}
                  {doc.amountDue > 0 && (
                    <div className="flex justify-between text-red-700 font-bold text-xs">
                      <span>Balance Due:</span>
                      <span>Rs.{doc.amountDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Authorized Signatory + 1000x285 Poster Image */}
          <div className="mt-8 pt-4 border-t border-slate-300 space-y-6">
            {/* Authorized Signature Block (Positioned strictly ABOVE 1000x285 Banner) */}
            <div className="flex justify-end pr-2">
              <div className="text-center min-w-[200px]">
                <p className="font-bold text-xs text-slate-900 mb-8">
                  For {doc.shop?.name || 'Smart Computers'}:
                </p>
                <div className="w-full border-b border-slate-400 mb-1"></div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Authorized Signatory</p>
              </div>
            </div>

            {/* Dynamic 1000px x 285px Poster Showcase */}
            {bannerVariant === 'flyer' ? (
              <div className="flex justify-center w-full">
                <img
                  src={doc.productImages?.flyer || '/posters/smartcomputers-a4-flyer-landscape.png'}
                  alt="Smart Computers Premium Flyer"
                  className="w-full max-w-[180mm] h-auto object-contain block rounded border border-slate-300 shadow-sm"
                  style={{ aspectRatio: '1000 / 285' }}
                />
              </div>
            ) : bannerVariant === 'grid' ? (
              <div className="flex justify-center w-full">
                <img
                  src={doc.productImages?.productgrid || '/posters/smartcomputers-product-grid.png'}
                  alt="Smart Computers Product Grid Poster"
                  className="w-full max-w-[180mm] h-auto object-contain block rounded border border-slate-300 shadow-sm"
                  style={{ aspectRatio: '1000 / 285' }}
                />
              </div>
            ) : bannerVariant === 'featured' ? (
              <div
                className="p-3 rounded border flex items-center justify-between gap-3 max-w-[180mm] mx-auto"
                style={{ backgroundColor: currentTpl.bgLight, borderColor: currentTpl.accent }}
              >
                <div>
                  <p className="font-black text-xs uppercase tracking-wider" style={{ color: currentTpl.primary }}>
                    WE ALSO SUPPLY
                  </p>
                  <p className="text-[10px] text-slate-600 font-semibold">{doc.shop?.name || 'Smart Computers'}</p>
                  {doc.shop?.phone && <p className="text-[10px] text-slate-500">Call: {doc.shop.phone}</p>}
                </div>
                <div className="grid grid-cols-4 gap-2 flex-1 max-w-md">
                  {['computers', 'laptop', 'printers', 'accessories'].map((key) => (
                    <div key={key} className="bg-white border border-slate-200 rounded p-1.5 text-center">
                      {doc.productImages?.[key] && (
                        <img src={doc.productImages[key]} alt={key} className="w-10 h-10 object-contain mx-auto" />
                      )}
                      <p className="text-[9px] font-bold text-slate-800 capitalize mt-0.5">{key}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Default: 'strip' */
              <div
                className="p-3 rounded border flex items-center justify-between gap-3 text-xs max-w-[180mm] mx-auto"
                style={{ backgroundColor: currentTpl.bgLight, borderColor: currentTpl.accent }}
              >
                <span className="font-bold uppercase text-sm" style={{ color: currentTpl.primary }}>
                  SMART COMPUTERS IT SOLUTIONS
                </span>
                <span className="text-[11px] text-slate-600 hidden sm:inline font-medium">
                  Computers • Laptops • Printers • CCTV • Accessories & Repairing
                </span>
                <span className="font-bold text-slate-900 text-xs">
                  {doc.shop?.phone ? `Call: ${doc.shop.phone}` : 'Visit Store'}
                </span>
              </div>
            )}

            {/* Document Footer Line */}
            <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-slate-200 pt-2">
              <span>Invoice {doc.number} • {doc.shop?.name || 'Smart Computers'}</span>
              <span>Computer generated document</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
