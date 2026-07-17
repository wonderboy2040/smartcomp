'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Printer, Download, X, Eye, Sparkles, Check, RefreshCw, FileText } from 'lucide-react'
import { formatCurrency, numberToWords } from '@/lib/calc'

export interface DocumentHtmlViewerProps {
  docId?: string
  docType?: 'invoice' | 'quotation' | 'service'
  data?: any
  onClose?: () => void
}

const TEMPLATES = [
  { id: 'tally-classic', name: 'Tally Prime Premium', badge: 'BEST SELLER', primary: '#1e3a8a', accent: '#3b82f6', bgLight: '#eff6ff', headerBg: '#1e3a8a', headerText: '#ffffff' },
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
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (data) {
      setDoc(data)
      if (data.templateId) setTemplateId(data.templateId)
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

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white text-slate-700 min-h-[300px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading document preview (Ultra Fast)...</p>
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
  const titleText = isQuotation ? 'QUOTATION' : isService ? 'SERVICE INVOICE' : 'TAX INVOICE'

  return (
    <div className="flex flex-col h-full bg-slate-100 text-slate-900 font-sans">
      {/* Top Action Bar - Hidden during window.print() */}
      <div className="print:hidden sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-3 shadow-md border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <div>
            <span className="font-bold text-sm block leading-tight">{doc.number}</span>
            <span className="text-[11px] text-slate-400">{doc.customer?.name || 'Walk-in'} • {new Date(doc.date).toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        {/* Template Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-300 hidden sm:inline">Template:</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2.5 py-1.5 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.badge})
              </option>
            ))}
          </select>

          {/* Action buttons */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded shadow transition cursor-pointer"
            title="Print or Save as PDF (Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print / A4 PDF</span>
          </button>

          <a
            href={`/api/pdf/${doc.id || doc.number}?type=${doc.docType}`}
            download={`Document-${doc.number}.pdf`}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-3 py-1.5 rounded transition"
            title="Direct PDF Binary Download"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Download</span>
          </a>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Printable Document Canvas */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-6 flex justify-center bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible">
        {/* Exact A4 Canvas Wrapper - 210mm x 297mm */}
        <div
          ref={printRef}
          className="bg-white text-slate-900 shadow-xl border border-slate-300 rounded-none w-full max-w-[210mm] min-h-[297mm] p-6 sm:p-8 flex flex-col justify-between print:shadow-none print:border-none print:w-full print:max-w-none print:min-h-0 print:p-0 font-sans text-[11px] leading-tight select-text"
          style={{
            boxSizing: 'border-box',
          }}
        >
          {/* Document Content Header */}
          <div className="space-y-4">
            {/* Header Box */}
            <div
              className="border-b-2 pb-3 flex flex-wrap items-start justify-between gap-4"
              style={{ borderColor: currentTpl.primary }}
            >
              <div className="flex-1 min-w-[200px]">
                <h1
                  className="text-2xl font-black uppercase tracking-wide"
                  style={{ color: currentTpl.primary }}
                >
                  {doc.shop?.name || 'Smart Computers'}
                </h1>
                <p className="text-slate-600 font-medium mt-1 whitespace-pre-line leading-snug">
                  {doc.shop?.address}
                </p>
                <div className="flex flex-wrap gap-x-4 text-slate-600 font-medium mt-1">
                  {doc.shop?.phone && <span>Ph: <strong>{doc.shop.phone}</strong></span>}
                  {doc.shop?.email && <span>Email: {doc.shop.email}</span>}
                  {doc.shop?.gstNumber && <span className="text-slate-900 font-bold">GSTIN: {doc.shop.gstNumber}</span>}
                </div>
              </div>

              {/* Title & Badge Box */}
              <div className="text-right">
                <div
                  className="inline-block px-3 py-1 font-black text-sm uppercase tracking-wider rounded border"
                  style={{
                    backgroundColor: currentTpl.headerBg,
                    color: currentTpl.headerText,
                    borderColor: currentTpl.primary,
                  }}
                >
                  {titleText}
                </div>
                <div className="mt-2 space-y-0.5 text-slate-700 font-medium text-xs">
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

            {/* Billing Information Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
              <div className="border border-slate-300 rounded p-3 bg-slate-50/50">
                <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Billed To (Customer)</p>
                <p className="font-bold text-sm text-slate-900">{doc.customer?.name || 'Walk-in Customer'}</p>
                {doc.customer?.phone && <p className="text-slate-600 font-medium">Phone: {doc.customer.phone}</p>}
                {doc.customer?.gstNumber && <p className="text-slate-900 font-bold mt-1">GSTIN: {doc.customer.gstNumber}</p>}
                {doc.customer?.address && <p className="text-slate-600">{doc.customer.address}</p>}
              </div>

              {isService ? (
                <div className="border border-slate-300 rounded p-3 bg-slate-50/50">
                  <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Device Details</p>
                  <p className="font-bold text-slate-900">{doc.brandModel || 'Computer / Laptop'}</p>
                  <p className="text-slate-600">S/N: {doc.serialNumber || 'N/A'} | Issue: {doc.problemDesc || 'Service'}</p>
                  {doc.warrantyDays && <p className="text-emerald-700 font-bold mt-1">Warranty: {doc.warrantyDays} Days</p>}
                </div>
              ) : (
                <div className="border border-slate-300 rounded p-3 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Payment Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${doc.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : doc.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                        {doc.paymentStatus || 'UNPAID'}
                      </span>
                    </div>
                  </div>
                  {doc.amountDue > 0 && (
                    <p className="text-red-700 font-bold text-xs mt-2">Balance Due: {formatCurrency(doc.amountDue)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Items Table - Perfectly Aligned Columns */}
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
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-16">Disc</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-20">Taxable</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-24">GST Amt</th>
                    <th className="py-2 px-2 border-b border-slate-300 text-right w-24">Total</th>
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
                      <td className="py-2 px-2 text-right text-slate-500">{item.discount > 0 ? `Rs.${item.discount}` : '-'}</td>
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

            {/* HSN/SAC Summary Table (If GST items exist) */}
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

            {/* Totals & Notes Section */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2">
              {/* Left Column: Bank + UPI + Notes */}
              <div className="sm:col-span-7 space-y-3">
                {/* Amount in Words */}
                <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                  <span className="font-bold text-slate-600 block text-[9.5px] uppercase">Amount in Words:</span>
                  <span className="font-bold text-slate-900 text-xs">{numberToWords(doc.calc?.grandTotal || 0)}</span>
                </div>

                {/* Bank Details & UPI QR */}
                {(doc.shop?.bankAccount || doc.shop?.upiId || doc.upiQr) && (
                  <div className="flex gap-3 p-2.5 rounded border border-slate-200 bg-white">
                    {doc.upiQr && (
                      <div className="text-center flex-shrink-0">
                        <img src={doc.upiQr} alt="UPI QR Code" className="w-20 h-20 border rounded p-0.5" />
                        <span className="text-[8px] font-bold text-slate-500 block mt-0.5">Scan to Pay</span>
                      </div>
                    )}
                    <div className="space-y-0.5 text-[10px] text-slate-700 flex-1">
                      <p className="font-bold text-slate-900 uppercase">Bank Payment Details</p>
                      {doc.shop?.bankName && <p>Bank: <strong>{doc.shop.bankName}</strong></p>}
                      {doc.shop?.bankAccount && <p>A/C: <strong>{doc.shop.bankAccount}</strong></p>}
                      {doc.shop?.bankIfsc && <p>IFSC: <strong>{doc.shop.bankIfsc}</strong> ({doc.shop?.bankBranch || ''})</p>}
                      {doc.shop?.upiId && <p className="text-blue-700 font-bold mt-1">UPI ID: {doc.shop.upiId}</p>}
                    </div>
                  </div>
                )}

                {/* Notes & Terms */}
                <div className="text-[9.5px] text-slate-600 space-y-1">
                  {doc.notes && (
                    <p><strong className="text-slate-800">Notes:</strong> {doc.notes}</p>
                  )}
                  {doc.terms && (
                    <div>
                      <strong className="text-slate-800 block">Terms & Conditions:</strong>
                      <p className="whitespace-pre-line text-slate-500 leading-normal">{doc.terms}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Calculations Summary */}
              <div className="sm:col-span-5 bg-slate-50 border border-slate-300 rounded p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Subtotal:</span>
                  <span className="font-medium">Rs.{doc.calc?.subtotal?.toFixed(2)}</span>
                </div>
                {doc.calc?.gstAmount > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST:</span>
                      <span>Rs.{doc.calc?.cgstAmount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST:</span>
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
                {doc.calc?.otherCharges > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Other Charges:</span>
                    <span>Rs.{doc.calc.otherCharges.toFixed(2)}</span>
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
                    <span>Amount Paid:</span>
                    <span>Rs.{doc.amountPaid.toFixed(2)}</span>
                  </div>
                )}
                {doc.amountDue > 0 && (
                  <div className="flex justify-between text-red-700 font-bold text-xs">
                    <span>Amount Due:</span>
                    <span>Rs.{doc.amountDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Promotional Product Showcase Ad Banner & Signatory Section */}
          <div className="mt-8 pt-4 border-t border-slate-300 space-y-4">
            {/* Ad Banner Box */}
            <div
              className="p-3 rounded border flex flex-wrap items-center justify-between gap-3 text-center sm:text-left"
              style={{
                backgroundColor: currentTpl.bgLight,
                borderColor: currentTpl.accent,
              }}
            >
              <div>
                <p className="font-bold text-xs uppercase tracking-wider" style={{ color: currentTpl.primary }}>
                  Smart Computers & IT Services
                </p>
                <p className="text-[10px] text-slate-600">Computers • Laptops • Printers • CCTV • IT Accessories & Repairs</p>
              </div>
              <div className="text-xs font-bold text-slate-900">
                {doc.shop?.phone ? `Call / WhatsApp: ${doc.shop.phone}` : 'Contact for Wholesale & Retail Deals!'}
              </div>
            </div>

            {/* Signature Block */}
            <div className="flex justify-between items-end pt-2">
              <div className="text-[9px] text-slate-400">
                <p>This is a computer-generated document.</p>
                <p>Generated via Smart Computers ERP Panel</p>
              </div>
              <div className="text-center min-w-[160px]">
                <div className="h-10 border-b border-slate-400 mb-1"></div>
                <p className="font-bold text-xs text-slate-900">For {doc.shop?.name || 'Smart Computers'}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global CSS for Print Optimization */}
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
