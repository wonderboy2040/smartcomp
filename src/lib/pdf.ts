import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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

// Generate PDF as Buffer (server-side)
export function generateInvoicePdf(data: PdfDocData): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 12
  let y = margin

  // === HEADER ===
  // Shop name (large)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(15, 23, 42)
  doc.text(data.shop.name || 'Smart Computers', margin, y + 8)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  let shopInfo = ''
  if (data.shop.address) shopInfo += data.shop.address
  if (data.shop.state) shopInfo += (shopInfo ? ', ' : '') + data.shop.state
  if (shopInfo) {
    doc.text(shopInfo, margin, y + 14)
  }
  let contactInfo = ''
  if (data.shop.phone) contactInfo += 'Ph: ' + data.shop.phone
  if (data.shop.email) contactInfo += (contactInfo ? '  |  ' : '') + data.shop.email
  if (contactInfo) {
    doc.text(contactInfo, margin, y + 18)
  }
  if (data.shop.gstNumber) {
    doc.text('GSTIN: ' + data.shop.gstNumber, margin, y + 22)
  }

  // Doc type and number on right
  const isInvoice = data.docType === 'invoice'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(isInvoice ? 220 : 30, isInvoice ? 38 : 64, isInvoice ? 38 : 175)
  doc.text(isInvoice ? 'TAX INVOICE' : 'QUOTATION', pageWidth - margin, y + 6, { align: 'right' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(`No: ${data.number}`, pageWidth - margin, y + 12, { align: 'right' })
  doc.text(`Date: ${formatDate(data.date)}`, pageWidth - margin, y + 17, { align: 'right' })
  if (data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, pageWidth - margin, y + 22, { align: 'right' })
  }

  y += 28
  // Horizontal line
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  // === BILL TO ===
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(isInvoice ? 'BILL TO' : 'QUOTE TO', margin, y + 4)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(data.customer.name || 'Walk-in Customer', margin, y + 10)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  let cy = y + 15
  if (data.customer.address) {
    const addrLines = doc.splitTextToSize(data.customer.address, 80)
    doc.text(addrLines, margin, cy)
    cy += addrLines.length * 4
  }
  if (data.customer.state) {
    doc.text('State: ' + data.customer.state, margin, cy)
    cy += 4
  }
  if (data.customer.phone) {
    doc.text('Ph: ' + data.customer.phone, margin, cy)
    cy += 4
  }
  if (data.customer.gstNumber) {
    doc.text('GSTIN: ' + data.customer.gstNumber, margin, cy)
    cy += 4
  }

  // Payment details on right
  if (isInvoice) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('PAYMENT DETAILS', pageWidth - margin, y + 4, { align: 'right' })
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(`Type: ${(data.paymentType || 'cash').toUpperCase()}`, pageWidth - margin, y + 10, { align: 'right' })
    doc.text(`Status: ${(data.paymentStatus || 'paid').toUpperCase()}`, pageWidth - margin, y + 15, { align: 'right' })
    if (data.amountPaid !== undefined && data.amountPaid > 0) {
      doc.text(`Paid: ${formatCurrency(data.amountPaid)}`, pageWidth - margin, y + 20, { align: 'right' })
    }
    if (data.amountDue !== undefined && data.amountDue > 0) {
      doc.setTextColor(220, 38, 38)
      doc.text(`Due: ${formatCurrency(data.amountDue)}`, pageWidth - margin, y + 25, { align: 'right' })
    }
  }

  y = Math.max(cy, y + 25) + 5

  // === ITEMS TABLE ===
  const head = [
    [
      '#',
      'Item Description',
      'HSN',
      'Qty',
      'Rate',
      'Disc',
      'Amount',
      'GST%',
      'GST Amt',
      'Total',
    ],
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
      cellPadding: 2,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
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
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // @ts-expect-error - lastAutoTable is added by autoTable plugin
  y = doc.lastAutoTable.finalY + 5

  // === TOTALS ===
  const totalsBoxX = pageWidth - margin - 85
  const totalsBoxW = 85
  const rowH = 5
  let ty = y

  const drawTotalRow = (label: string, value: string, bold = false, color: [number, number, number] = [60, 60, 60]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...color)
    doc.text(label, totalsBoxX + 2, ty + 3.5)
    doc.text(value, totalsBoxX + totalsBoxW - 2, ty + 3.5, { align: 'right' })
    ty += rowH
  }

  // Box border
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  const boxStartY = y

  drawTotalRow('Subtotal:', formatCurrency(data.calc.subtotal))
  if (data.calc.discount > 0) drawTotalRow('Discount:', '- ' + formatCurrency(data.calc.discount))
  drawTotalRow('GST Amount:', formatCurrency(data.calc.gstAmount))
  if (data.calc.courierCharges > 0) drawTotalRow('Courier Charges:', formatCurrency(data.calc.courierCharges))
  if (data.calc.otherCharges > 0) drawTotalRow('Other Charges:', formatCurrency(data.calc.otherCharges))
  
  // Grand total bar
  ty += 1
  doc.setFillColor(15, 23, 42)
  doc.rect(totalsBoxX, ty, totalsBoxW, rowH + 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('GRAND TOTAL:', totalsBoxX + 2, ty + 4)
  doc.text(formatCurrency(data.calc.grandTotal), totalsBoxX + totalsBoxW - 2, ty + 4, { align: 'right' })
  ty += rowH + 2

  // Draw box around totals
  doc.setDrawColor(200, 200, 200)
  doc.rect(totalsBoxX, boxStartY, totalsBoxW, ty - boxStartY)

  // Amount in words (left side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Amount in Words:', margin, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  const wordsText = numberToWords(data.calc.grandTotal)
  const wordsLines = doc.splitTextToSize(wordsText, totalsBoxX - margin - 5)
  doc.text(wordsLines, margin, y + 9)

  y = Math.max(ty, y + 9 + wordsLines.length * 4) + 5

  // === NOTES & TERMS ===
  if (data.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Notes:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
    doc.text(notesLines, margin, y + 4)
    y += 4 + notesLines.length * 4 + 3
  }

  if (data.terms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Terms & Conditions:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const termsLines = doc.splitTextToSize(data.terms, pageWidth - 2 * margin)
    doc.text(termsLines, margin, y + 4)
    y += 4 + termsLines.length * 4 + 3
  }

  // === SIGNATURE ===
  if (y < pageHeight - 40) {
    y = pageHeight - 40
  }
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.3)
  doc.line(pageWidth - margin - 50, y, pageWidth - margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text('Authorised Signatory', pageWidth - margin - 25, y + 5, { align: 'center' })
  doc.text(`For ${data.shop.name}`, pageWidth - margin - 25, y - 1, { align: 'center' })

  // === FOOTER ===
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.text(
    `${isInvoice ? 'Invoice' : 'Quotation'} generated on ${formatDate(new Date())} | This is a computer generated document`,
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
