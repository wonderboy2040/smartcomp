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
  bankName?: string
  bankAccount?: string
  bankIfsc?: string
  bankBranch?: string
}

export interface CustomerInfo {
  name: string
  phone?: string
  email?: string
  address?: string
  gstNumber?: string
  state?: string
  stateCode?: string
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
  docType: 'invoice' | 'quotation' | 'service'
  templateId?: string
  placeOfSupply?: string
  reverseCharge?: boolean
  eWayBillNo?: string
  roundOff?: number
  bankDetails?: ShopInfo
}

/**
 * 10 PREMIUM GST-COMPLIANT TEMPLATES - A4 Perfect Fit - v3.0.4
 * All templates are:
 * - GST compliant with HSN, GSTIN, state code, CGST/SGST/IGST
 * - A4 size (210x297mm) with 12mm margins = 186mm usable width - Perfect printable
 * - Correct printable: light backgrounds, 0.15mm borders, no heavy ink waste
 * - Premium design: distinct colors, professional typography, proper spacing
 */
export interface PdfTemplate {
  id: string
  name: string
  description: string
  badge: string
  headerBg: [number, number, number]
  headerText: [number, number, number]
  accent: [number, number, number]
  tableHead: [number, number, number]
  lightBg: [number, number, number]
  style: string
  premium: boolean
}

export const PDF_TEMPLATES: PdfTemplate[] = [
  // ===== ORIGINAL 5 - UPGRADED TO PREMIUM =====
  {
    id: 'tally-classic',
    name: 'Tally Prime Premium',
    description: 'Most Professional GST - White + Royal Blue - A4 Perfect',
    badge: 'BEST SELLER',
    headerBg: [255, 255, 255],
    headerText: [30, 58, 138],
    accent: [30, 58, 138],
    tableHead: [30, 58, 138],
    lightBg: [239, 246, 255],
    style: 'tally-classic',
    premium: true,
  },
  {
    id: 'tally-modern',
    name: 'Modern Minimal GST',
    description: 'Clean White Space - Emerald Accent - Minimal Ink',
    badge: 'MINIMAL',
    headerBg: [248, 250, 252],
    headerText: [15, 23, 42],
    accent: [16, 185, 129],
    tableHead: [15, 23, 42],
    lightBg: [236, 253, 245],
    style: 'tally-modern',
    premium: true,
  },
  {
    id: 'tally-corporate',
    name: 'Corporate Elite Pro',
    description: 'Navy + Gold - Formal Business - Premium',
    badge: 'CORPORATE',
    headerBg: [15, 23, 42],
    headerText: [255, 255, 255],
    accent: [202, 138, 4],
    tableHead: [15, 23, 42],
    lightBg: [254, 243, 199],
    style: 'tally-corporate',
    premium: true,
  },
  {
    id: 'tally-elegant',
    name: 'Royal Executive Gold',
    description: 'Maroon + Gold - Royal Look - High Value',
    badge: 'ROYAL',
    headerBg: [127, 29, 29],
    headerText: [255, 255, 255],
    accent: [251, 191, 36],
    tableHead: [127, 29, 29],
    lightBg: [254, 249, 195],
    style: 'tally-elegant',
    premium: true,
  },
  {
    id: 'tally-bold',
    name: 'Tech Store Pro',
    description: 'Teal + Orange - Computer Shop Special',
    badge: 'TECH SPECIAL',
    headerBg: [19, 78, 74],
    headerText: [255, 255, 255],
    accent: [249, 115, 22],
    tableHead: [19, 78, 74],
    lightBg: [255, 237, 213],
    style: 'tally-bold',
    premium: true,
  },
  // ===== 5 NEW PREMIUM GST TEMPLATES =====
  {
    id: 'gst-premium-dark',
    name: 'Premium Dark Elite',
    description: 'Black + Gold - Luxury - High Ticket',
    badge: 'LUXURY',
    headerBg: [0, 0, 0],
    headerText: [255, 215, 0],
    accent: [255, 215, 0],
    tableHead: [0, 0, 0],
    lightBg: [254, 252, 232],
    style: 'premium-dark',
    premium: true,
  },
  {
    id: 'gst-classic-plus',
    name: 'GST Classic Plus',
    description: 'Enhanced Tally - HSN Summary - Bank + QR',
    badge: 'GST PLUS',
    headerBg: [255, 255, 255],
    headerText: [17, 24, 39],
    accent: [59, 130, 246],
    tableHead: [37, 99, 235],
    lightBg: [239, 246, 255],
    style: 'classic-plus',
    premium: true,
  },
  {
    id: 'gst-executive-formal',
    name: 'Executive Formal',
    description: 'Light Gray + Slate - Formal - LUT',
    badge: 'FORMAL',
    headerBg: [241, 245, 249],
    headerText: [30, 41, 59],
    accent: [51, 65, 85],
    tableHead: [51, 65, 85],
    lightBg: [248, 250, 252],
    style: 'executive-formal',
    premium: true,
  },
  {
    id: 'gst-vibrant-bold',
    name: 'Vibrant Bold Offer',
    description: 'Vibrant - Big Grand Total - UPI QR Big',
    badge: 'VIBRANT',
    headerBg: [124, 45, 18],
    headerText: [255, 255, 255],
    accent: [251, 146, 60],
    tableHead: [124, 45, 18],
    lightBg: [255, 237, 213],
    style: 'vibrant-bold',
    premium: true,
  },
  {
    id: 'gst-minimal-white',
    name: 'Minimal White Pro',
    description: 'Pure White - Thin Lines - Low Ink',
    badge: 'ECO PRINT',
    headerBg: [255, 255, 255],
    headerText: [15, 23, 42],
    accent: [14, 165, 233],
    tableHead: [255, 255, 255],
    lightBg: [240, 249, 255],
    style: 'minimal-white',
    premium: true,
  },
]

