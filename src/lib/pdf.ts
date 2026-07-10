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
  primary: [99, 102, 241] as [number, number, number],
  primaryDark: [67, 56, 202] as [number, number, number],
  primaryLight: [129, 140, 248] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number],
  accentDark: [5, 150, 105] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  textDark: [30, 41, 59] as [number, number, number],
  textMid: [71, 85, 105] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
  bgLight: [241, 245, 249] as [number, number, number],
  bgLighter: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  gold: [234, 179, 8] as [number, number, number],
}

// ===== VECTOR GRAPHIC DRAWING FUNCTIONS =====

// Draw a detailed laptop icon
function drawLaptopIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  // Screen bezel
  doc.setFillColor(...color)
  doc.roundedRect(x + size * 0.12, y, size * 0.76, size * 0.5, size * 0.03, size * 0.03, 'F')
  // Screen inner
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(x + size * 0.15, y + size * 0.04, size * 0.7, size * 0.42, size * 0.015, size * 0.015, 'F')
  // Screen content lines (code-like)
  doc.setFillColor(...color)
  doc.setGState(doc.GState({ opacity: 0.3 }))
  doc.rect(x + size * 0.2, y + size * 0.1, size * 0.3, size * 0.02, 'F')
  doc.rect(x + size * 0.2, y + size * 0.16, size * 0.2, size * 0.02, 'F')
  doc.rect(x + size * 0.2, y + size * 0.22, size * 0.35, size * 0.02, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  // Base
  doc.setFillColor(...color)
  doc.roundedRect(x, y + size * 0.5, size, size * 0.1, size * 0.02, size * 0.02, 'F')
  // Trackpad hint
  doc.setFillColor(255, 255, 255)
  doc.setGState(doc.GState({ opacity: 0.3 }))
  doc.rect(x + size * 0.35, y + size * 0.52, size * 0.3, size * 0.02, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
}

// Draw a detailed monitor icon
function drawMonitorIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  // Stand neck
  doc.setFillColor(...color)
  doc.roundedRect(x + size * 0.35, y + size * 0.62, size * 0.3, size * 0.15, 1, 1, 'F')
  // Stand base
  doc.roundedRect(x + size * 0.15, y + size * 0.75, size * 0.7, size * 0.08, 1, 1, 'F')
  // Monitor body
  doc.roundedRect(x, y, size * 0.9, size * 0.62, size * 0.03, size * 0.03, 'F')
  // Screen
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(x + size * 0.03, y + size * 0.04, size * 0.84, size * 0.54, size * 0.015, size * 0.015, 'F')
  // Screen content (window)
  doc.setFillColor(...color)
  doc.setGState(doc.GState({ opacity: 0.15 }))
  doc.rect(x + size * 0.08, y + size * 0.1, size * 0.74, size * 0.4, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  // Title bar
  doc.setFillColor(...color)
  doc.setGState(doc.GState({ opacity: 0.3 }))
  doc.rect(x + size * 0.08, y + size * 0.1, size * 0.74, size * 0.06, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  // Window dots
  doc.setFillColor(...COLORS.red)
  doc.circle(x + size * 0.11, y + size * 0.13, size * 0.012, 'F')
  doc.setFillColor(...COLORS.gold)
  doc.circle(x + size * 0.15, y + size * 0.13, size * 0.012, 'F')
  doc.setFillColor(...COLORS.accent)
  doc.circle(x + size * 0.19, y + size * 0.13, size * 0.012, 'F')
}

// Draw a printer icon
function drawPrinterIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  // Top paper tray
  doc.setFillColor(...color)
  doc.roundedRect(x + size * 0.15, y, size * 0.7, size * 0.12, 1, 1, 'F')
  // Paper sheet coming out
  doc.setFillColor(...COLORS.white)
  doc.rect(x + size * 0.2, y + size * 0.03, size * 0.6, size * 0.08, 'F')
  doc.setFillColor(...color)
  doc.setGState(doc.GState({ opacity: 0.2 }))
  doc.rect(x + size * 0.25, y + size * 0.05, size * 0.4, size * 0.015, 'F')
  doc.rect(x + size * 0.25, y + size * 0.08, size * 0.3, size * 0.015, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  // Body
  doc.setFillColor(...color)
  doc.roundedRect(x + size * 0.05, y + size * 0.12, size * 0.9, size * 0.38, size * 0.02, size * 0.02, 'F')
  // Output tray
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(x + size * 0.12, y + size * 0.5, size * 0.76, size * 0.25, 1, 1, 'F')
  // Paper in output
  doc.setFillColor(...color)
  doc.setGState(doc.GState({ opacity: 0.1 }))
  doc.rect(x + size * 0.18, y + size * 0.54, size * 0.64, size * 0.18, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  // LED
  doc.setFillColor(...COLORS.accent)
  doc.circle(x + size * 0.82, y + size * 0.2, size * 0.025, 'F')
  // Button
  doc.setFillColor(...color)
  doc.setGState(doc.GState({ opacity: 0.5 }))
  doc.roundedRect(x + size * 0.7, y + size * 0.32, size * 0.12, size * 0.04, 1, 1, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
}

// Draw a chip/CPU icon
function drawChipIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  // Body
  doc.setFillColor(...color)
  doc.roundedRect(x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.7, size * 0.05, size * 0.05, 'F')
  // Inner
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(x + size * 0.25, y + size * 0.25, size * 0.5, size * 0.5, size * 0.03, size * 0.03, 'F')
  // Circuit lines from chip
  doc.setDrawColor(...color)
  doc.setLineWidth(size * 0.02)
  // Top pins
  for (let i = 0; i < 4; i++) {
    const px = x + size * (0.25 + i * 0.17)
    doc.line(px, y, px, y + size * 0.15)
  }
  // Bottom pins
  for (let i = 0; i < 4; i++) {
    const px = x + size * (0.25 + i * 0.17)
    doc.line(px, y + size * 0.85, px, y + size)
  }
  // Left pins
  for (let i = 0; i < 4; i++) {
    const py = y + size * (0.25 + i * 0.17)
    doc.line(x, py, x + size * 0.15, py)
  }
  // Right pins
  for (let i = 0; i < 4; i++) {
    const py = y + size * (0.25 + i * 0.17)
    doc.line(x + size * 0.85, py, x + size, py)
  }
  // Inner dot
  doc.setFillColor(...color)
  doc.circle(x + size * 0.5, y + size * 0.5, size * 0.08, 'F')
}

// Draw a keyboard icon
function drawKeyboardIcon(doc: jsPDF, x: number, y: number, size: number, color: [number, number, number]) {
  doc.setFillColor(...color)
  doc.roundedRect(x, y, size, size * 0.6, size * 0.03, size * 0.03, 'F')
  // Keys
  doc.setFillColor(...COLORS.white)
  doc.setGState(doc.GState({ opacity: 0.4 }))
  const keyW = size * 0.12
  const keyH = size * 0.1
  const gap = size * 0.02
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 7; col++) {
      doc.roundedRect(
        x + size * 0.05 + col * (keyW + gap),
        y + size * 0.08 + row * (keyH + gap),
        keyW, keyH, 0.5, 0.5, 'F'
      )
    }
  }
  doc.setGState(doc.GState({ opacity: 1 }))
  // Spacebar
  doc.setFillColor(...COLORS.white)
  doc.setGState(doc.GState({ opacity: 0.3 }))
  doc.roundedRect(x + size * 0.15, y + size * 0.45, size * 0.7, size * 0.08, 1, 1, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
}

// Draw decorative circuit board pattern
function drawCircuitPattern(doc: jsPDF, x: number, y: number, w: number, h: number, color: [number, number, number], opacity = 0.05) {
  doc.saveGraphicsState()
  doc.setGState(doc.GState({ opacity }))
  doc.setDrawColor(...color)
  doc.setLineWidth(0.3)
  // Horizontal circuit traces
  const lines = [
    [{ x: 0, y: 0.2 }, { x: 0.3, y: 0.2 }, { x: 0.3, y: 0.5 }, { x: 0.6, y: 0.5 }, { x: 0.6, y: 0.3 }, { x: 1, y: 0.3 }],
    [{ x: 0, y: 0.7 }, { x: 0.2, y: 0.7 }, { x: 0.2, y: 0.85 }, { x: 0.8, y: 0.85 }, { x: 0.8, y: 0.6 }, { x: 1, y: 0.6 }],
    [{ x: 0, y: 0.45 }, { x: 0.15, y: 0.45 }, { x: 0.15, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.95 }, { x: 1, y: 0.95 }],
  ]
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      doc.line(
        x + line[i].x * w, y + line[i].y * h,
        x + line[i + 1].x * w, y + line[i + 1].y * h
      )
    }
  }
  // Circuit nodes (dots at corners)
  const nodes = [
    [0.3, 0.2], [0.3, 0.5], [0.6, 0.5], [0.6, 0.3],
    [0.2, 0.7], [0.2, 0.85], [0.8, 0.85], [0.8, 0.6],
    [0.15, 0.45], [0.15, 0.1], [0.5, 0.1], [0.5, 0.95],
  ]
  doc.setFillColor(...color)
  for (const [nx, ny] of nodes) {
    doc.circle(x + nx * w, y + ny * h, 0.8, 'F')
  }
  doc.restoreGraphicsState()
}

