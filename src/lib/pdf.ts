import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { formatCurrency, numberToWords, type InvoiceCalc } from './calc'

export interface ShopInfo {
  name: string
  owner?: string
  phone?: string
  email?: string
  address?: string
  gstNumber?: string
  state?: string
  logoUrl?: string
  upiId?: string
}

export interface CustomerInfo {
  name: string
  phone?: string
  email?: string
  address?: string
  gstNumber?: string
  state?: string
}

export interface PdfDocData {
  number: string
  date: Date
  shop: ShopInfo
  customer: CustomerInfo
  calc: InvoiceCalc
  notes?: string
  terms?: string
  validTill?: Date
  amountPaid?: number
  amountDue?: number
  paymentType?: string
  paymentStatus?: string
  docType: 'invoice' | 'quotation'
  templateId?: string
}

// ===== 5 PREMIUM MINIMALISTIC TEMPLATES =====
export interface PdfTemplate {
  id: string
  name: string
  description: string
  primary: [number, number, number]
  accent: [number, number, number]
}

export const PDF_TEMPLATES: PdfTemplate[] = [
  {
    id: 'indigo-clean',
    name: 'Indigo Clean',
    description: 'Minimal indigo — modern & clean',
    primary: [79, 70, 229],
    accent: [99, 102, 241],
  },
  {
    id: 'saffron-white',
    name: 'Saffron White',
    description: 'Saffron accent on white — Indian premium',
    primary: [234, 88, 12],
    accent: [251, 146, 60],
  },
  {
    id: 'emerald-pro',
    name: 'Emerald Pro',
    description: 'Emerald accent — professional GST',
    primary: [5, 150, 105],
    accent: [16, 185, 129],
  },
  {
    id: 'navy-formal',
    name: 'Navy Formal',
    description: 'Deep navy — corporate formal',
    primary: [30, 58, 138],
    accent: [59, 130, 246],
  },
  {
    id: 'graphite-gold',
    name: 'Graphite Gold',
    description: 'Graphite + gold — luxury minimal',
    primary: [30, 30, 35],
    accent: [202, 138, 4],
  },
]

// Neutral colors shared across templates
const NEUTRAL = {
  white: [255, 255, 255] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  textDark: [31, 41, 55] as [number, number, number],
  textMid: [75, 85, 99] as [number, number, number],
  textLight: [107, 114, 128] as [number, number, number],
  textVeryLight: [156, 163, 175] as [number, number, number],
  bgRow: [249, 250, 251] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  borderLight: [243, 244, 246] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
}

