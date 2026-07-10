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
}

// Premium color palette
const COLORS = {
  primary: [99, 102, 241] as [number, number, number],     // Indigo
  primaryDark: [67, 56, 202] as [number, number, number],   // Deep indigo
  accent: [16, 185, 129] as [number, number, number],       // Emerald
  accentDark: [5, 150, 105] as [number, number, number],    // Deep emerald
  dark: [15, 23, 42] as [number, number, number],           // Slate-900
  textDark: [30, 41, 59] as [number, number, number],       // Slate-800
  textMid: [71, 85, 105] as [number, number, number],       // Slate-600
  textLight: [100, 116, 139] as [number, number, number],   // Slate-500
  bgLight: [241, 245, 249] as [number, number, number],     // Slate-100
  bgLighter: [248, 250, 252] as [number, number, number],   // Slate-50
  white: [255, 255, 255] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],      // Slate-200
  red: [220, 38, 38] as [number, number, number],
}

// Draw a simple computer/laptop icon using rectangles (vector graphics)
function drawTechIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  doc.setFillColor(...color)
  // Monitor base
  doc.roundedRect(x, y, size * 0.8, size * 0.55, 1, 1, 'F')
  // Screen inner
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(x + size * 0.06, y + size * 0.06, size * 0.68, size * 0.43, 0.5, 0.5, 'F')
  // Stand
  doc.setFillColor(...color)
  doc.rect(x + size * 0.3, y + size * 0.55, size * 0.2, size * 0.1, 'F')
  // Base
  doc.roundedRect(x + size * 0.15, y + size * 0.65, size * 0.5, size * 0.06, 1, 1, 'F')
}

// Draw a laptop icon
function drawLaptopIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  doc.setFillColor(...color)
  // Screen
  doc.roundedRect(x + size * 0.15, y, size * 0.7, size * 0.45, 1, 1, 'F')
  // Screen inner
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(x + size * 0.18, y + size * 0.04, size * 0.64, size * 0.37, 0.5, 0.5, 'F')
  // Base
  doc.setFillColor(...color)
  doc.roundedRect(x, y + size * 0.45, size, size * 0.1, 1, 1, 'F')
}

// Draw a printer icon
function drawPrinterIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  doc.setFillColor(...color)
  // Top paper
  doc.rect(x + size * 0.2, y, size * 0.6, size * 0.15, 'F')
  // Body
  doc.roundedRect(x + size * 0.05, y + size * 0.15, size * 0.9, size * 0.35, 1, 1, 'F')
  // Bottom paper
  doc.setFillColor(...COLORS.white)
  doc.rect(x + size * 0.15, y + size * 0.5, size * 0.7, size * 0.2, 'F')
  // LED
  doc.setFillColor(...COLORS.accent)
  doc.circle(x + size * 0.8, y + size * 0.32, size * 0.03, 'F')
}

// Draw decorative tech pattern in header area
function drawTechPattern(doc: jsPDF, x: number, y: number, w: number, h: number, color: [number, number, number], opacity = 0.05) {
  doc.saveGraphicsState()
  doc.setGState(doc.GState({ opacity }))
  doc.setFillColor(...color)
  // Circuit-like lines
  doc.setLineWidth(0.3)
  doc.setDrawColor(...color)
  // Horizontal lines
  for (let i = 0; i < 5; i++) {
    const ly = y + (h / 5) * i + 2
    doc.line(x, ly, x + w, ly)
  }
  // Circuit nodes
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 6; j++) {
      doc.circle(x + 10 + j * 25, y + 5 + i * 10, 1, 'F')
    }
  }
  doc.restoreGraphicsState()
}