// Draw a "Smart Computers" branded watermark in empty space
function drawWatermark(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.saveGraphicsState()
  doc.setGState(doc.GState({ opacity: 0.04 }))
  // Large faded shop name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(...COLORS.primary)
  doc.text('SMART', x + w / 2, y + h / 2 - 8, { align: 'center' })
  doc.text('COMPUTERS', x + w / 2, y + h / 2 + 8, { align: 'center' })
  // Tagline
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.accent)
  doc.text('SALES & SERVICE', x + w / 2, y + h / 2 + 18, { align: 'center' })
  doc.restoreGraphicsState()
}

// Draw decorative tech strip in empty space
function drawTechStrip(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.saveGraphicsState()
  doc.setGState(doc.GState({ opacity: 0.06 }))
  // Draw a row of tech icons across the strip
  const iconSize = Math.min(h * 0.6, 10)
  const iconCount = Math.floor(w / (iconSize + 5))
  const startX = x + (w - iconCount * (iconSize + 5)) / 2
  for (let i = 0; i < iconCount; i++) {
    const ix = startX + i * (iconSize + 5)
    const iy = y + (h - iconSize) / 2
    switch (i % 5) {
      case 0: drawLaptopIcon(doc, ix, iy, iconSize, COLORS.primary); break
      case 1: drawMonitorIcon(doc, ix, iy, iconSize, COLORS.accent); break
      case 2: drawPrinterIcon(doc, ix, iy, iconSize, COLORS.primaryDark); break
      case 3: drawChipIcon(doc, ix, iy, iconSize, COLORS.accentDark); break
      case 4: drawKeyboardIcon(doc, ix, iy, iconSize, COLORS.primaryLight); break
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
  // Full-width gradient-like banner
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, 42, 'F')
  // Darker overlay on right
  doc.setFillColor(...COLORS.primaryDark)
  doc.rect(pageWidth * 0.5, 0, pageWidth * 0.5, 42, 'F')
  // Circuit pattern overlay
  drawCircuitPattern(doc, 0, 0, pageWidth, 42, COLORS.white, 0.07)

  // Tech icons in header right (decorative row)
  const hdrIconSize = 14
  const hdrIconY = 8
  drawLaptopIcon(doc, pageWidth - 88, hdrIconY, hdrIconSize, [255, 255, 255])
  drawMonitorIcon(doc, pageWidth - 68, hdrIconY, hdrIconSize, [255, 255, 255])
  drawPrinterIcon(doc, pageWidth - 48, hdrIconY, hdrIconSize, [255, 255, 255])
  drawChipIcon(doc, pageWidth - 28, hdrIconY + 2, hdrIconSize - 4, [255, 255, 255])

  // Shop name (white on banner)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...COLORS.white)
  doc.text(data.shop.name || 'Smart Computers', margin, 15)

  // Shop subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 210, 255)
  let shopInfo = ''
  if (data.shop.address) shopInfo += data.shop.address
  if (data.shop.state) shopInfo += (shopInfo ? ', ' : '') + data.shop.state
  if (shopInfo) {
    const shopLines = doc.splitTextToSize(shopInfo, 120)
    doc.text(shopLines, margin, 21)
  }
  let contactInfo = ''
  if (data.shop.phone) contactInfo += 'Ph: ' + data.shop.phone
  if (data.shop.email) contactInfo += (contactInfo ? '  |  ' : '') + data.shop.email
  if (contactInfo) {
    doc.text(contactInfo, margin, 28)
  }
  if (data.shop.gstNumber) {
    doc.text('GSTIN: ' + data.shop.gstNumber, margin, 33)
  }

  // Doc type on right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...COLORS.white)
  doc.text(isInvoice ? 'TAX INVOICE' : 'QUOTATION', pageWidth - margin, 30, { align: 'right' })

  // Doc number + date below banner
  y = 46
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.primary)
  doc.text(`No: ${data.number}`, margin, y)
  doc.setTextColor(...COLORS.textMid)
  doc.setFont('helvetica', 'normal')
  doc.text(`Date: ${formatDate(data.date)}`, margin + 60, y)
  if (data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, margin + 110, y)
  }

  y += 6

  // ===== BILL TO =====
  doc.setFillColor(...COLORS.bgLighter)
  doc.roundedRect(margin, y, 95, 30, 2, 2, 'F')
  // Left accent bar
  doc.setFillColor(...COLORS.primary)
  doc.roundedRect(margin, y, 1.5, 30, 0.5, 0.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.primary)
  doc.text(isInvoice ? 'BILL TO' : 'QUOTE TO', margin + 5, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.dark)
  doc.text(data.customer.name || 'Walk-in Customer', margin + 5, y + 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.textMid)
  let cy = y + 17
  if (data.customer.address) {
    const addrLines = doc.splitTextToSize(data.customer.address, 88)
    doc.text(addrLines, margin + 5, cy)
    cy += addrLines.length * 3.5
  }
  if (data.customer.phone) {
    doc.text('Ph: ' + data.customer.phone, margin + 5, cy)
    cy += 3.5
  }
  if (data.customer.gstNumber) {
    doc.text('GSTIN: ' + data.customer.gstNumber, margin + 5, cy)
  }

  // Payment details on right (invoice only)
  if (isInvoice) {
    doc.setFillColor(...COLORS.bgLighter)
    doc.roundedRect(pageWidth - margin - 75, y, 75, 30, 2, 2, 'F')
    doc.setFillColor(...COLORS.accent)
    doc.roundedRect(pageWidth - margin - 75, y, 1.5, 30, 0.5, 0.5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.accent)
    doc.text('PAYMENT DETAILS', pageWidth - margin - 70, y + 5)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMid)
    doc.text(`Type: ${(data.paymentType || 'cash').toUpperCase()}`, pageWidth - margin - 70, y + 12)
    doc.text(`Status: ${(data.paymentStatus || 'paid').toUpperCase()}`, pageWidth - margin - 70, y + 17)
    if (data.amountDue !== undefined && data.amountDue > 0) {
      doc.setTextColor(...COLORS.red)
      doc.text(`Due: ${formatCurrency(data.amountDue)}`, pageWidth - margin - 70, y + 23)
    } else if (data.amountPaid !== undefined && data.amountPaid > 0) {
      doc.setTextColor(...COLORS.accent)
      doc.text(`Paid: ${formatCurrency(data.amountPaid)}`, pageWidth - margin - 70, y + 23)
    }
  }

  y += 36

  // ===== ITEMS TABLE (Premium) =====
  const head = [
    ['#', 'Item Description', 'HSN', 'Qty', 'Rate', 'Disc', 'Taxable', 'GST%', 'GST Amt', 'Total'],
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
      cellPadding: 3,
      lineColor: COLORS.border,
      lineWidth: 0.1,
      textColor: COLORS.textDark,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 13 },
      3: { halign: 'center', cellWidth: 9 },
      4: { halign: 'right', cellWidth: 17 },
      5: { halign: 'right', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 19 },
      7: { halign: 'center', cellWidth: 11 },
      8: { halign: 'right', cellWidth: 17 },
      9: { halign: 'right', cellWidth: 21, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: COLORS.bgLighter },
    didDrawPage: () => {},
  })

  // @ts-expect-error - lastAutoTable is added by autoTable plugin
  y = doc.lastAutoTable.finalY + 6

  // ===== EMPTY SPACE GRAPHICS (between table and totals) =====
  // If there's enough empty space, fill with watermark + tech strip
  const totalsStartY = y
  const totalsHeight = 40 // estimated
  const signatureY = pageHeight - 45
  const emptySpace = signatureY - (totalsStartY + totalsHeight)
  if (emptySpace > 30) {
    // Watermark in center of empty space
    const wmY = totalsStartY + totalsHeight + 5
    const wmH = Math.min(emptySpace - 10, 60)
    drawWatermark(doc, margin, wmY, pageWidth - 2 * margin, wmH)
    // Tech strip at bottom of empty space
    if (emptySpace > 50) {
      drawTechStrip(doc, margin, signatureY - 20, pageWidth - 2 * margin, 12)
    }
  }

  // ===== TOTALS with SGST/CGST =====
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

  if (data.calc.gstAmount > 0) {
    drawTotalRow('SGST (9%):', formatCurrency(data.calc.sgstAmount))
    drawTotalRow('CGST (9%):', formatCurrency(data.calc.cgstAmount))
  }

  if (data.calc.courierCharges > 0) drawTotalRow('Courier:', formatCurrency(data.calc.courierCharges))
  if (data.calc.otherCharges > 0) drawTotalRow('Other:', formatCurrency(data.calc.otherCharges))

  // Grand total bar
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

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(totalsBoxX, boxStartY, totalsBoxW, ty - boxStartY, 1, 1)

  // Amount in words
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
    doc.setTextColor(...COLORS.primary)
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
    doc.setTextColor(...COLORS.primary)
    doc.text('Terms & Conditions:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMid)
    const termsLines = doc.splitTextToSize(data.terms, pageWidth - 2 * margin)
    doc.text(termsLines, margin, y + 4)
    y += 4 + termsLines.length * 4 + 3
  }

  // ===== UPI QR CODE (for BOTH invoices AND quotations) =====
  const qrAmount = isInvoice ? (Number(data.amountDue) || 0) : (Number(data.calc.grandTotal) || 0)
  if (data.shop.upiId && qrAmount > 0) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Smart Computers')}&am=${qrAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.number || '')}`
    try {
      const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      const qrSize = 34
      const qrX = margin
      const qrY = Math.min(y + 5, pageHeight - 70)

      // QR premium background box
      doc.setFillColor(...COLORS.bgLighter)
      doc.roundedRect(qrX - 3, qrY - 3, qrSize + 65, qrSize + 6, 3, 3, 'F')
      // Accent left border
      doc.setFillColor(...COLORS.primary)
      doc.roundedRect(qrX - 3, qrY - 3, 1.5, qrSize + 6, 0.5, 0.5, 'F')

      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...COLORS.primary)
      doc.text('Scan to Pay', qrX + qrSize + 5, qrY + 7)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.textMid)
      doc.text(`Amount: Rs. ${qrAmount.toFixed(2)}`, qrX + qrSize + 5, qrY + 13)
      doc.text(`UPI: ${data.shop.upiId}`, qrX + qrSize + 5, qrY + 18)
      doc.text(`Ref: ${data.number}`, qrX + qrSize + 5, qrY + 23)

      doc.setFontSize(7)
      doc.setTextColor(...COLORS.textLight)
      doc.text('Scan with any UPI app', qrX + qrSize + 5, qrY + 29)
      doc.text('(GPay, PhonePe, Paytm)', qrX + qrSize + 5, qrY + 33)

      y = qrY + qrSize + 8
    } catch (e) {
      // skip
    }
  }

  // ===== SIGNATURE =====
  if (y < pageHeight - 42) {
    y = pageHeight - 42
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
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, pageHeight - 16, pageWidth, 16, 'F')
  doc.setFillColor(...COLORS.primaryDark)
  doc.rect(pageWidth * 0.5, pageHeight - 16, pageWidth * 0.5, 16, 'F')
  drawCircuitPattern(doc, 0, pageHeight - 16, pageWidth, 16, COLORS.white, 0.06)

  // Footer tech icons
  drawLaptopIcon(doc, margin + 2, pageHeight - 12, 7, [255, 255, 255])
  drawMonitorIcon(doc, margin + 12, pageHeight - 12, 7, [255, 255, 255])
  drawPrinterIcon(doc, margin + 22, pageHeight - 12, 7, [255, 255, 255])
  drawChipIcon(doc, margin + 32, pageHeight - 11, 5, [255, 255, 255])
  drawKeyboardIcon(doc, margin + 39, pageHeight - 12, 7, [255, 255, 255])

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(220, 220, 255)
  doc.text(
    `${isInvoice ? 'Invoice' : 'Quotation'} generated on ${formatDate(new Date())}  |  Computer generated document  |  ${data.shop.name || 'Smart Computers'} - Sales & Service`,
    pageWidth / 2,
    pageHeight - 7,
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