const N = {
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  textDark: [15, 23, 42] as [number, number, number],
  textMid: [71, 85, 105] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
  textVLight: [148, 163, 184] as [number, number, number],
  bgRow: [248, 250, 252] as [number, number, number],
  bgRowAlt: [241, 245, 249] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  borderLight: [241, 245, 249] as [number, number, number],
  borderDark: [203, 213, 225] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
}

// Helper to check if background is light
function isLightBg(bg: [number, number, number]): boolean {
  const brightness = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000
  return brightness > 200
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// GST state codes
const STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
  'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14',
  'mizoram': '15', 'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27', 'andhra pradesh': '28',
  'karnataka': '29', 'goa': '30', 'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33',
  'puducherry': '34', 'andaman and nicobar islands': '35', 'telangana': '36', 'andhra pradesh (new)': '37',
  'ladakh': '38'
}

function getStateCode(state: string): string {
  if (!state) return ''
  const code = STATE_CODES[state.toLowerCase().trim()]
  return code || ''
}

// HSN Summary calculation
function calculateHSNSummary(items: any[]): { hsn: string; taxable: number; cgstRate: number; cgstAmt: number; sgstRate: number; sgstAmt: number; igstRate: number; igstAmt: number; total: number }[] {
  const map = new Map<string, any>()
  for (const item of items) {
    const hsn = item.hsnCode || 'N/A'
    const key = `${hsn}|${item.gstRate || 0}`
    if (!map.has(key)) {
      map.set(key, { hsn, taxable: 0, cgstRate: 0, cgstAmt: 0, sgstRate: 0, sgstAmt: 0, igstRate: 0, igstAmt: 0, total: 0, gstRate: Number(item.gstRate) || 0 })
    }
    const entry = map.get(key)!
    entry.taxable += Number(item.amount) || 0
    const gstAmt = Number(item.gstAmount) || 0
    entry.cgstRate = (Number(item.gstRate) || 0) / 2
    entry.sgstRate = (Number(item.gstRate) || 0) / 2
    entry.cgstAmt += gstAmt / 2
    entry.sgstAmt += gstAmt / 2
    entry.igstRate = Number(item.gstRate) || 0
    entry.igstAmt += gstAmt
    entry.total += (Number(item.amount) || 0) + gstAmt
  }
  return Array.from(map.values())
}

