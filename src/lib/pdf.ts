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
  productImages?: any
  adBannerVariant?: string
  docId?: string
  copyType?: 'ORIGINAL FOR RECIPIENT' | 'DUPLICATE FOR TRANSPORTER' | 'TRIPLICATE FOR SUPPLIER'
}

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

export const AD_BANNER_VARIANTS = [
  { id: 'flyer', name: 'Premium Flyer', description: '1000x285 px Ultra-Premium Horizontal Flyer' },
  { id: 'grid', name: 'Product Grid', description: '1000x285 px 4x4 Product Grid Poster Banner' },
  { id: 'featured', name: 'Featured Mix', description: 'Headline panel + product showcase' },
  { id: 'strip', name: 'Compact Strip', description: 'Minimal image pills + Call/Visit CTA' },
] as const

const N = {
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  textDark: [15, 23, 42] as [number, number, number],
  textMid: [71, 85, 105] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
  textVLight: [148, 163, 184] as [number, number, number],
  bgRow: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
}

function isLightBg(bg: [number, number, number]): boolean {
  const brightness = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000
  return brightness > 200
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

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
  return STATE_CODES[state.toLowerCase().trim()] || ''
}

function calculateHSNSummary(items: any[]) {
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

// Generate Invoice / Quotation / Service PDF
export async function generateInvoicePdf(data: PdfDocData): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 12
  const usableWidth = pageWidth - margin * 2

  // ===== EXACT COMPACT AD BANNER & EXPANDED USABLE PAGE GEOMETRY =====
  const variant = data.adBannerVariant || 'flyer'

  const posterW = 175
  const posterH = 22 // 22mm compact banner height (fits 1000x285 px banner proportionally)
  const posterX = margin + (usableWidth - posterW) / 2 // 17.5mm

  const FOOTER_Y = 293
  const FOOTER_LINE = 290
  const AD_BAND_BOTTOM = 289
  const AD_BAND_TOP = AD_BAND_BOTTOM - posterH // 267mm

  // Signature block positioned strictly ABOVE top of banner with 255mm content limit (+51.3mm extra space)
  const SIG_LINE_Y = AD_BAND_TOP - 12 // 255mm
  const CONTENT_LIMIT = SIG_LINE_Y - 6 // 249mm

  let pageNumber = 1
  const pageEnds: Record<number, number> = {}
  let y = 0

  const isInvoice = data.docType === 'invoice'
  const isService = data.docType === 'service'
  const tpl = PDF_TEMPLATES.find((t) => t.id === data.templateId) || PDF_TEMPLATES[0]
  const HB = tpl.headerBg
  const HT = tpl.headerText
  const A = tpl.accent
  const TH = tpl.tableHead
  const LB = tpl.lightBg
  const lightHeader = isLightBg(HB)
  const subColor = lightHeader ? N.textMid : ([200, 210, 230] as [number, number, number])

  const drawFooter = (pageNum: number, totalPages = 1) => {
    doc.setDrawColor(...N.border)
    doc.setLineWidth(0.15)
    doc.line(margin, FOOTER_LINE, pageWidth - margin, FOOTER_LINE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...N.textVLight)
    const footerText = `${isInvoice ? 'Invoice' : isService ? 'Service Invoice' : 'Quotation'} ${data.number} | ${data.shop.name || 'Smart Computers'} | ${
      totalPages > 1 ? `Page ${pageNum} of ${totalPages} | ` : ''
    }Computer generated | ${formatDateTime(new Date())}`
    doc.text(footerText, pageWidth / 2, FOOTER_Y, { align: 'center', maxWidth: usableWidth })
  }

  const addPageIfNeeded = (requiredSpace: number): boolean => {
    if (y + requiredSpace > CONTENT_LIMIT) {
      pageEnds[pageNumber] = y
      drawFooter(pageNumber, pageNumber + 1)
      doc.addPage()
      pageNumber++
      y = margin + 5
      return true
    }
    return false
  }

  // ===== HEADER WITH OFFICIAL EMBEDDED METALLIC SHIELD LOGO =====
  const logoImg = data.productImages?.logo || data.shop?.logoUrl
  const hasLogo = !!logoImg

  const logoW = 22
  const logoH = 22
  const logoX = margin
  const logoY = 6

  const shopNameX = hasLogo ? margin + logoW + 4 : margin // 38mm if logo present
  const maxInfoWidth = hasLogo ? 78 : 96

  const shopNameText = data.shop.name || 'Smart Computers'
  const nameFontSize = shopNameText.length > 22 ? 14 : 17

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(nameFontSize)
  const nameLines = doc.splitTextToSize(shopNameText, maxInfoWidth)

  let addrLineCount = 0
  if (data.shop.address) {
    const addrLines = doc.splitTextToSize(data.shop.address, maxInfoWidth)
    addrLineCount = Math.min(addrLines.length, 2)
  }
  
  let contactPresent = !!(data.shop.phone || data.shop.email)
  let gstPresent = !!data.shop.gstNumber

  const calculatedHeaderHeight = Math.max(34, (nameLines.length * 4.5) + (addrLineCount * 3.5) + (contactPresent ? 3.5 : 0) + (gstPresent ? 4 : 0) + 12)

  // Draw Header Background
  doc.setFillColor(...HB)
  doc.rect(0, 0, pageWidth, calculatedHeaderHeight, 'F')

  // Accent Bottom Line
  doc.setFillColor(...A)
  doc.rect(0, calculatedHeaderHeight, pageWidth, 1.2, 'F')
  if (tpl.premium) {
    doc.setFillColor(...LB)
    doc.rect(0, calculatedHeaderHeight + 1.2, pageWidth, 0.5, 'F')
  }

  // Draw Official Crest Shield Logo on Top Left
  if (hasLogo) {
    try {
      doc.addImage(logoImg, logoX, logoY, logoW, logoH)
    } catch {
      try {
        const fmt = String(logoImg).startsWith('data:image/webp') ? 'WEBP' : 'PNG'
        doc.addImage(logoImg, fmt, logoX, logoY, logoW, logoH)
      } catch {}
    }
  }

  // Draw Shop Name beside logo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(nameFontSize)
  doc.setTextColor(...HT)
  doc.text(nameLines, shopNameX, 11)

  // Draw Shop Address & Details beside logo
  let currentHeaderY = 11 + (nameLines.length * 4.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...subColor)

  if (data.shop.address) {
    const addrLines = doc.splitTextToSize(data.shop.address, maxInfoWidth)
    doc.text(addrLines.slice(0, 2), shopNameX, currentHeaderY)
    currentHeaderY += Math.min(addrLines.length, 2) * 3.2
  }

  if (data.shop.state) {
    const stateCode = getStateCode(data.shop.state)
    doc.text(`${data.shop.state}${stateCode ? ` (${stateCode})` : ''}`, shopNameX, currentHeaderY)
    currentHeaderY += 3.2
  }

  let contactLine = ''
  if (data.shop.phone) contactLine += `Ph: ${data.shop.phone}`
  if (data.shop.email) contactLine += `${contactLine ? ' | ' : ''}${data.shop.email}`
  if (contactLine) {
    doc.text(contactLine, shopNameX, currentHeaderY)
    currentHeaderY += 3.2
  }

  if (data.shop.gstNumber) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...HT)
    doc.text(`GSTIN: ${data.shop.gstNumber}`, shopNameX, currentHeaderY)
  }

  // Right Side Document Title Block - "INVOICE" badge with Copy Type Subtitle
  const titleBoxX = pageWidth - margin - 58
  doc.setFillColor(...(lightHeader ? LB : A))
  doc.roundedRect(titleBoxX, 7, 58, 11, 1, 1, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...(lightHeader ? A : N.white))
  const docTitle = isInvoice ? 'INVOICE' : isService ? 'SERVICE INVOICE' : 'QUOTATION'
  doc.text(docTitle, titleBoxX + 29, 13, { align: 'center' })

  // Subtitle Copy Type Tag
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...(lightHeader ? A : N.white))
  const copySubtitle = data.copyType || (isInvoice ? 'ORIGINAL FOR RECIPIENT' : 'OFFICIAL DOCUMENT')
  doc.text(copySubtitle, titleBoxX + 29, 16.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...subColor)
  let rightY = 22.5
  doc.text(`No: ${data.number}`, titleBoxX + 58, rightY, { align: 'right' })
  rightY += 3.5
  doc.text(`Date: ${formatDate(data.date)}`, titleBoxX + 58, rightY, { align: 'right' })
  rightY += 3.5

  if (!isInvoice && !isService && data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, titleBoxX + 58, rightY, { align: 'right' })
  }

  // CLEARANCE GAP BEFORE BILL TO SECTION
  y = calculatedHeaderHeight + 6

  // ===== BILL TO / SHIP TO SECTION =====
  const boxW = (usableWidth - 4) / 2
  const boxH = 17
  const billX = margin
  const shipX = margin + boxW + 4

  doc.setFillColor(...N.bgRow)
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.2)
  doc.roundedRect(billX, y, boxW, boxH, 1, 1, 'FD')
  doc.roundedRect(shipX, y, boxW, boxH, 1, 1, 'FD')

  // Bill To Content
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...A)
  doc.text('BILL TO / CUSTOMER DETAILS', billX + 3, y + 3.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...N.textDark)
  doc.text(data.customer.name || 'Walk-in Customer', billX + 3, y + 7.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...N.textMid)
  let custY = y + 11
  if (data.customer.phone) {
    doc.text(`Mobile: ${data.customer.phone}`, billX + 3, custY)
    custY += 3
  }
  if (data.customer.gstNumber) {
    doc.setFont('helvetica', 'bold')
    doc.text(`GSTIN: ${data.customer.gstNumber}`, billX + 3, custY)
  }

  // Ship To / Status Content
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...A)
  doc.text(isService ? 'SERVICE DETAILS' : 'PAYMENT & SHIPPING DETAILS', shipX + 3, y + 3.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...N.textMid)
  if (isService) {
    doc.text(`Device: ${data.notes || 'Repair / Service'}`, shipX + 3, y + 7.5)
  } else {
    doc.text(`Payment: ${(data.paymentType || 'CASH').toUpperCase()} | Status: ${(data.paymentStatus || 'UNPAID').toUpperCase()}`, shipX + 3, y + 7.5)
    if (Number(data.amountDue) > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...N.red)
      doc.text(`Balance Due: ${formatCurrency(data.amountDue || 0)}`, shipX + 3, y + 11.5)
    }
  }

  y += boxH + 3

  // ===== ITEMS TABLE =====
  const tableHeaders = ['#', 'Item name', 'HSN/SAC', 'Qty', 'Rate (Rs.)', 'Taxable', 'GST (Rs.)', 'Amount (Rs.)']

  const tableBody = data.calc.items.map((item, index) => [
    index + 1,
    item.name + (item.sku ? `\nSKU: ${item.sku}` : ''),
    item.hsnCode || '-',
    item.quantity,
    item.rate.toFixed(2),
    item.amount.toFixed(2),
    item.gstAmount > 0 ? `${item.gstAmount.toFixed(2)} (${item.gstRate}%)` : '-',
    item.total.toFixed(2),
  ])

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: N.textDark,
      valign: 'middle',
    },
    headStyles: {
      fillColor: TH,
      textColor: N.white,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 24 },
      7: { halign: 'right', cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: N.bgRow,
    },
    didDrawPage: () => {},
  })

  // CLEARANCE GAP AFTER TABLE
  y = (doc as any).lastAutoTable.finalY + 4

  // ===== HSN SUMMARY TABLE (If GST applicable) =====
  const hsnSummary = calculateHSNSummary(data.calc.items)
  if (hsnSummary.length > 0 && hsnSummary.some((h) => h.total > 0)) {
    addPageIfNeeded(20)
    const hsnHeaders = ['HSN/SAC', 'Taxable Value', 'CGST', 'SGST', 'Total Tax']
    const hsnRows = hsnSummary.map((h) => [
      `${h.hsn} (${h.gstRate}%)`,
      `Rs. ${h.taxable.toFixed(2)}`,
      `Rs. ${h.cgstAmt.toFixed(2)}`,
      `Rs. ${h.sgstAmt.toFixed(2)}`,
      `Rs. ${h.total.toFixed(2)}`,
    ])

    autoTable(doc, {
      startY: y,
      head: [hsnHeaders],
      body: hsnRows,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.5, textColor: N.textMid },
      headStyles: { fillColor: N.bgRow, textColor: N.textDark, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { halign: 'right', cellWidth: 35 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 'auto' },
      },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  }

  addPageIfNeeded(20)

  // ===== TOTALS & AMOUNT IN WORDS SECTION WITH CGST (9%) & SGST (9%) =====
  const totalsW = 75
  const totalsX = pageWidth - margin - totalsW
  const wordsY = y

  // Compute effective CGST/SGST rate percentage
  const effectiveGstRate = data.calc.items.find((i) => i.gstApplicable && Number(i.gstRate) > 0)?.gstRate || 18
  const halfGstRate = effectiveGstRate / 2

  // Calculations Box Right Side
  doc.setFillColor(...N.bgRow)
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.2)
  
  let currentTotY = wordsY
  const drawRow = (label: string, value: string, bold = false, color = N.textDark) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...color)
    doc.text(label, totalsX + 3, currentTotY + 3.5)
    doc.text(value, totalsX + totalsW - 3, currentTotY + 3.5, { align: 'right' })
    currentTotY += 4.0
  }

  drawRow('Sub Total', formatCurrency(data.calc.subtotal))
  if (data.calc.cgstAmount > 0) drawRow(`CGST (${halfGstRate}%)`, formatCurrency(data.calc.cgstAmount))
  if (data.calc.sgstAmount > 0) drawRow(`SGST (${halfGstRate}%)`, formatCurrency(data.calc.sgstAmount))
  if (data.calc.courierCharges > 0) drawRow('Courier Charges', formatCurrency(data.calc.courierCharges))
  if (data.calc.discount > 0) drawRow('Discount', `- ${formatCurrency(data.calc.discount)}`, true, N.green)

  // Grand Total Highlight
  doc.setFillColor(...A)
  doc.rect(totalsX, currentTotY, totalsW, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...N.white)
  doc.text('GRAND TOTAL', totalsX + 3, currentTotY + 4.2)
  doc.text(formatCurrency(data.calc.grandTotal), totalsX + totalsW - 3, currentTotY + 4.2, { align: 'right' })
  currentTotY += 7

  if (Number(data.amountPaid) > 0) drawRow('Paid / Advance', `- ${formatCurrency(Number(data.amountPaid) || 0)}`, true, N.green)
  if (Number(data.amountDue) > 0) drawRow('Balance Due', formatCurrency(Number(data.amountDue) || 0), true, N.red)

  const totalsBoxH = currentTotY - wordsY
  doc.rect(totalsX, wordsY, totalsW, totalsBoxH)

  // Amount in Words Left Side
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...N.textVLight)
  doc.text('AMOUNT IN WORDS', margin, wordsY + 3)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...N.textDark)
  const wordsText = numberToWords(data.calc.grandTotal)
  const wordsLines = doc.splitTextToSize(wordsText, totalsX - margin - 6)
  doc.text(wordsLines.slice(0, 2), margin, wordsY + 6.5)

  let leftY = wordsY + 14

  // Bank Details & UPI QR Left Side
  if (data.shop.bankName || data.shop.bankAccount || data.shop.upiId) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...A)
    doc.text('BANK DETAILS & UPI PAYMENTS', margin, leftY)
    leftY += 3.2

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...N.textMid)
    if (data.shop.bankName) {
      doc.text(`Bank: ${data.shop.bankName} ${data.shop.bankBranch ? `(${data.shop.bankBranch})` : ''}`, margin, leftY)
      leftY += 2.8
    }
    if (data.shop.bankAccount) {
      doc.text(`A/c: ${data.shop.bankAccount} | IFSC: ${data.shop.bankIfsc || '-'}`, margin, leftY)
      leftY += 2.8
    }

    if (data.shop.upiId) {
      try {
        const qrAmount = isInvoice ? (Number(data.amountDue) || 0) : data.calc.grandTotal
        const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Shop')}&am=${qrAmount.toFixed(2)}&cu=INR`
        const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 120, margin: 1 })
        const qrSize = 14
        doc.addImage(qrDataUrl, 'PNG', margin, leftY, qrSize, qrSize)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...A)
        doc.text('Scan & Pay via UPI', margin + qrSize + 3, leftY + 3.5)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...N.textMid)
        doc.text(`UPI: ${data.shop.upiId}`, margin + qrSize + 3, leftY + 7)
        leftY += qrSize + 2
      } catch {}
    }
  }

  y = Math.max(currentTotY + 2, leftY + 2)

  // ===== AUTHORIZED SIGNATURE BLOCK (Attaches to bottom of Page 1 if content fits) =====
  addPageIfNeeded(16)
  doc.setPage(pageNumber)
  const sigBoxX = pageWidth - margin - 50
  
  const targetSigY = Math.min(SIG_LINE_Y, Math.max(y + 12, SIG_LINE_Y - 8))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...N.textDark)
  doc.text(`For ${data.shop.name || 'Smart Computers'}:`, sigBoxX + 25, targetSigY - 4, { align: 'center' })

  doc.setDrawColor(...N.textVLight)
  doc.setLineWidth(0.2)
  doc.line(sigBoxX, targetSigY, pageWidth - margin, targetSigY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...N.textLight)
  doc.text('Authorized Signatory', sigBoxX + 25, targetSigY + 3.5, { align: 'center' })

  // ===== 1000x285 PX CENTERED HORIZONTAL BANNER BELOW INVOICE =====
  const drawAdBanner = (topY: number, bandH: number) => {
    const by = topY
    const imgs: Record<string, string> = data.productImages || {}
    const phone = data.shop.phone || ''

    // Premium Flyer Poster Graphic (Exact 1000x285 px format)
    if (variant === 'flyer') {
      if (imgs['flyer']) {
        try {
          doc.addImage(imgs['flyer'], posterX, by, posterW, bandH)
          return
        } catch {
          try {
            const fmt = imgs['flyer'].startsWith('data:image/webp') ? 'WEBP' : 'PNG'
            doc.addImage(imgs['flyer'], fmt, posterX, by, posterW, bandH)
            return
          } catch {}
        }
      }
    }

    // High-Res Product Grid Poster Graphic (Exact 1000x285 px format)
    if (variant === 'grid') {
      if (imgs['productgrid']) {
        try {
          doc.addImage(imgs['productgrid'], posterX, by, posterW, bandH)
          return
        } catch {
          try {
            const fmt = imgs['productgrid'].startsWith('data:image/webp') ? 'WEBP' : 'PNG'
            doc.addImage(imgs['productgrid'], fmt, posterX, by, posterW, bandH)
            return
          } catch {}
        }
      }
    }

    // Fallback Card (Centered)
    doc.setFillColor(...mixColor(A, N.white, 0.94))
    doc.setDrawColor(...A)
    doc.setLineWidth(0.3)
    doc.roundedRect(posterX, by, posterW, bandH, 1, 1, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...A)
    doc.text('SMART COMPUTERS IT SOLUTIONS', posterX + 6, by + 10)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...N.textMid)
    doc.text('Computers • Laptops • Printers • CCTV • Accessories & Repair Center', posterX + 6, by + 15)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...N.textDark)
    doc.text(phone ? `Call / WhatsApp: ${phone}` : 'Authorized Center', posterX + posterW - 6, by + 12, { align: 'right' })
  }

  // Draw Ad Banner on all pages
  for (let i = 1; i <= pageNumber; i++) {
    doc.setPage(i)
    drawAdBanner(AD_BAND_TOP, posterH)
    drawFooter(i, pageNumber)
  }

  doc.setPage(pageNumber)
  return Buffer.from(doc.output('arraybuffer'))
}
