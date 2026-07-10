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

// Draw premium tech icons using jsPDF vector operations
function drawTechGraphics(doc: jsPDF, x: number, y: number) {
  // Save current colors
  doc.saveGraphicsState()
  
  // Color palette
  const primaryColor = [15, 23, 42] // Slate 900
  const accentColor = [14, 165, 233] // Sky 500
  const lightColor = [224, 242, 254] // Sky 100

  // 1. Sleek Laptop Icon
  let bx = x
  let by = y
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(bx + 1, by, 10, 6, 'F') // screen body
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
  doc.rect(bx + 2, by + 1, 8, 4, 'F') // screen inner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(bx, by + 6, 12, 1, 'F') // keyboard base
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.setLineWidth(0.3)
  doc.line(bx + 5, by + 7, bx + 7, by + 7) // touchpad line

  // 2. Printer Icon
  bx = x + 16
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(bx, by + 2, 10, 4, 'F') // printer main body
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
  doc.rect(bx + 2, by, 6, 2, 'F') // paper top input
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2])
  doc.rect(bx + 2, by + 6, 6, 2, 'F') // paper bottom output
  
  // 3. Desktop / Monitor Icon
  bx = x + 30
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(bx, by, 9, 6, 'F') // monitor screen
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
  doc.rect(bx + 1, by + 1, 7, 4, 'F') // screen inner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(bx + 3.5, by + 6, 2, 1.5, 'F') // stand
  doc.rect(bx + 2, by + 7.5, 5, 0.5, 'F') // stand base

  // Decorator lines
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2])
  doc.setLineWidth(0.4)
  doc.line(x - 5, by + 9, x + 45, by + 9)
  
  doc.restoreGraphicsState()
}

