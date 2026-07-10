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

// ===== 5 TALLY GST STYLE TEMPLATES =====
export interface PdfTemplate {
  id: string
  name: string
  description: string
  headerBg: [number, number, number]
  headerText: [number, number, number]
  accent: [number, number, number]
  tableHead: [number, number, number]
  style: 'tally-classic' | 'tally-modern' | 'tally-corporate' | 'tally-elegant' | 'tally-bold'
}

export const PDF_TEMPLATES: PdfTemplate[] = [
  {
    id: 'tally-classic',
    name: 'Tally Classic',
    description: 'Traditional GST — white header, blue accents',
    headerBg: [255, 255, 255],
    headerText: [30, 58, 138],
    accent: [30, 58, 138],
    tableHead: [30, 58, 138],
    style: 'tally-classic',
  },
  {
    id: 'tally-modern',
    name: 'Tally Modern',
    description: 'Sleek dark header with emerald accents',
    headerBg: [17, 24, 39],
    headerText: [255, 255, 255],
    accent: [16, 185, 129],
    tableHead: [17, 24, 39],
    style: 'tally-modern',
  },
  {
    id: 'tally-corporate',
    name: 'Tally Corporate',
    description: 'Navy header with gold accents — formal',
    headerBg: [30, 41, 59],
    headerText: [255, 255, 255],
    accent: [202, 138, 4],
    tableHead: [30, 41, 59],
    style: 'tally-corporate',
  },
  {
    id: 'tally-elegant',
    name: 'Tally Elegant',
    description: 'Maroon header with cream accents — premium',
    headerBg: [127, 29, 29],
    headerText: [255, 255, 255],
    accent: [252, 211, 77],
    tableHead: [127, 29, 29],
    style: 'tally-elegant',
  },
  {
    id: 'tally-bold',
    name: 'Tally Bold',
    description: 'Teal header with orange accents — vibrant',
    headerBg: [19, 78, 74],
    headerText: [255, 255, 255],
    accent: [234, 88, 12],
    tableHead: [19, 78, 74],
    style: 'tally-bold',
  },
]

const N = {
  white: [255, 255, 255] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  textDark: [31, 41, 55] as [number, number, number],
  textMid: [75, 85, 99] as [number, number, number],
  textLight: [107, 114, 128] as [number, number, number],
  textVLight: [156, 163, 175] as [number, number, number],
  bgRow: [249, 250, 251] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  borderLight: [243, 244, 246] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
}