// Generate PDF as Buffer (server-side)
export async function generateInvoicePdf(data: PdfDocData): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 14
  let y = 0

  const isInvoice = data.docType === 'invoice'

  // ===== PREMIUM HEADER BANNER =====
  // Full-width gradient-like banner (simulated with overlapping rects)
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, 38, 'F')

  // Darker overlay on right side
  doc.setFillColor(...COLORS.primaryDark)
  doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, 38, 'F')

  // Tech pattern overlay on banner
  drawTechPattern(doc, 0, 0, pageWidth, 38, COLORS.white, 0.08)

  // Tech icons row in banner (decorative)
  drawLaptopIcon(doc, pageWidth - 85, 6, 12, [255, 255, 255])
  drawPrinterIcon(doc, pageWidth - 65, 6, 12, [255, 255, 255])
  drawTechIcon(doc, pageWidth - 45, 6, 12, [255, 255, 255])

  // Shop name (white on banner)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...COLORS.white)
  doc.text(data.shop.name || 'Smart Computers', margin, 14)

  // Shop subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 210, 255)
  let shopInfo = ''
  if (data.shop.address) shopInfo += data.shop.address
  if (data.shop.state) shopInfo += (shopInfo ? ', ' : '') + data.shop.state
  if (shopInfo) {
    const shopLines = doc.splitTextToSize(shopInfo, 120)
    doc.text(shopLines, margin, 20)
  }
  let contactInfo = ''
  if (data.shop.phone) contactInfo += 'Ph: ' + data.shop.phone
  if (data.shop.email) contactInfo += (contactInfo ? '  |  ' : '') + data.shop.email
  if (contactInfo) {
    doc.text(contactInfo, margin, 26)
  }
  if (data.shop.gstNumber) {
    doc.text('GSTIN: ' + data.shop.gstNumber, margin, 31)
  }

  // Doc type on right (white on banner)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...COLORS.white)
  doc.text(isInvoice ? 'TAX INVOICE' : 'QUOTATION', pageWidth - margin, 14, { align: 'right' })

  // Doc number + date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220, 220, 255)
  doc.text(`No: ${data.number}`, pageWidth - margin, 21, { align: 'right' })
  doc.text(`Date: ${formatDate(data.date)}`, pageWidth - margin, 26, { align: 'right' })
  if (data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, pageWidth - margin, 31, { align: 'right' })
  }

  y = 44

  // ===== BILL TO =====
  // Light background box for Bill To
  doc.setFillColor(...COLORS.bgLighter)
  doc.roundedRect(margin, y, 90, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.textLight)
  doc.text(isInvoice ? 'BILL TO' : 'QUOTE TO', margin + 3, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.dark)
  doc.text(data.customer.name || 'Walk-in Customer', margin + 3, y + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.textMid)
  let cy = y + 16
  if (data.customer.address) {
    const addrLines = doc.splitTextToSize(data.customer.address, 85)
    doc.text(addrLines, margin + 3, cy)
    cy += addrLines.length * 3.5
  }
  if (data.customer.phone) {
    doc.text('Ph: ' + data.customer.phone, margin + 3, cy)
    cy += 3.5
  }
  if (data.customer.gstNumber) {
    doc.text('GSTIN: ' + data.customer.gstNumber, margin + 3, cy)
  }

  // Payment details on right (invoice only)
  if (isInvoice) {
    doc.setFillColor(...COLORS.bgLighter)
    doc.roundedRect(pageWidth - margin - 75, y, 75, 28, 2, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textLight)
    doc.text('PAYMENT DETAILS', pageWidth - margin - 72, y + 5)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMid)
    doc.text(`Type: ${(data.paymentType || 'cash').toUpperCase()}`, pageWidth - margin - 72, y + 11)
    doc.text(`Status: ${(data.paymentStatus || 'paid').toUpperCase()}`, pageWidth - margin - 72, y + 16)
    if (data.amountDue !== undefined && data.amountDue > 0) {
      doc.setTextColor(...COLORS.red)
      doc.text(`Due: ${formatCurrency(data.amountDue)}`, pageWidth - margin - 72, y + 22)
    } else if (data.amountPaid !== undefined && data.amountPaid > 0) {
      doc.setTextColor(...COLORS.accent)
      doc.text(`Paid: ${formatCurrency(data.amountPaid)}`, pageWidth - margin - 72, y + 22)
    }
  }

  y += 34

  // ===== ITEMS TABLE =====
  const head = [
    ['#', 'Item Description', 'HSN', 'Qty', 'Rate', 'Disc', 'Amount', 'GST%', 'GST Amt', 'Total'],
  ]
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
      cellPadding: 2.5,
      lineColor: COLORS.border,
      lineWidth: 0.1,
      textColor: COLORS.textDark,
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 15 },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: COLORS.bgLighter },
  })

  // @ts-expect-error - lastAutoTable is added by autoTable plugin
  y = doc.lastAutoTable.finalY + 6

  // ===== TOTALS with SGST/CGST split =====
  const totalsBoxX = pageWidth - margin - 85
  const totalsBoxW = 85
  const rowH = 5.5
  let ty = y

  const drawTotalRow = (label: string, value: string, bold = false, color: [number, number, number] = COLORS.textMid) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...color)
    doc.text(label, totalsBoxX + 3, ty + 4)
    doc.text(value, totalsBoxX + totalsBoxW - 3, ty + 4, { align: 'right' })
    ty += rowH
  }

  const boxStartY = y

  drawTotalRow('Subtotal:', formatCurrency(data.calc.subtotal))
  if (data.calc.discount > 0) drawTotalRow('Discount:', '- ' + formatCurrency(data.calc.discount))

  // SGST + CGST split (only if GST > 0)
  if (data.calc.gstAmount > 0) {
    drawTotalRow('SGST (9%):', formatCurrency(data.calc.sgstAmount))
    drawTotalRow('CGST (9%):', formatCurrency(data.calc.cgstAmount))
  }

  if (data.calc.courierCharges > 0) drawTotalRow('Courier Charges:', formatCurrency(data.calc.courierCharges))
  if (data.calc.otherCharges > 0) drawTotalRow('Other Charges:', formatCurrency(data.calc.otherCharges))

  // Grand total bar (gradient effect)
  ty += 1
  doc.setFillColor(...COLORS.primary)
  doc.rect(totalsBoxX, ty, totalsBoxW, rowH + 1.5, 'F')
  doc.setFillColor(...COLORS.primaryDark)
  doc.rect(totalsBoxX + totalsBoxW * 0.5, ty, totalsBoxW * 0.5, rowH + 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.white)
  doc.text('GRAND TOTAL:', totalsBoxX + 3, ty + 4.5)
  doc.text(formatCurrency(data.calc.grandTotal), totalsBoxX + totalsBoxW - 3, ty + 4.5, { align: 'right' })
  ty += rowH + 2.5

  // Box around totals
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(totalsBoxX, boxStartY, totalsBoxW, ty - boxStartY, 1, 1)

  // Amount in words (left side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.textLight)
  doc.text('Amount in Words:', margin, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textDark)
  const wordsText = numberToWords(data.calc.grandTotal)
  const wordsLines = doc.splitTextToSize(wordsText, totalsBoxX - margin - 8)
  doc.text(wordsLines, margin, y + 9)

  y = Math.max(ty, y + 9 + wordsLines.length * 4) + 5

  // ===== NOTES & TERMS =====
  if (data.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textLight)
    doc.text('Notes:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMid)
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
    doc.text(notesLines, margin, y + 4)
    y += 4 + notesLines.length * 4 + 3
  }

  if (data.terms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textLight)
    doc.text('Terms & Conditions:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMid)
    const termsLines = doc.splitTextToSize(data.terms, pageWidth - 2 * margin)
    doc.text(termsLines, margin, y + 4)
    y += 4 + termsLines.length * 4 + 3
  }

  // ===== UPI QR CODE (for BOTH invoices AND quotations with UPI ID) =====
  const qrAmount = isInvoice ? (Number(data.amountDue) || 0) : (Number(data.calc.grandTotal) || 0)
  if (data.shop.upiId && qrAmount > 0) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Smart Computers')}&am=${qrAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.number || '')}`
    try {
      const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      const qrSize = 32
      const qrX = margin
      const qrY = Math.min(y + 5, pageHeight - 65)

      // QR background box
      doc.setFillColor(...COLORS.bgLighter)
      doc.roundedRect(qrX - 2, qrY - 2, qrSize + 60, qrSize + 4, 2, 2, 'F')

      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      // Label next to QR
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.primary)
      doc.text('Scan to Pay', qrX + qrSize + 5, qrY + 6)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.textMid)
      doc.text(`Amount: Rs. ${qrAmount.toFixed(2)}`, qrX + qrSize + 5, qrY + 12)
      doc.text(`UPI: ${data.shop.upiId}`, qrX + qrSize + 5, qrY + 17)
      doc.text(`Ref: ${data.number}`, qrX + qrSize + 5, qrY + 22)

      doc.setFontSize(7)
      doc.setTextColor(...COLORS.textLight)
      doc.text('Scan with any UPI app', qrX + qrSize + 5, qrY + 27)
      doc.text('(GPay, PhonePe, Paytm)', qrX + qrSize + 5, qrY + 31)

      y = qrY + qrSize + 8
    } catch (e) {
      // QR generation failed — skip silently
    }
  }

  // ===== SIGNATURE =====
  if (y < pageHeight - 40) {
    y = pageHeight - 40
  }
  doc.setDrawColor(...COLORS.textLight)
  doc.setLineWidth(0.3)
  doc.line(pageWidth - margin - 55, y, pageWidth - margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.textMid)
  doc.text('Authorised Signatory', pageWidth - margin - 27, y + 5, { align: 'center' })
  doc.text(`For ${data.shop.name}`, pageWidth - margin - 27, y - 1, { align: 'center' })

  // ===== PREMIUM FOOTER =====
  // Footer banner
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F')
  doc.setFillColor(...COLORS.primaryDark)
  doc.rect(pageWidth * 0.5, pageHeight - 14, pageWidth * 0.5, 14, 'F')

  // Tech icons in footer
  drawLaptopIcon(doc, margin + 5, pageHeight - 11, 6, [255, 255, 255])
  drawPrinterIcon(doc, margin + 15, pageHeight - 11, 6, [255, 255, 255])
  drawTechIcon(doc, margin + 25, pageHeight - 11, 6, [255, 255, 255])

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(220, 220, 255)
  doc.text(
    `${isInvoice ? 'Invoice' : 'Quotation'} generated on ${formatDate(new Date())}  |  This is a computer generated document  |  Smart Computers Sales & Service`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  )

  return Buffer.from(doc.output('arraybuffer'))
}

function formatDate(d: Date): string {
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