// Generate PDF as Buffer (server-side)
export async function generateInvoicePdf(data: PdfDocData): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 12
  let y = margin

  // Modern Accent top bar
  const isInvoice = data.docType === 'invoice'
  const brandColor: [number, number, number] = isInvoice ? [15, 23, 42] : [9, 79, 76] // Slate vs Forest green
  const accentHex = isInvoice ? '#0ea5e9' : '#10b981' // Sky blue vs Emerald green
  const accentRGB = isInvoice ? [14, 165, 233] : [16, 185, 129]

  // Top header color strip
  doc.setFillColor(brandColor[0], brandColor[1], brandColor[2])
  doc.rect(0, 0, pageWidth, 4, 'F')
  
  doc.setFillColor(accentRGB[0], accentRGB[1], accentRGB[2])
  doc.rect(0, 4, pageWidth, 1.5, 'F')

  y += 4

  // === HEADER ===
  // Shop name (large)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
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
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('GSTIN: ' + data.shop.gstNumber, margin, y + 22)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
  }

  // Draw Tech Graphics on Top Right
  drawTechGraphics(doc, pageWidth - margin - 40, y + 2)

  // Document details banner/ribbon on right side
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(brandColor[0], brandColor[1], brandColor[2])
  doc.text(isInvoice ? 'TAX INVOICE' : 'QUOTATION', pageWidth - margin, y + 18, { align: 'right' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(`No: ${data.number}`, pageWidth - margin, y + 23, { align: 'right' })
  doc.text(`Date: ${formatDate(data.date)}`, pageWidth - margin, y + 27, { align: 'right' })
  if (data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, pageWidth - margin, y + 31, { align: 'right' })
  }

  y += 35
  
  // Separator line
  doc.setDrawColor(220, 225, 230)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  // === BILL TO ===
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(120, 130, 140)
  doc.text(isInvoice ? 'BILL TO' : 'QUOTE TO', margin, y + 4)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
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
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('GSTIN: ' + data.customer.gstNumber, margin, cy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    cy += 4
  }

  // Payment details on right (Invoices only)
  if (isInvoice) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(120, 130, 140)
    doc.text('PAYMENT DETAILS', pageWidth - margin, y + 4, { align: 'right' })
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(`Type: ${(data.paymentType || 'cash').toUpperCase()}`, pageWidth - margin, y + 10, { align: 'right' })
    doc.text(`Status: ${(data.paymentStatus || 'paid').toUpperCase()}`, pageWidth - margin, y + 15, { align: 'right' })
    if (data.amountPaid !== undefined && data.amountPaid > 0) {
      doc.text(`Paid: ${formatCurrency(data.amountPaid)}`, pageWidth - margin, y + 20, { align: 'right' })
    }
    if (data.amountDue !== undefined && data.amountDue > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(220, 38, 38)
      doc.text(`Due: ${formatCurrency(data.amountDue)}`, pageWidth - margin, y + 25, { align: 'right' })
    }
  }

  y = Math.max(cy, y + 25) + 5

  // === ITEMS TABLE ===
  // Splitting GST 18% into CGST 9% and SGST 9% columns
  const head = [
    [
      '#',
      'Item Description',
      'HSN',
      'Qty',
      'Rate',
      'Disc',
      'Taxable Val',
      'CGST %',
      'CGST Amt',
      'SGST %',
      'SGST Amt',
      'Total',
    ],
  ]
  
  const body = data.calc.items.map((item, i) => {
    const cgstRate = item.gstApplicable ? item.gstRate / 2 : 0
    const cgstAmount = item.gstApplicable ? item.gstAmount / 2 : 0
    const sgstRate = item.gstApplicable ? item.gstRate / 2 : 0
    const sgstAmount = item.gstApplicable ? item.gstAmount / 2 : 0
    
    return [
      String(i + 1),
      item.name + (item.sku ? `\nSKU: ${item.sku}` : ''),
      item.hsnCode || '-',
      String(item.quantity),
      formatCurrency(item.rate).replace('Rs. ', ''),
      item.discount ? formatCurrency(item.discount).replace('Rs. ', '') : '-',
      formatCurrency(item.amount).replace('Rs. ', ''),
      item.gstApplicable ? `${cgstRate}%` : '-',
      item.gstApplicable ? formatCurrency(cgstAmount).replace('Rs. ', '') : '-',
      item.gstApplicable ? `${sgstRate}%` : '-',
      item.gstApplicable ? formatCurrency(sgstAmount).replace('Rs. ', '') : '-',
      formatCurrency(item.total).replace('Rs. ', ''),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: head,
    body: body,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      lineColor: [220, 225, 230],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: brandColor,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 6 },
      1: { halign: 'left' }, // auto layout
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 12 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 11 },
      8: { halign: 'right', cellWidth: 15 },
      9: { halign: 'center', cellWidth: 11 },
      10: { halign: 'right', cellWidth: 15 },
      11: { halign: 'right', cellWidth: 20 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // @ts-expect-error - lastAutoTable is added by autoTable plugin
  y = doc.lastAutoTable.finalY + 5

  // === TOTALS ===
  const totalsBoxX = pageWidth - margin - 85
  const totalsBoxW = 85
  const rowH = 5.5
  let ty = y

  const drawTotalRow = (label: string, value: string, bold = false, color: [number, number, number] = [60, 60, 60]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...color)
    doc.text(label, totalsBoxX + 3, ty + 4)
    doc.text(value, totalsBoxX + totalsBoxW - 3, ty + 4, { align: 'right' })
    ty += rowH
  }

  // Box border
  const boxStartY = y

  drawTotalRow('Subtotal (Taxable Value):', formatCurrency(data.calc.subtotal))
  if (data.calc.discount > 0) drawTotalRow('Discount:', '- ' + formatCurrency(data.calc.discount))
  
  // Detailed CGST & SGST Split
  const halfGst = data.calc.gstAmount / 2
  drawTotalRow('CGST Amount (9%):', formatCurrency(halfGst))
  drawTotalRow('SGST Amount (9%):', formatCurrency(halfGst))
  
  if (data.calc.courierCharges > 0) drawTotalRow('Courier Charges:', formatCurrency(data.calc.courierCharges))
  if (data.calc.otherCharges > 0) drawTotalRow('Other Charges:', formatCurrency(data.calc.otherCharges))
  
  // Grand total bar
  ty += 1
  doc.setFillColor(brandColor[0], brandColor[1], brandColor[2])
  doc.rect(totalsBoxX, ty, totalsBoxW, rowH + 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(255, 255, 255)
  doc.text('GRAND TOTAL:', totalsBoxX + 3, ty + 4.5)
  doc.text(formatCurrency(data.calc.grandTotal), totalsBoxX + totalsBoxW - 3, ty + 4.5, { align: 'right' })
  ty += rowH + 2

  // Draw border around totals box
  doc.setDrawColor(200, 205, 210)
  doc.setLineWidth(0.3)
  doc.rect(totalsBoxX, boxStartY, totalsBoxW, ty - boxStartY)

  // Amount in words (left side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(120, 130, 140)
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
    doc.setTextColor(120, 130, 140)
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
    doc.setTextColor(120, 130, 140)
    doc.text('Terms & Conditions:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const termsLines = doc.splitTextToSize(data.terms, pageWidth - 2 * margin)
    doc.text(termsLines, margin, y + 4)
    y += 4 + termsLines.length * 4 + 3
  }

  // === UPI QR CODE (for BOTH invoice and quotation with UPI ID configured) ===
  const amountForQr = isInvoice ? (Number(data.amountDue) || 0) : data.calc.grandTotal
  
  if (data.shop.upiId && amountForQr > 0) {
    // Build UPI deep link: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR&tn=REF_NO
    const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Smart Computers')}&am=${amountForQr.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.number || '')}`
    try {
      const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      const qrSize = 30
      const qrX = margin
      const qrY = Math.min(y + 5, pageHeight - 62)
      
      // Draw a subtle border around the QR section
      doc.setDrawColor(230, 235, 240)
      doc.setFillColor(250, 251, 252)
      doc.rect(qrX - 2, qrY - 2, qrSize + 55, qrSize + 4, 'FD')
      
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
      
      // Label next to QR
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42)
      doc.text('Scan to Pay via UPI', qrX + qrSize + 4, qrY + 5)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)
      doc.text(`Amount: Rs. ${amountForQr.toFixed(2)}`, qrX + qrSize + 4, qrY + 11)
      doc.text(`UPI ID: ${data.shop.upiId}`, qrX + qrSize + 4, qrY + 16)
      doc.text(`Ref No: ${data.number}`, qrX + qrSize + 4, qrY + 21)
      
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text('Scan with GPay, PhonePe, Paytm or any UPI App', qrX + qrSize + 4, qrY + 27)
      
      y = qrY + qrSize + 5
    } catch (e) {
      // QR generation failed — skip silently
    }
  }

  // === SIGNATURE ===
  if (y < pageHeight - 40) {
    y = pageHeight - 40
  }
  doc.setDrawColor(180, 185, 190)
  doc.setLineWidth(0.3)
  doc.line(pageWidth - margin - 50, y, pageWidth - margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text('Authorised Signatory', pageWidth - margin - 25, y + 5, { align: 'center' })
  doc.text(`For ${data.shop.name}`, pageWidth - margin - 25, y - 1.5, { align: 'center' })

  // === FOOTER ===
  doc.setDrawColor(220, 225, 230)
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