// ===== VECTOR GRAPHICS for promo space =====
function drawLaptop(doc: jsPDF, x: number, y: number, s: number, c: [number, number, number]) {
  doc.setFillColor(...c)
  doc.roundedRect(x + s * 0.1, y, s * 0.8, s * 0.55, 1, 1, 'F')
  doc.setFillColor(...N.white)
  doc.roundedRect(x + s * 0.14, y + s * 0.05, s * 0.72, s * 0.45, 0.5, 0.5, 'F')
  doc.setFillColor(...c)
  doc.setGState(doc.GState({ opacity: 0.2 }))
  doc.rect(x + s * 0.18, y + s * 0.1, s * 0.4, s * 0.025, 'F')
  doc.rect(x + s * 0.18, y + s * 0.16, s * 0.3, s * 0.025, 'F')
  doc.rect(x + s * 0.18, y + s * 0.22, s * 0.45, s * 0.025, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  doc.roundedRect(x, y + s * 0.55, s, s * 0.1, 1, 1, 'F')
}

function drawMonitor(doc: jsPDF, x: number, y: number, s: number, c: [number, number, number]) {
  doc.setFillColor(...c)
  doc.roundedRect(x + s * 0.35, y + s * 0.65, s * 0.3, s * 0.12, 0.5, 0.5, 'F')
  doc.roundedRect(x + s * 0.1, y + s * 0.77, s * 0.8, s * 0.08, 1, 1, 'F')
  doc.roundedRect(x, y, s * 0.95, s * 0.65, 1, 1, 'F')
  doc.setFillColor(...N.white)
  doc.roundedRect(x + s * 0.04, y + s * 0.04, s * 0.87, s * 0.57, 0.5, 0.5, 'F')
  doc.setFillColor(...c)
  doc.setGState(doc.GState({ opacity: 0.12 }))
  doc.rect(x + s * 0.08, y + s * 0.1, s * 0.79, s * 0.45, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
}

function drawPrinter(doc: jsPDF, x: number, y: number, s: number, c: [number, number, number]) {
  doc.setFillColor(...c)
  doc.roundedRect(x + s * 0.15, y, s * 0.7, s * 0.12, 0.5, 0.5, 'F')
  doc.setFillColor(...N.white)
  doc.rect(x + s * 0.2, y + s * 0.03, s * 0.6, s * 0.07, 'F')
  doc.setFillColor(...c)
  doc.roundedRect(x + s * 0.05, y + s * 0.12, s * 0.9, s * 0.35, 1, 1, 'F')
  doc.setFillColor(...N.white)
  doc.roundedRect(x + s * 0.12, y + s * 0.47, s * 0.76, s * 0.25, 0.5, 0.5, 'F')
  doc.setFillColor(...c)
  doc.setGState(doc.GState({ opacity: 0.08 }))
  doc.rect(x + s * 0.18, y + s * 0.51, s * 0.64, s * 0.17, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  doc.setFillColor(...N.red)
  doc.circle(x + s * 0.82, y + s * 0.2, s * 0.025, 'F')
}

function drawChip(doc: jsPDF, x: number, y: number, s: number, c: [number, number, number]) {
  doc.setFillColor(...c)
  doc.roundedRect(x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.7, 1, 1, 'F')
  doc.setFillColor(...N.white)
  doc.roundedRect(x + s * 0.25, y + s * 0.25, s * 0.5, s * 0.5, 0.5, 0.5, 'F')
  doc.setDrawColor(...c)
  doc.setLineWidth(s * 0.02)
  for (let i = 0; i < 4; i++) {
    doc.line(x + s * (0.25 + i * 0.17), y, x + s * (0.25 + i * 0.17), y + s * 0.15)
    doc.line(x + s * (0.25 + i * 0.17), y + s * 0.85, x + s * (0.25 + i * 0.17), y + s)
    doc.line(x, y + s * (0.25 + i * 0.17), x + s * 0.15, y + s * (0.25 + i * 0.17))
    doc.line(x + s * 0.85, y + s * (0.25 + i * 0.17), x + s, y + s * (0.25 + i * 0.17))
  }
  doc.setFillColor(...c)
  doc.circle(x + s * 0.5, y + s * 0.5, s * 0.08, 'F')
}

function drawKeyboard(doc: jsPDF, x: number, y: number, s: number, c: [number, number, number]) {
  doc.setFillColor(...c)
  doc.roundedRect(x, y, s, s * 0.6, 1, 1, 'F')
  doc.setFillColor(...N.white)
  doc.setGState(doc.GState({ opacity: 0.3 }))
  const kw = s * 0.12, kh = s * 0.1, gap = s * 0.02
  for (let r = 0; r < 3; r++)
    for (let col = 0; col < 7; col++)
      doc.roundedRect(x + s * 0.05 + col * (kw + gap), y + s * 0.08 + r * (kh + gap), kw, kh, 0.5, 0.5, 'F')
  doc.setGState(doc.GState({ opacity: 0.2 }))
  doc.roundedRect(x + s * 0.15, y + s * 0.45, s * 0.7, s * 0.08, 0.5, 0.5, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
}

function drawPhone(doc: jsPDF, x: number, y: number, s: number, c: [number, number, number]) {
  doc.setFillColor(...c)
  doc.roundedRect(x + s * 0.25, y, s * 0.5, s, 2, 2, 'F')
  doc.setFillColor(...N.white)
  doc.roundedRect(x + s * 0.28, y + s * 0.08, s * 0.44, s * 0.8, 1, 1, 'F')
  doc.setFillColor(...c)
  doc.setGState(doc.GState({ opacity: 0.15 }))
  doc.rect(x + s * 0.3, y + s * 0.12, s * 0.4, s * 0.15, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  doc.circle(x + s * 0.5, y + s * 0.92, s * 0.02, 'F')
}

function drawPromoGraphics(doc: jsPDF, x: number, y: number, w: number, h: number, color: [number, number, number]) {
  doc.saveGraphicsState()
  doc.setGState(doc.GState({ opacity: 0.08 }))
  const iconSize = Math.min(h * 0.7, 14)
  const iconY = y + (h - iconSize) / 2
  const icons = [drawLaptop, drawMonitor, drawPrinter, drawChip, drawKeyboard, drawPhone]
  const count = Math.floor(w / (iconSize + 8))
  const startX = x + (w - count * (iconSize + 8)) / 2
  for (let i = 0; i < count; i++) {
    icons[i % icons.length](doc, startX + i * (iconSize + 8), iconY, iconSize, color)
  }
  doc.restoreGraphicsState()
}

// Generate PDF
export async function generateInvoicePdf(data: PdfDocData): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  let y = 0

  const isInvoice = data.docType === 'invoice'
  const tpl = PDF_TEMPLATES.find(t => t.id === data.templateId) || PDF_TEMPLATES[0]
  const HB = tpl.headerBg
  const HT = tpl.headerText
  const A = tpl.accent
  const TH = tpl.tableHead

  // ===== HEADER =====
  doc.setFillColor(...HB)
  doc.rect(0, 0, pageWidth, 35, 'F')

  // Accent strip at bottom of header
  doc.setFillColor(...A)
  doc.rect(0, 35, pageWidth, 1.5, 'F')

  y = 8

  // Shop name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...HT)
  doc.text(data.shop.name || 'Smart Computers', margin, y + 5)

  // Shop info
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const subColor = HB[0] > 200 ? N.textMid : [200, 200, 220] as [number, number, number]
  doc.setTextColor(...subColor)
  let infoY = y + 10
  let shopInfo = ''
  if (data.shop.address) shopInfo += data.shop.address
  if (data.shop.state) shopInfo += (shopInfo ? ', ' : '') + data.shop.state
  if (shopInfo) { doc.text(shopInfo, margin, infoY); infoY += 3.5 }
  let contactInfo = ''
  if (data.shop.phone) contactInfo += data.shop.phone
  if (data.shop.email) contactInfo += (contactInfo ? '  |  ' : '') + data.shop.email
  if (contactInfo) { doc.text(contactInfo, margin, infoY); infoY += 3.5 }
  if (data.shop.gstNumber) doc.text('GSTIN: ' + data.shop.gstNumber, margin, infoY)

  // Doc type
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...A)
  doc.text(isInvoice ? 'TAX INVOICE' : 'QUOTATION', pageWidth - margin, y, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...subColor)
  doc.text(`No: ${data.number}`, pageWidth - margin, y + 5, { align: 'right' })
  doc.text(`Date: ${formatDate(data.date)}`, pageWidth - margin, y + 10, { align: 'right' })
  if (data.validTill) doc.text(`Valid Till: ${formatDate(data.validTill)}`, pageWidth - margin, y + 15, { align: 'right' })

  y = 42

  // ===== BILL TO =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...A)
  doc.text(isInvoice ? 'BILL TO' : 'QUOTE TO', margin, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...N.dark)
  doc.text(data.customer.name || 'Walk-in Customer', margin, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...N.textMid)
  let cy = y + 10
  if (data.customer.address) {
    const addrLines = doc.splitTextToSize(data.customer.address, 85)
    doc.text(addrLines, margin, cy); cy += addrLines.length * 3.5
  }
  if (data.customer.phone) { doc.text('Ph: ' + data.customer.phone, margin, cy); cy += 3.5 }
  if (data.customer.gstNumber) doc.text('GSTIN: ' + data.customer.gstNumber, margin, cy)

  if (isInvoice) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('PAYMENT DETAILS', pageWidth - margin, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...N.textMid)
    doc.text(`Type: ${(data.paymentType || 'cash').toUpperCase()}`, pageWidth - margin, y + 5, { align: 'right' })
    doc.text(`Status: ${(data.paymentStatus || 'paid').toUpperCase()}`, pageWidth - margin, y + 10, { align: 'right' })
    if (data.amountDue !== undefined && data.amountDue > 0) {
      doc.setTextColor(...N.red)
      doc.text(`Due: ${formatCurrency(data.amountDue)}`, pageWidth - margin, y + 15, { align: 'right' })
    } else if (data.amountPaid !== undefined && data.amountPaid > 0) {
      doc.setTextColor(...A)
      doc.text(`Paid: ${formatCurrency(data.amountPaid)}`, pageWidth - margin, y + 15, { align: 'right' })
    }
  }

  y = Math.max(cy, y + 20) + 6

  // ===== TABLE (Clean Premium - matching reference design) =====
  const head = [['#', 'Item Description', 'HSN', 'Qty', 'Rate', 'Disc', 'Taxable', 'GST%', 'GST Amt', 'Total']]
  const body = data.calc.items.map((item, i) => [
    String(i + 1),
    item.name + (item.sku ? `\n${item.sku}` : ''),
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
    head, body,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: N.border,
      lineWidth: 0.15,
      textColor: N.textDark,
      font: 'helvetica',
      valign: 'middle',
      overflow: 'linebreak',
      cellWidth: 'auto',
    },
    headStyles: {
      fillColor: TH,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineColor: TH,
      lineWidth: 0,
      valign: 'middle',
    },
    bodyStyles: {
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, fontSize: 7.5 },
      1: { cellWidth: 'auto', fontStyle: 'normal', cellPadding: { left: 3, right: 3 } },
      2: { halign: 'center', cellWidth: 14, fontSize: 7.5 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 15 },
      6: { halign: 'right', cellWidth: 19 },
      7: { halign: 'center', cellWidth: 11, fontSize: 7.5 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: N.bgRow },
    didDrawCell: (data: any) => {
      // Subtle border between rows only (no vertical borders)
      if (data.section === 'body') {
        doc.setDrawColor(...N.borderLight)
        doc.setLineWidth(0.1)
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        )
      }
    },
  })

  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 6

  // ===== TOTALS =====
  const totalsW = 80
  const totalsX = pageWidth - margin - totalsW
  const rowH = 5
  let ty = y

  const drawRow = (label: string, value: string, bold = false, color: [number, number, number] = N.textMid) => {
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

  ty += 1
  doc.setFillColor(...A)
  doc.rect(totalsX, ty, totalsW, rowH + 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...N.white)
  doc.text('GRAND TOTAL', totalsX + 2, ty + 4)
  doc.text(formatCurrency(data.calc.grandTotal), totalsX + totalsW - 2, ty + 4, { align: 'right' })
  ty += rowH + 2

  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.2)
  doc.line(totalsX, y, totalsX, ty)
  doc.line(totalsX + totalsW, y, totalsX + totalsW, ty)
  doc.line(totalsX, ty, totalsX + totalsW, ty)

  // Amount in words
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...N.textVLight)
  doc.text('AMOUNT IN WORDS', margin, y + 3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...N.textDark)
  const wordsLines = doc.splitTextToSize('Rupees ' + numberToWords(data.calc.grandTotal) + ' Only', totalsX - margin - 8)
  doc.text(wordsLines, margin, y + 8)

  y = Math.max(ty, y + 8 + wordsLines.length * 3.5) + 5

  // ===== NOTES & TERMS =====
  if (data.notes) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...A)
    doc.text('NOTES', margin, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...N.textMid)
    const lines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
    doc.text(lines, margin, y + 4)
    y += 4 + lines.length * 3.5 + 3
  }
  if (data.terms) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...A)
    doc.text('TERMS & CONDITIONS', margin, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...N.textMid)
    const lines = doc.splitTextToSize(data.terms, pageWidth - 2 * margin)
    doc.text(lines, margin, y + 4)
    y += 4 + lines.length * 3.5 + 3
  }

  // ===== GRAPHICS PROMO SPACE =====
  const signatureY = pageHeight - 30
  const emptySpace = signatureY - y
  if (emptySpace > 15) {
    const adY = y + 3
    const adH = Math.min(emptySpace - 8, 30)
    const adW = pageWidth - 2 * margin

    // Subtle background
    doc.setFillColor(...N.bgRow)
    doc.roundedRect(margin, adY, adW, adH, 1.5, 1.5, 'F')
    // Left accent
    doc.setFillColor(...A)
    doc.roundedRect(margin, adY, 1, adH, 0.5, 0.5, 'F')

    // Vector graphics strip (laptops, monitors, printers, chips, keyboards, phones)
    drawPromoGraphics(doc, margin + 3, adY, adW * 0.55, adH, A)

    // Shop name + tagline
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.setTextColor(...A)
    doc.text(data.shop.name || 'Smart Computers', margin + adW * 0.58, adY + 6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    doc.setTextColor(...N.textLight)
    doc.text('SALES & SERVICE', margin + adW * 0.58, adY + 10)
    doc.setFontSize(7)
    doc.setTextColor(...N.textMid)
    doc.text('Laptops | Desktops | Printers', margin + adW * 0.58, adY + 15)
    doc.text('Accessories | AMC | Repair', margin + adW * 0.58, adY + 19)

    // Contact
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
    doc.setTextColor(...A)
    doc.text('CONTACT', pageWidth - margin - 3, adY + 6, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.setTextColor(...N.textMid)
    if (data.shop.phone) doc.text(data.shop.phone, pageWidth - margin - 3, adY + 10, { align: 'right' })
    if (data.shop.email) doc.text(data.shop.email, pageWidth - margin - 3, adY + 14, { align: 'right' })

    y = adY + adH + 2
  }

  // ===== UPI QR =====
  const qrAmount = isInvoice ? (Number(data.amountDue) || 0) : (Number(data.calc.grandTotal) || 0)
  if (data.shop.upiId && qrAmount > 0) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Smart Computers')}&am=${qrAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.number || '')}`
    try {
      const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      const qrSize = 26
      const qrX = margin
      const qrY = Math.min(y + 2, pageHeight - 50)
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...A)
      doc.text('Scan to Pay', qrX + qrSize + 4, qrY + 5)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...N.textMid)
      doc.text(`Rs. ${qrAmount.toFixed(2)} | ${data.shop.upiId}`, qrX + qrSize + 4, qrY + 10)
      doc.text(`Ref: ${data.number}`, qrX + qrSize + 4, qrY + 15)
      y = qrY + qrSize + 4
    } catch (e) {}
  }

  // ===== SIGNATURE =====
  if (y < signatureY) y = signatureY
  doc.setDrawColor(...N.textVLight); doc.setLineWidth(0.3)
  doc.line(pageWidth - margin - 50, y, pageWidth - margin, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...N.textLight)
  doc.text('Authorised Signatory', pageWidth - margin - 25, y + 4, { align: 'center' })

  // ===== FOOTER =====
  doc.setDrawColor(...N.border); doc.setLineWidth(0.3)
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...N.textVLight)
  doc.text(
    `${isInvoice ? 'Invoice' : 'Quotation'} generated on ${formatDate(new Date())}  |  Computer generated document  |  ${data.shop.name || 'Smart Computers'} — Sales & Service`,
    pageWidth / 2, pageHeight - 7, { align: 'center' }
  )

  return Buffer.from(doc.output('arraybuffer'))
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