// Generate PDF
export async function generateInvoicePdf(data: PdfDocData): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  let y = margin

  const isInvoice = data.docType === 'invoice'
  const tpl = PDF_TEMPLATES.find(t => t.id === data.templateId) || PDF_TEMPLATES[0]
  const P = tpl.primary
  const A = tpl.accent

  // ===== MINIMAL HEADER =====
  // Thin top accent line
  doc.setFillColor(...P)
  doc.rect(0, 0, pageWidth, 3, 'F')

  y = 12

  // Shop name (left, bold, dark)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...NEUTRAL.dark)
  doc.text(data.shop.name || 'Smart Computers', margin, y + 5)

  // Shop info (small, gray)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...NEUTRAL.textLight)
  let infoY = y + 10
  let shopInfo = ''
  if (data.shop.address) shopInfo += data.shop.address
  if (data.shop.state) shopInfo += (shopInfo ? ', ' : '') + data.shop.state
  if (shopInfo) {
    doc.text(shopInfo, margin, infoY)
    infoY += 3.5
  }
  let contactInfo = ''
  if (data.shop.phone) contactInfo += data.shop.phone
  if (data.shop.email) contactInfo += (contactInfo ? '  |  ' : '') + data.shop.email
  if (contactInfo) {
    doc.text(contactInfo, margin, infoY)
    infoY += 3.5
  }
  if (data.shop.gstNumber) {
    doc.text('GSTIN: ' + data.shop.gstNumber, margin, infoY)
  }

  // Doc type + number (right side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...P)
  doc.text(isInvoice ? 'TAX INVOICE' : 'QUOTATION', pageWidth - margin, y, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...NEUTRAL.textMid)
  doc.text(`No: ${data.number}`, pageWidth - margin, y + 5, { align: 'right' })
  doc.text(`Date: ${formatDate(data.date)}`, pageWidth - margin, y + 10, { align: 'right' })
  if (data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, pageWidth - margin, y + 15, { align: 'right' })
  }

  // Divider line
  y = 34
  doc.setDrawColor(...NEUTRAL.border)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ===== BILL TO =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...A)
  doc.text(isInvoice ? 'BILL TO' : 'QUOTE TO', margin, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NEUTRAL.dark)
  doc.text(data.customer.name || 'Walk-in Customer', margin, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...NEUTRAL.textMid)
  let cy = y + 10
  if (data.customer.address) {
    const addrLines = doc.splitTextToSize(data.customer.address, 85)
    doc.text(addrLines, margin, cy)
    cy += addrLines.length * 3.5
  }
  if (data.customer.phone) {
    doc.text('Ph: ' + data.customer.phone, margin, cy)
    cy += 3.5
  }
  if (data.customer.gstNumber) {
    doc.text('GSTIN: ' + data.customer.gstNumber, margin, cy)
  }

  // Payment details (right, invoice only)
  if (isInvoice) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('PAYMENT DETAILS', pageWidth - margin, y, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...NEUTRAL.textMid)
    doc.text(`Type: ${(data.paymentType || 'cash').toUpperCase()}`, pageWidth - margin, y + 5, { align: 'right' })
    doc.text(`Status: ${(data.paymentStatus || 'paid').toUpperCase()}`, pageWidth - margin, y + 10, { align: 'right' })
    if (data.amountDue !== undefined && data.amountDue > 0) {
      doc.setTextColor(...NEUTRAL.red)
      doc.text(`Due: ${formatCurrency(data.amountDue)}`, pageWidth - margin, y + 15, { align: 'right' })
    } else if (data.amountPaid !== undefined && data.amountPaid > 0) {
      doc.setTextColor(...P)
      doc.text(`Paid: ${formatCurrency(data.amountPaid)}`, pageWidth - margin, y + 15, { align: 'right' })
    }
  }

  y = Math.max(cy, y + 20) + 6

  // ===== ITEMS TABLE =====
  const head = [['#', 'Item Description', 'HSN', 'Qty', 'Rate', 'Disc', 'Taxable', 'GST%', 'GST Amt', 'Total']]
  const body = data.calc.items.map((item, i) => [
    String(i + 1),
    item.name + (item.sku ? `\nSKU: ${item.sku}` : ''),
    item.hsnCode || '-',
    String(item.quantity),
    formatCurrency(item.rate),
    item.discount ? formatCurrency(item.discount) : '-',
    formatCurrency(item.amount),
    item.gstApplicable ? `${item.gstRate}%` : '-',
    item.gstApplicable ? formatCurrency(item.gstAmount) : '-',
    formatCurrency(item.total),
  ])

  autoTable(doc, {
    startY: y,
    head: head,
    body: body,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineColor: NEUTRAL.borderLight,
      lineWidth: 0.1,
      textColor: NEUTRAL.textDark,
      font: 'helvetica',
      valign: 'middle',
    },
    headStyles: {
      fillColor: P,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      lineColor: P,
      lineWidth: 0,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { cellWidth: 'auto', fontStyle: 'normal' },
      2: { halign: 'center', cellWidth: 13 },
      3: { halign: 'center', cellWidth: 9 },
      4: { halign: 'right', cellWidth: 17 },
      5: { halign: 'right', cellWidth: 13 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 10 },
      8: { halign: 'right', cellWidth: 17 },
      9: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: NEUTRAL.bgRow },
  })

  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 6

  // ===== TOTALS =====
  const totalsW = 80
  const totalsX = pageWidth - margin - totalsW
  const rowH = 5
  let ty = y

  const drawRow = (label: string, value: string, bold = false, color: [number, number, number] = NEUTRAL.textMid) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...color)
    doc.text(label, totalsX + 2, ty + 3.5)
    doc.text(value, totalsX + totalsW - 2, ty + 3.5, { align: 'right' })
    ty += rowH
  }

  drawRow('Subtotal', formatCurrency(data.calc.subtotal))
  if (data.calc.discount > 0) drawRow('Discount', '- ' + formatCurrency(data.calc.discount))
  if (data.calc.gstAmount > 0) {
    drawRow('SGST (9%)', formatCurrency(data.calc.sgstAmount))
    drawRow('CGST (9%)', formatCurrency(data.calc.cgstAmount))
  }
  if (data.calc.courierCharges > 0) drawRow('Courier', formatCurrency(data.calc.courierCharges))
  if (data.calc.otherCharges > 0) drawRow('Other', formatCurrency(data.calc.otherCharges))

  // Grand total bar
  ty += 1
  doc.setFillColor(...P)
  doc.rect(totalsX, ty, totalsW, rowH + 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...NEUTRAL.white)
  doc.text('GRAND TOTAL', totalsX + 2, ty + 4)
  doc.text(formatCurrency(data.calc.grandTotal), totalsX + totalsW - 2, ty + 4, { align: 'right' })
  ty += rowH + 2

  // Thin border around totals
  doc.setDrawColor(...NEUTRAL.border)
  doc.setLineWidth(0.2)
  doc.line(totalsX, y, totalsX, ty)
  doc.line(totalsX + totalsW, y, totalsX + totalsW, ty)
  doc.line(totalsX, ty, totalsX + totalsW, ty)

  // Amount in words
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...NEUTRAL.textVeryLight)
  doc.text('AMOUNT IN WORDS', margin, y + 3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...NEUTRAL.textDark)
  const wordsText = 'Rupees ' + numberToWords(data.calc.grandTotal) + ' Only'
  const wordsLines = doc.splitTextToSize(wordsText, totalsX - margin - 8)
  doc.text(wordsLines, margin, y + 8)

  y = Math.max(ty, y + 8 + wordsLines.length * 3.5) + 5

  // ===== NOTES & TERMS =====
  if (data.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('NOTES', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...NEUTRAL.textMid)
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
    doc.text(notesLines, margin, y + 4)
    y += 4 + notesLines.length * 3.5 + 3
  }

  if (data.terms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('TERMS & CONDITIONS', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...NEUTRAL.textMid)
    const termsLines = doc.splitTextToSize(data.terms, pageWidth - 2 * margin)
    doc.text(termsLines, margin, y + 4)
    y += 4 + termsLines.length * 3.5 + 3
  }

  // ===== PROMOTIONAL SPACE (minimal) =====
  const signatureY = pageHeight - 30
  const emptySpace = signatureY - y
  if (emptySpace > 20) {
    const adY = y + 5
    const adH = Math.min(emptySpace - 10, 35)
    const adW = pageWidth - 2 * margin

    // Subtle background
    doc.setFillColor(...NEUTRAL.bgRow)
    doc.roundedRect(margin, adY, adW, adH, 1.5, 1.5, 'F')

    // Left accent line
    doc.setFillColor(...A)
    doc.roundedRect(margin, adY, 1, adH, 0.5, 0.5, 'F')

    // Shop name + tagline
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...P)
    doc.text(data.shop.name || 'Smart Computers', margin + 5, adY + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...NEUTRAL.textLight)
    doc.text('SALES & SERVICE', margin + 5, adY + 11)

    // Promo lines
    doc.setFontSize(7.5)
    doc.setTextColor(...NEUTRAL.textMid)
    const promoLines = [
      'Laptops | Desktops | Printers | Accessories | AMC',
      'Sales | Service | Repair | Upgrades | Warranty Support',
    ]
    let promoY = adY + 16
    for (const line of promoLines) {
      doc.text(line, margin + 5, promoY)
      promoY += 3.5
    }

    // Contact on right
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('CONTACT', pageWidth - margin - 5, adY + 7, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...NEUTRAL.textMid)
    if (data.shop.phone) doc.text(data.shop.phone, pageWidth - margin - 5, adY + 11, { align: 'right' })
    if (data.shop.email) doc.text(data.shop.email, pageWidth - margin - 5, adY + 15, { align: 'right' })

    y = adY + adH + 3
  }

  // ===== UPI QR CODE =====
  const qrAmount = isInvoice ? (Number(data.amountDue) || 0) : (Number(data.calc.grandTotal) || 0)
  if (data.shop.upiId && qrAmount > 0) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Smart Computers')}&am=${qrAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.number || '')}`
    try {
      const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      const qrSize = 28
      const qrX = margin
      const qrY = Math.min(y + 3, pageHeight - 55)

      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...P)
      doc.text('Scan to Pay', qrX + qrSize + 4, qrY + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...NEUTRAL.textMid)
      doc.text(`Rs. ${qrAmount.toFixed(2)} | ${data.shop.upiId}`, qrX + qrSize + 4, qrY + 10)
      doc.text(`Ref: ${data.number}`, qrX + qrSize + 4, qrY + 15)

      y = qrY + qrSize + 5
    } catch (e) { /* skip */ }
  }

  // ===== SIGNATURE =====
  if (y < signatureY) y = signatureY
  doc.setDrawColor(...NEUTRAL.textVeryLight)
  doc.setLineWidth(0.3)
  doc.line(pageWidth - margin - 50, y, pageWidth - margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...NEUTRAL.textLight)
  doc.text('Authorised Signatory', pageWidth - margin - 25, y + 4, { align: 'center' })

  // ===== FOOTER (minimal) =====
  doc.setDrawColor(...NEUTRAL.border)
  doc.setLineWidth(0.3)
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...NEUTRAL.textVeryLight)
  doc.text(
    `${isInvoice ? 'Invoice' : 'Quotation'} generated on ${formatDate(new Date())}  |  Computer generated document  |  ${data.shop.name || 'Smart Computers'} — Sales & Service`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  )

  return Buffer.from(doc.output('arraybuffer'))
}

function formatDate(d: Date): string {
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