// Main PDF generation - A4 Perfect Fit
export async function generateInvoicePdf(data: PdfDocData): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 12 // 12mm margins = 186mm usable - Perfect for A4 printable
  const usableWidth = pageWidth - 2 * margin
  let y = 0
  let pageNumber = 1

  const isInvoice = data.docType === 'invoice'
  const isService = data.docType === 'service'
  const tpl = PDF_TEMPLATES.find(t => t.id === data.templateId) || PDF_TEMPLATES[0]
  const HB = tpl.headerBg
  const HT = tpl.headerText
  const A = tpl.accent
  const TH = tpl.tableHead
  const LB = tpl.lightBg
  const lightHeader = isLightBg(HB)
  const subColor = lightHeader ? N.textMid : [200, 210, 230] as [number, number, number]
  const headerSubColor = lightHeader ? N.textLight : [180, 190, 210] as [number, number, number]

  const drawFooter = (pageNum: number, totalPages: number = 1) => {
    doc.setDrawColor(...N.border)
    doc.setLineWidth(0.15)
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...N.textVLight)
    const footerText = `${isInvoice ? 'Invoice' : isService ? 'Service Invoice' : 'Quotation'} ${data.number} | ${data.shop.name || 'Smart Computers'} | ${totalPages > 1 ? `Page ${pageNum} of ${totalPages} | ` : ''}Computer generated - No signature required | Generated ${formatDateTime(new Date())}`
    doc.text(footerText, pageWidth / 2, pageHeight - 6, { align: 'center', maxWidth: usableWidth })
  }

  const addPageIfNeeded = (requiredSpace: number): boolean => {
    if (y + requiredSpace > pageHeight - 35) {
      drawFooter(pageNumber, 1)
      doc.addPage()
      pageNumber++
      y = margin + 5
      return true
    }
    return false
  }

  // ===== HEADER - A4 Perfect Fit =====
  const headerHeight = 32
  doc.setFillColor(...HB)
  doc.rect(0, 0, pageWidth, headerHeight, 'F')
  
  // Accent line bottom of header
  doc.setFillColor(...A)
  doc.rect(0, headerHeight, pageWidth, 1.2, 'F')
  
  // Optional second accent line for premium templates
  if (tpl.premium) {
    doc.setFillColor(...LB)
    doc.rect(0, headerHeight + 1.2, pageWidth, 0.5, 'F')
  }

  y = 7

  // Shop logo area (if available)
  if (data.shop.logoUrl) {
    try {
      // Logo placeholder - would need to fetch and add image
      // For now, draw a box
      doc.setDrawColor(...(lightHeader ? N.border : HT))
      doc.setLineWidth(0.2)
      doc.rect(margin, y, 12, 12)
      doc.setFontSize(5)
      doc.setTextColor(...HT)
      doc.text('LOGO', margin + 6, y + 7, { align: 'center' })
    } catch {}
  }

  const logoOffset = data.shop.logoUrl ? 15 : 0

  // Shop name - Large, Bold
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...HT)
  const shopNameX = margin + logoOffset
  doc.text(data.shop.name || 'Smart Computers', shopNameX, y + 5, { maxWidth: 90 })

  // Shop details - Compact, A4 optimized
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...subColor)
  let infoY = y + 10
  const maxShopInfoWidth = 95
  
  if (data.shop.address) {
    const addrLines = doc.splitTextToSize(data.shop.address, maxShopInfoWidth)
    doc.text(addrLines.slice(0, 2), shopNameX, infoY) // Max 2 lines for A4 fit
    infoY += Math.min(addrLines.length, 2) * 3
  }
  if (data.shop.state) {
    const stateCode = getStateCode(data.shop.state)
    doc.text(`${data.shop.state}${stateCode ? ` (${stateCode})` : ''}`, shopNameX, infoY)
    infoY += 3
  }
  let contactLine = ''
  if (data.shop.phone) contactLine += `Ph: ${data.shop.phone}`
  if (data.shop.email) contactLine += `${contactLine ? ' | ' : ''}${data.shop.email}`
  if (contactLine) {
    doc.text(contactLine, shopNameX, infoY)
    infoY += 3
  }
  if (data.shop.gstNumber) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(`GSTIN: ${data.shop.gstNumber}`, shopNameX, infoY)
    doc.setFont('helvetica', 'normal')
  }

  // Document Title & Meta - Right side, A4 optimized
  const rightX = pageWidth - margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...A)
  let docTitle = isInvoice ? 'TAX INVOICE' : isService ? 'SERVICE INVOICE' : 'QUOTATION'
  if (tpl.id === 'gst-vibrant-bold') docTitle = `★ ${docTitle} ★`
  doc.text(docTitle, rightX, y + 2, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...subColor)
  let metaY = y + 7
  doc.setFont('helvetica', 'bold')
  doc.text(`No: ${data.number}`, rightX, metaY, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  metaY += 4
  doc.text(`Date: ${formatDate(data.date)}`, rightX, metaY, { align: 'right' })
  metaY += 4
  if (data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, rightX, metaY, { align: 'right' })
    metaY += 4
  }
  if (data.eWayBillNo) {
    doc.text(`E-Way: ${data.eWayBillNo}`, rightX, metaY, { align: 'right' })
    metaY += 4
  }
  if (data.placeOfSupply) {
    doc.text(`Place of Supply: ${data.placeOfSupply}`, rightX, metaY, { align: 'right' })
    metaY += 4
  }
  // Original/Duplicate badge
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...A)
  doc.text(isInvoice ? 'ORIGINAL FOR RECIPIENT' : isService ? 'SERVICE COPY' : 'QUOTATION', rightX, metaY, { align: 'right' })

  y = headerHeight + 6

  // ===== BILL TO & SHIP TO - Compact A4 Fit =====
  const boxHeight = 32
  const halfWidth = (usableWidth - 4) / 2

  // Bill To
  doc.setFillColor(...LB)
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.15)
  doc.roundedRect(margin, y, halfWidth, boxHeight, 1.5, 1.5, 'FD')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...A)
  doc.text(isInvoice ? 'BILL TO / CUSTOMER DETAILS' : isService ? 'BILL TO / SERVICE CUSTOMER' : 'QUOTE TO', margin + 3, y + 4)
  
  doc.setDrawColor(...A)
  doc.setLineWidth(0.3)
  doc.line(margin + 3, y + 5.5, margin + 30, y + 5.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...N.textDark)
  doc.text(data.customer.name || 'Walk-in Customer', margin + 3, y + 10, { maxWidth: halfWidth - 6 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...N.textMid)
  let by = y + 14
  if (data.customer.address) {
    const addrLines = doc.splitTextToSize(data.customer.address, halfWidth - 6)
    doc.text(addrLines.slice(0, 2), margin + 3, by)
    by += Math.min(addrLines.length, 2) * 3
  }
  if (data.customer.phone) {
    doc.text(`Mobile: ${data.customer.phone}`, margin + 3, by)
    by += 3.5
  }
  if (data.customer.gstNumber) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text(`GSTIN: ${data.customer.gstNumber}`, margin + 3, by)
    doc.setFont('helvetica', 'normal')
    by += 3
  }
  if (data.customer.state) {
    const code = getStateCode(data.customer.state)
    doc.text(`State: ${data.customer.state}${code ? ` (${code})` : ''}`, margin + 3, by)
  }

  // Ship To / Payment Details (right box)
  const rightBoxX = margin + halfWidth + 4
  doc.setFillColor(...(isInvoice ? [254, 252, 232] as [number, number, number] : LB))
  doc.roundedRect(rightBoxX, y, halfWidth, boxHeight, 1.5, 1.5, 'FD')

  if (isInvoice || isService) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('PAYMENT & SHIPPING DETAILS', rightBoxX + 3, y + 4)
    doc.setDrawColor(...A)
    doc.line(rightBoxX + 3, y + 5.5, rightBoxX + 40, y + 5.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...N.textMid)
    let py = y + 10
    if (isInvoice) {
      doc.text(`Payment: ${(data.paymentType || 'cash').toUpperCase()} | Status: ${(data.paymentStatus || 'paid').toUpperCase()}`, rightBoxX + 3, py)
      py += 4
      if (data.amountDue !== undefined && data.amountDue > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...N.red)
        doc.text(`Balance Due: ${formatCurrency(data.amountDue)}`, rightBoxX + 3, py)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...N.textMid)
        py += 4
      } else if (data.amountPaid !== undefined) {
        doc.setTextColor(...N.green)
        doc.text(`Paid: ${formatCurrency(data.amountPaid)}`, rightBoxX + 3, py)
        doc.setTextColor(...N.textMid)
        py += 4
      }
      if (data.placeOfSupply) {
        doc.text(`Place of Supply: ${data.placeOfSupply}`, rightBoxX + 3, py)
        py += 4
      }
      if (data.reverseCharge) {
        doc.setFont('helvetica', 'bold')
        doc.text('Reverse Charge: Yes', rightBoxX + 3, py)
      }
    } else {
      // Service specifics
      doc.text(`Service Type: ${(data as any).serviceType || 'In-Shop'} | Priority: ${(data as any).priority || 'Normal'}`, rightBoxX + 3, py)
      py += 4
      doc.text(`Warranty: ${(data as any).warrantyDays || 30} days`, rightBoxX + 3, py)
      py += 4
      if (data.amountDue !== undefined) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...(data.amountDue > 0 ? N.red : N.green))
        doc.text(data.amountDue > 0 ? `Due: ${formatCurrency(data.amountDue)}` : 'PAID ✓', rightBoxX + 3, py)
      }
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('QUOTATION DETAILS', rightBoxX + 3, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...N.textMid)
    doc.text(`Valid Till: ${data.validTill ? formatDate(data.validTill) : '7 days'}`, rightBoxX + 3, y + 10)
    doc.text(`Quote No: ${data.number}`, rightBoxX + 3, y + 14)
    doc.text('Thank you for your inquiry!', rightBoxX + 3, y + 18)
  }

  y += boxHeight + 5

  // ===== ITEMS TABLE - A4 PERFECT FIT - GST COMPLIANT =====
  // Column widths optimized for 186mm usable A4 width
  const tableColumns = [
    { header: '#', dataKey: 'no' },
    { header: 'Item Description (HSN/SKU)', dataKey: 'desc' },
    { header: 'HSN', dataKey: 'hsn' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'Rate', dataKey: 'rate' },
    { header: 'Disc', dataKey: 'disc' },
    { header: 'Taxable', dataKey: 'taxable' },
    { header: 'GST%', dataKey: 'gstp' },
    { header: 'GST Amt', dataKey: 'gsta' },
    { header: 'Total', dataKey: 'total' },
  ]

  const tableBody = data.calc.items.map((item, i) => ({
    no: String(i + 1),
    desc: `${item.name}${item.sku ? `\nSKU: ${item.sku}` : ''}${(item as any).description ? `\n${(item as any).description}` : ''}`,
    hsn: item.hsnCode || '-',
    qty: `${item.quantity} ${ (item as any).unit || ''}`.trim(),
    rate: formatCurrency(item.rate).replace('Rs. ', ''),
    disc: item.discount ? formatCurrency(item.discount).replace('Rs. ', '') : '-',
    taxable: formatCurrency(item.amount).replace('Rs. ', ''),
    gstp: item.gstApplicable ? `${item.gstRate}%` : '-',
    gsta: item.gstApplicable ? formatCurrency(item.gstAmount).replace('Rs. ', '') : '-',
    total: formatCurrency(item.total).replace('Rs. ', ''),
  }))

  // Check if we need new page for table
  addPageIfNeeded(40)

  autoTable(doc, {
    startY: y,
    head: [tableColumns.map(c => c.header)],
    body: tableBody.map(r => tableColumns.map(c => (r as any)[c.dataKey])),
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineColor: N.border,
      lineWidth: 0.12,
      textColor: N.textDark,
      font: 'helvetica',
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: TH,
      textColor: isLightBg(TH) ? N.textDark : N.white,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      lineColor: TH,
      lineWidth: 0,
      minCellHeight: 8,
    },
    bodyStyles: {
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      fontSize: 7.5,
      minCellHeight: 7,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7, fontSize: 7 },
      1: { cellWidth: 'auto', fontStyle: 'bold', halign: 'left' },
      2: { halign: 'center', cellWidth: 13, fontSize: 6.5 },
      3: { halign: 'center', cellWidth: 14, fontSize: 7 },
      4: { halign: 'right', cellWidth: 17, fontSize: 7 },
      5: { halign: 'right', cellWidth: 14, fontSize: 6.5 },
      6: { halign: 'right', cellWidth: 18, fontSize: 7 },
      7: { halign: 'center', cellWidth: 11, fontSize: 6.5 },
      8: { halign: 'right', cellWidth: 17, fontSize: 7 },
      9: { halign: 'right', cellWidth: 20, fontStyle: 'bold', fontSize: 7.5 },
    },
    alternateRowStyles: { fillColor: N.bgRow },
    didParseCell: (data: any) => {
      // Bold total column
      if (data.column.index === 9 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: (data: any) => {
      // Repeat header on new pages is handled by autoTable
      y = data.cursor.y
    },
  })

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 4

  // ===== HSN SUMMARY (GST Compliance) - A4 Fit =====
  const hsnSummary = calculateHSNSummary(data.calc.items)
  if (hsnSummary.length > 1 && hsnSummary.length <= 6) { // Only show if multiple HSN and not too many
    addPageIfNeeded(20 + hsnSummary.length * 6)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...A)
    doc.text('HSN/SAC GST SUMMARY', margin, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['HSN/SAC', 'Taxable', 'CGST Rate', 'CGST Amt', 'SGST Rate', 'SGST Amt', 'Total']],
      body: hsnSummary.map(h => [
        h.hsn,
        formatCurrency(h.taxable).replace('Rs. ', ''),
        `${h.cgstRate}%`,
        formatCurrency(h.cgstAmt).replace('Rs. ', ''),
        `${h.sgstRate}%`,
        formatCurrency(h.sgstAmt).replace('Rs. ', ''),
        formatCurrency(h.total).replace('Rs. ', ''),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 6.5, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: N.bgRowAlt, textColor: N.textDark, fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 20 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20 },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
    })
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ===== TOTALS - A4 Perfect Fit - Right Aligned =====
  const totalsWidth = 72
  const totalsX = pageWidth - margin - totalsWidth
  let totalsY = y
  const rowHeight = 5.5

  // Check if totals need new page (keep together)
  if (y + 50 > pageHeight - 30) {
    doc.addPage()
    pageNumber++
    y = margin + 5
    totalsY = y
  }

  const drawTotalsRow = (label: string, value: string, opts: { bold?: boolean; bg?: [number, number, number]; textColor?: [number, number, number]; line?: boolean } = {}) => {
    const { bold = false, bg, textColor = N.textMid, line = true } = opts
    if (bg) {
      doc.setFillColor(...bg)
      doc.rect(totalsX, totalsY, totalsWidth, rowHeight, 'F')
    }
    if (line) {
      doc.setDrawColor(...N.borderLight)
      doc.setLineWidth(0.1)
      doc.line(totalsX, totalsY + rowHeight, totalsX + totalsWidth, totalsY + rowHeight)
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 8 : 7.5)
    doc.setTextColor(...(textColor || N.textMid))
    doc.text(label, totalsX + 3, totalsY + 3.5)
    doc.text(value, totalsX + totalsWidth - 3, totalsY + 3.5, { align: 'right' })
    totalsY += rowHeight
  }

  // Border for totals section
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.15)
  
  drawTotalsRow('Subtotal', formatCurrency(data.calc.subtotal), { bold: false })
  if (data.calc.discount > 0) {
    drawTotalsRow('Discount', `- ${formatCurrency(data.calc.discount)}`, { textColor: N.red })
  }
  if (data.calc.gstAmount > 0) {
    // Check if same state (CGST+SGST) or different (IGST) - For A4 we show split if same state assumed
    // Simple logic: if customer state same as shop state, show CGST+SGST else IGST
    const shopState = (data.shop.state || '').toLowerCase()
    const custState = (data.customer.state || '').toLowerCase()
    const sameState = !shopState || !custState || shopState === custState
    
    if (sameState) {
      drawTotalsRow(`CGST (${(data.calc.items[0]?.gstRate || 18)/2}%)`, formatCurrency(data.calc.sgstAmount))
      drawTotalsRow(`SGST (${(data.calc.items[0]?.gstRate || 18)/2}%)`, formatCurrency(data.calc.cgstAmount))
    } else {
      drawTotalsRow(`IGST (${data.calc.items[0]?.gstRate || 18}%)`, formatCurrency(data.calc.gstAmount))
    }
  }
  if (data.calc.courierCharges > 0) drawTotalsRow('Courier', formatCurrency(data.calc.courierCharges))
  if (data.calc.otherCharges > 0) drawTotalsRow('Other Charges', formatCurrency(data.calc.otherCharges))
  if (data.roundOff) drawTotalsRow('Round Off', formatCurrency(data.roundOff))

  // Grand Total - Highlighted
  totalsY += 1
  drawTotalsRow('GRAND TOTAL', formatCurrency(data.calc.grandTotal), { 
    bold: true, 
    bg: A, 
    textColor: isLightBg(A) ? N.textDark : N.white,
    line: false
  })
  doc.setFillColor(...A)
  doc.rect(totalsX, totalsY - rowHeight, totalsWidth, rowHeight, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...(isLightBg(A) ? N.textDark : N.white))
  doc.text('GRAND TOTAL', totalsX + 3, totalsY - 2)
  doc.text(formatCurrency(data.calc.grandTotal), totalsX + totalsWidth - 3, totalsY - 2, { align: 'right' })

  // Paid/Due
  if (isInvoice || isService) {
    if (data.amountPaid !== undefined && data.amountPaid > 0) {
      drawTotalsRow('Paid', formatCurrency(data.amountPaid), { textColor: N.green })
    }
    if (data.amountDue !== undefined && data.amountDue > 0) {
      drawTotalsRow('Balance Due', formatCurrency(data.amountDue), { bold: true, bg: [254, 242, 242] as [number, number, number], textColor: N.red })
    } else if (data.amountDue === 0 && (data.amountPaid || 0) > 0) {
      drawTotalsRow('Status', 'PAID ✓', { bold: true, bg: [236, 253, 245] as [number, number, number], textColor: N.green })
    }
  }

  // Outer border for totals
  doc.setDrawColor(...N.borderDark)
  doc.setLineWidth(0.25)
  doc.rect(totalsX, y, totalsWidth, totalsY - y)

  // Amount in Words - Left side, A4 fit
  const wordsY = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...N.textVLight)
  doc.text('AMOUNT IN WORDS', margin, wordsY + 2)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...N.textDark)
  const wordsText = `${numberToWords(data.calc.grandTotal)} Only`
  const wordsLines = doc.splitTextToSize(wordsText, totalsX - margin - 6)
  doc.text(wordsLines.slice(0, 3), margin, wordsY + 6) // Max 3 lines for A4 fit

  y = Math.max(totalsY, wordsY + 6 + Math.min(wordsLines.length, 3) * 3.5) + 6

  // ===== BANK + QR + TERMS - A4 Fit =====
  const bottomSectionY = y
  const remainingSpace = pageHeight - y - 35 // 35 for signature + footer

  if (remainingSpace > 45) {
    const colWidth = (usableWidth - 4) / 2
    
    // Left: Bank + QR
    let leftY = bottomSectionY
    
    // UPI QR if available and amount due > 0
    const qrAmount = isInvoice ? (Number(data.amountDue) || 0) : data.calc.grandTotal
    if (data.shop.upiId && qrAmount > 0) {
      try {
        const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Shop')}&am=${qrAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.number || '')}`
        const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 180, margin: 1 })
        const qrSize = 22
        doc.addImage(qrDataUrl, 'PNG', margin, leftY, qrSize, qrSize)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...A)
        doc.text('Scan & Pay', margin + qrSize + 3, leftY + 4)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(...N.textMid)
        doc.text(`Rs.${qrAmount.toFixed(2)} via UPI`, margin + qrSize + 3, leftY + 8)
        doc.text(`${data.shop.upiId}`, margin + qrSize + 3, leftY + 11)
        leftY += qrSize + 4
      } catch {}
    }

    // Bank details
    if (data.shop.bankName || data.shop.bankAccount) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(...A)
      doc.text('BANK DETAILS', margin, leftY)
      leftY += 3.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...N.textMid)
      if (data.shop.bankName) {
        doc.text(`Bank: ${data.shop.bankName}${data.shop.bankBranch ? `, ${data.shop.bankBranch}` : ''}`, margin, leftY)
        leftY += 3
      }
      if (data.shop.bankAccount) {
        doc.text(`A/c: ${data.shop.bankAccount}${data.shop.bankIfsc ? ` | IFSC: ${data.shop.bankIfsc}` : ''}`, margin, leftY)
        leftY += 3
      }
    }

    // Right: Terms & Notes
    let rightY = bottomSectionY
    const rightX = margin + colWidth + 4
    
    if (data.terms || data.notes) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(...A)
      doc.text(data.notes && data.terms ? 'TERMS & NOTES' : data.terms ? 'TERMS & CONDITIONS' : 'NOTES', rightX, rightY)
      rightY += 3.5
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...N.textMid)
      const combinedText = `${data.terms ? data.terms : ''}${data.terms && data.notes ? '\n' : ''}${data.notes ? data.notes : ''}`
      const termLines = doc.splitTextToSize(combinedText, colWidth - 4)
      const limitedLines = termLines.slice(0, 8) // Max 8 lines for A4 fit
      doc.text(limitedLines, rightX, rightY)
      rightY += limitedLines.length * 2.8 + 2
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...N.textLight)
      doc.text('Thank you for your business!', rightX, rightY)
      doc.text(`Warranty as per manufacturer | ${data.shop.name}`, rightX, rightY + 3)
    }

    y = Math.max(leftY, rightY) + 4
  }

  // ===== SIGNATURE - A4 Bottom Fixed =====
  const sigY = pageHeight - 28
  if (y < sigY - 10) y = sigY - 10

  doc.setDrawColor(...N.textVLight)
  doc.setLineWidth(0.2)
  const sigLineX = pageWidth - margin - 45
  doc.line(sigLineX, sigY, pageWidth - margin, sigY)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...N.textDark)
  doc.text(data.shop.name || 'Smart Computers', sigLineX + 22.5, sigY - 3, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...N.textLight)
  doc.text('Authorised Signatory', sigLineX + 22.5, sigY + 4, { align: 'center' })

  // Company seal placeholder
  doc.setDrawColor(...N.borderLight)
  doc.setLineWidth(0.1)
  doc.circle(sigLineX + 22.5, sigY - 12, 10, 'D')
  doc.setFontSize(5)
  doc.text('SEAL', sigLineX + 22.5, sigY - 11, { align: 'center' })

  // Draw all footers
  for (let i = 1; i <= pageNumber; i++) {
    if (i > 1) {
      // For multi-page, we need to set page
      doc.setPage(i)
    }
    drawFooter(i, pageNumber)
  }
  doc.setPage(pageNumber)

  return Buffer.from(doc.output('arraybuffer'))
}
