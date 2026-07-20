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

// ===== PRO v7.1 ADVANCED INVOICE PDF - Unified Engine =====
// FIXES:
// - Preview vs PDF mismatch => unified 8 columns: # | Item (with SKU) | HSN | Qty (with unit) | Rate | Taxable | GST | Total
// - Signature next page => dynamic flow, not fixed Y. Signature always right after content, with space check
// - Print blank => separate fix in DocumentHtmlViewer, but PDF also now simpler without huge fixed banner gap
// - Banner reduced to 28mm and only on last page if space, optional
// - CONTENT_LIMIT dynamic: normal pages up to 270mm, last page reserves only footer 12mm

export async function generateInvoicePdf(data: PdfDocData): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 10
  const usableWidth = pageWidth - margin * 2

  // Layout constants - PRO dynamic
  const FOOTER_H = 10 // footer reserved
  const BANNER_H = 32 // reduced from 51.3 to 32mm for PRO
  const SIGN_H = 22 // signature block height
  const NORMAL_LIMIT = pageHeight - margin - FOOTER_H - 2 // 285mm usable for normal pages
  const LAST_PAGE_LIMIT_WITH_BANNER = pageHeight - margin - FOOTER_H - BANNER_H - 8 // ~247mm if banner

  let pageNumber = 1
  let y = 0
  let isLastPageReservedForBanner = true // we will draw banner only on final page

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

  const drawFooterAll = () => {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(...N.border)
      doc.setLineWidth(0.15)
      const footerLineY = pageHeight - FOOTER_H + 2
      doc.line(margin, footerLineY, pageWidth - margin, footerLineY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...N.textVLight)
      const footerText = `${isInvoice ? 'Invoice' : isService ? 'Service Invoice' : 'Quotation'} ${data.number} | ${data.shop.name || 'Smart Computers'} | ${totalPages > 1 ? `Page ${i} of ${totalPages} | ` : ''}Computer generated | ${formatDateTime(new Date())} | ${data.copyType || ''}`
      doc.text(footerText, pageWidth / 2, pageHeight - 3, { align: 'center', maxWidth: usableWidth })
    }
  }

  const ensureSpace = (needed: number, opts?: { reserveForSignature?: boolean; reserveForBanner?: boolean }) => {
    const reserveBanner = opts?.reserveForBanner ? BANNER_H + 8 : 0
    const reserveSig = opts?.reserveForSignature ? SIGN_H + 5 : 0
    // For non-last pages, limit is NORMAL_LIMIT, for last page we keep extra reserve if needed
    const limit = pageNumber === doc.getNumberOfPages() ? LAST_PAGE_LIMIT_WITH_BANNER + reserveBanner : NORMAL_LIMIT
    // Simpler: use NORMAL_LIMIT for all except we check if this is last page and banner needed
    const effectiveLimit = NORMAL_LIMIT - (isLastPageReservedForBanner ? 0 : 0) // keep simple
    // Check if current y + needed exceeds limit, but also consider if we are on last page and need to reserve sig+banner
    const checkLimit = effectiveLimit - reserveSig - reserveBanner
    if (y + needed > checkLimit) {
      doc.addPage()
      pageNumber++
      y = margin
      return true
    }
    return false
  }

  // ===== HEADER =====
  const logoImg = data.productImages?.logo || data.shop?.logoUrl
  const hasLogo = !!logoImg
  const logoW = 18
  const logoH = 18
  const logoX = margin
  const logoY = 6
  const shopNameX = hasLogo ? margin + logoW + 4 : margin
  const maxInfoWidth = hasLogo ? 80 : 98
  const shopNameText = data.shop.name || 'Smart Computers'
  const nameFontSize = shopNameText.length > 22 ? 13 : 16
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
  const calculatedHeaderHeight = Math.max(30, (nameLines.length * 4.5) + (addrLineCount * 3.2) + (contactPresent ? 3.2 : 0) + (gstPresent ? 3.8 : 0) + 10)
  // Header background
  doc.setFillColor(...HB)
  doc.rect(0, 0, pageWidth, calculatedHeaderHeight, 'F')
  doc.setFillColor(...A)
  doc.rect(0, calculatedHeaderHeight, pageWidth, 1, 'F')
  if (tpl.premium) {
    doc.setFillColor(...LB)
    doc.rect(0, calculatedHeaderHeight + 1, pageWidth, 0.4, 'F')
  }
  if (hasLogo) {
    try { doc.addImage(logoImg, 'PNG', logoX, logoY, logoW, logoH) } catch {}
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(nameFontSize)
  doc.setTextColor(...HT)
  doc.text(nameLines, shopNameX, 10)
  let currentHeaderY = 10 + (nameLines.length * 4.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(...subColor)
  if (data.shop.address) {
    const addrLines = doc.splitTextToSize(data.shop.address, maxInfoWidth)
    doc.text(addrLines.slice(0, 2), shopNameX, currentHeaderY)
    currentHeaderY += Math.min(addrLines.length, 2) * 3.1
  }
  if (data.shop.state) {
    const stateCode = getStateCode(data.shop.state)
    doc.text(`${data.shop.state}${stateCode ? ` (${stateCode})` : ''}`, shopNameX, currentHeaderY)
    currentHeaderY += 3.1
  }
  let contactLine = ''
  if (data.shop.phone) contactLine += `Ph: ${data.shop.phone}`
  if (data.shop.email) contactLine += `${contactLine ? ' | ' : ''}${data.shop.email}`
  if (contactLine) {
    doc.text(contactLine, shopNameX, currentHeaderY)
    currentHeaderY += 3.1
  }
  if (data.shop.gstNumber) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(...HT)
    doc.text(`GSTIN: ${data.shop.gstNumber}`, shopNameX, currentHeaderY)
  }
  // Title box right
  const titleBoxX = pageWidth - margin - 58
  doc.setFillColor(...(lightHeader ? LB : A))
  doc.roundedRect(titleBoxX, 6, 58, 10, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...(lightHeader ? A : N.white))
  const docTitle = isInvoice ? 'INVOICE' : isService ? 'SERVICE INVOICE' : 'QUOTATION'
  doc.text(docTitle, titleBoxX + 29, 12, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.2)
  doc.setTextColor(...(lightHeader ? A : N.white))
  const copySubtitle = data.copyType || (isInvoice ? 'ORIGINAL FOR RECIPIENT' : 'OFFICIAL DOCUMENT')
  doc.text(copySubtitle, titleBoxX + 29, 15.2, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(...subColor)
  let rightY = 20
  doc.text(`No: ${data.number}`, titleBoxX + 58, rightY, { align: 'right' })
  rightY += 3.2
  doc.text(`Date: ${formatDate(data.date)}`, titleBoxX + 58, rightY, { align: 'right' })
  rightY += 3.2
  if (data.validTill) {
    doc.text(`Valid Till: ${formatDate(data.validTill)}`, titleBoxX + 58, rightY, { align: 'right' })
  }

  y = calculatedHeaderHeight + 8

  // ===== BILL TO / SHIP TO =====
  const boxW = (usableWidth - 4) / 2
  const boxH = 20
  const billX = margin
  const shipX = margin + boxW + 4
  doc.setFillColor(...N.bgRow)
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.18)
  doc.roundedRect(billX, y, boxW, boxH, 1, 1, 'FD')
  doc.roundedRect(shipX, y, boxW, boxH, 1, 1, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(...A)
  doc.text('BILL TO / CUSTOMER DETAILS', billX + 2.5, y + 3.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...N.textDark)
  doc.text(data.customer.name || 'Walk-in Customer', billX + 2.5, y + 7.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...N.textMid)
  let custY = y + 11
  if (data.customer.phone) { doc.text(`Mobile: ${data.customer.phone}`, billX + 2.5, custY); custY += 3.2 }
  if (data.customer.gstNumber) { doc.setFont('helvetica', 'bold'); doc.text(`GSTIN: ${data.customer.gstNumber}`, billX + 2.5, custY); custY += 3.2; doc.setFont('helvetica', 'normal') }
  if (data.customer.address) {
    const addr = doc.splitTextToSize(data.customer.address, boxW - 5)
    doc.text(addr.slice(0, 1), billX + 2.5, custY)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(...A)
  doc.text(isService ? 'SERVICE DETAILS' : 'PAYMENT & SHIPPING DETAILS', shipX + 2.5, y + 3.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...N.textMid)
  let shipY = y + 7.5
  if (isService) {
    doc.text(`Service: ${data.notes?.slice(0, 60) || 'Repair / Service'}`, shipX + 2.5, shipY); shipY += 3.2
    if ((data as any).serviceType) { doc.text(`Type: ${(data as any).serviceType}`, shipX + 2.5, shipY); shipY += 3.2 }
  } else {
    doc.text(`Payment: ${(data.paymentType || 'CASH').toUpperCase()} | Status: ${(data.paymentStatus || 'UNPAID').toUpperCase()}`, shipX + 2.5, shipY); shipY += 3.2
    if (Number(data.amountDue) > 0) { doc.setFont('helvetica', 'bold'); doc.setTextColor(...N.red); doc.text(`Balance Due: ${formatCurrency(data.amountDue || 0)}`, shipX + 2.5, shipY); doc.setFont('helvetica', 'normal'); doc.setTextColor(...N.textMid) }
    if (data.placeOfSupply) { shipY += 3.2; doc.text(`Place: ${data.placeOfSupply}`, shipX + 2.5, shipY) }
  }
  y += boxH + 4

  // ===== ITEMS TABLE - UNIFIED 8 COLS (matches HTML preview) =====
  // Columns: # | Item name (with SKU + unit) | HSN | Qty (with unit) | Rate | Taxable | GST | Total
  const tableHeaders = ['#', 'Item / Description', 'HSN', 'Qty', 'Rate', 'Taxable', 'GST', 'Total']
  const tableBody = data.calc.items.map((item: any, idx: number) => {
    const qtyDisplay = `${item.quantity} ${item.unit || 'pcs'}`
    const skuPart = item.sku ? `\nSKU: ${item.sku}` : ''
    const nameDisplay = `${item.name}${skuPart}`
    const taxable = Number(item.amount) || 0
    const gstAmt = Number(item.gstAmount) || 0
    const gstDisplay = gstAmt > 0 ? `${gstAmt.toFixed(2)} (${Number(item.gstRate) || 0}%)` : '-'
    return [
      idx + 1,
      nameDisplay,
      item.hsnCode || '-',
      qtyDisplay,
      Number(item.rate).toFixed(2),
      taxable.toFixed(2),
      gstDisplay,
      Number(item.total).toFixed(2),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 1.8, textColor: N.textDark, valign: 'middle', lineWidth: 0.1, lineColor: N.border },
    headStyles: { fillColor: TH, textColor: N.white, fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: N.bgRow },
    didDrawPage: (d: any) => { y = d.cursor?.y || y },
  } as any)
  y = (doc as any).lastAutoTable.finalY + 6

  // ===== HSN SUMMARY =====
  const hsnSummary = calculateHSNSummary(data.calc.items)
  if (hsnSummary.length > 0 && hsnSummary.some((h: any) => h.total > 0)) {
    // Check space
    if (y + 22 > NORMAL_LIMIT) { doc.addPage(); pageNumber++; y = margin }
    autoTable(doc, {
      startY: y,
      head: [['HSN/SAC', 'Taxable', 'CGST', 'SGST', 'Total Tax']],
      body: hsnSummary.map((h: any) => [
        `${h.hsn} (${h.gstRate}%)`,
        `Rs. ${h.taxable.toFixed(2)}`,
        `Rs. ${h.cgstAmt.toFixed(2)}`,
        `Rs. ${h.sgstAmt.toFixed(2)}`,
        `Rs. ${h.total.toFixed(2)}`,
      ]),
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.4, textColor: N.textMid },
      headStyles: { fillColor: N.bgRow, textColor: N.textDark, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    } as any)
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // Ensure totals fit with signature + banner on same page if possible
  // Totals need approx 45mm, signature 22, banner 32, footer 10 = 109mm
  if (y + 55 > NORMAL_LIMIT) { doc.addPage(); pageNumber++; y = margin }

  // ===== TOTALS & WORDS - side by side =====
  const totalsW = 68
  const totalsX = pageWidth - margin - totalsW
  const leftColW = totalsX - margin - 6
  const wordsY = y

  // Calculate totals box content to know height
  let currentTotY = wordsY
  const totalRows: Array<{ label: string; value: string; bold?: boolean; color?: any }> = []
  totalRows.push({ label: 'Sub Total', value: formatCurrency(data.calc.subtotal) })
  const effectiveGstRate = data.calc.items.find((i: any) => i.gstApplicable && Number(i.gstRate) > 0)?.gstRate || 18
  const halfRate = effectiveGstRate / 2
  if (data.calc.gstAmount > 0) {
    // Show CGST+SGST split
    totalRows.push({ label: `CGST (${halfRate}%)`, value: formatCurrency(data.calc.cgstAmount || data.calc.gstAmount / 2) })
    totalRows.push({ label: `SGST (${halfRate}%)`, value: formatCurrency(data.calc.sgstAmount || data.calc.gstAmount / 2) })
  }
  if (data.calc.courierCharges > 0) totalRows.push({ label: 'Courier', value: formatCurrency(data.calc.courierCharges) })
  if (data.calc.otherCharges > 0) totalRows.push({ label: 'Other Charges', value: formatCurrency(data.calc.otherCharges) })
  if (data.calc.discount > 0) totalRows.push({ label: 'Discount', value: `- ${formatCurrency(data.calc.discount)}`, bold: true, color: N.green })

  const totalsBoxH = (totalRows.length * 4.5) + 12 + (Number(data.amountPaid) > 0 || Number(data.amountDue) > 0 ? 10 : 0)

  // Draw totals background box border
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.18)
  doc.setFillColor(...N.bgRow)
  // Left words block - Amount in words
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...N.textVLight)
  doc.text('AMOUNT IN WORDS', margin, wordsY + 3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...N.textDark)
  const wordsText = numberToWords(data.calc.grandTotal) + ' Only'
  const wordsLines = doc.splitTextToSize(wordsText, leftColW)
  doc.text(wordsLines.slice(0, 3), margin, wordsY + 7)

  // Totals table - draw rows manually for PRO control
  let ty = wordsY
  doc.setFillColor(...N.white)
  doc.setDrawColor(...N.border)
  doc.rect(totalsX, ty, totalsW, totalsBoxH + 6)
  for (const r of totalRows) {
    doc.setFont('helvetica', r.bold ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...(r.color || N.textDark))
    doc.text(r.label, totalsX + 2, ty + 4)
    doc.text(r.value, totalsX + totalsW - 2, ty + 4, { align: 'right' })
    ty += 4.5
  }
  // Grand total highlight
  doc.setFillColor(...A)
  doc.rect(totalsX, ty, totalsW, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...N.white)
  doc.text('GRAND TOTAL', totalsX + 2, ty + 5)
  doc.text(formatCurrency(data.calc.grandTotal), totalsX + totalsW - 2, ty + 5, { align: 'right' })
  ty += 8
  if (Number(data.amountPaid) > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(...N.green)
    doc.text('Paid / Advance', totalsX + 2, ty + 3)
    doc.text(`- ${formatCurrency(Number(data.amountPaid) || 0)}`, totalsX + totalsW - 2, ty + 3, { align: 'right' })
    ty += 4.5
  }
  if (Number(data.amountDue) > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...N.red)
    doc.text('Balance Due', totalsX + 2, ty + 3)
    doc.text(formatCurrency(Number(data.amountDue) || 0), totalsX + totalsW - 2, ty + 3, { align: 'right' })
    ty += 4.5
  }

  let leftY = wordsY + (wordsLines.length * 3.5) + 6

  // Bank + UPI QR left side (below words)
  if (data.shop.bankName || data.shop.bankAccount || data.shop.upiId) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...A)
    doc.text('BANK DETAILS & UPI', margin, leftY)
    leftY += 3.2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.2)
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
        const qrAmt = isInvoice ? (Number(data.amountDue) || 0) : data.calc.grandTotal
        const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Shop')}&am=${qrAmt.toFixed(2)}&cu=INR`
        const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 160, margin: 1 })
        const qrSize = 18
        // Check if QR fits
        if (leftY + qrSize > NORMAL_LIMIT - SIGN_H - 5) {
          // Not enough space, add page
          doc.addPage(); pageNumber++; y = margin; leftY = y
          // Redraw words? Simplified: reset leftY
          ty = y + totalsBoxH + 10
        }
        doc.addImage(qrDataUrl, 'PNG', margin, leftY, qrSize, qrSize)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(...A)
        doc.text('Scan & Pay via UPI', margin + qrSize + 3, leftY + 4)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(...N.textMid)
        doc.text(`UPI: ${data.shop.upiId}`, margin + qrSize + 3, leftY + 7.5)
        doc.text(`Amt: ${formatCurrency(qrAmt)}`, margin + qrSize + 3, leftY + 10.5)
        leftY += qrSize + 2
      } catch {}
    }
  }

  y = Math.max(ty + 4, leftY + 4)

  // ===== TERMS & NOTES =====
  const termsText = [data.terms, data.notes].filter(Boolean).join('\n\n')
  if (termsText) {
    if (y + 18 > NORMAL_LIMIT - SIGN_H) { doc.addPage(); pageNumber++; y = margin }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...A)
    doc.text('TERMS & CONDITIONS / NOTES', margin, y)
    y += 3.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.2)
    doc.setTextColor(...N.textMid)
    const termsLines = doc.splitTextToSize(termsText, usableWidth)
    const linesToShow = termsLines.slice(0, 6) // limit to 6 lines to avoid overflow, rest truncated
    doc.text(linesToShow, margin, y)
    y += linesToShow.length * 2.8 + 2
  }

  // ===== SIGNATURE - DYNAMIC (FIX for next page issue) =====
  // Ensure signature fits on current page with footer, else new page
  if (y + SIGN_H + 5 > NORMAL_LIMIT) {
    doc.addPage()
    pageNumber++
    y = margin + 5
  }
  const sigBoxX = pageWidth - margin - 55
  const sigY = y + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...N.textDark)
  doc.text(`For ${data.shop.name || 'Smart Computers'}:`, sigBoxX + 27.5, sigY, { align: 'center' })
  // Space for signature image if any (future)
  doc.setDrawColor(...N.textLight)
  doc.setLineWidth(0.2)
  doc.line(sigBoxX, sigY + 12, pageWidth - margin, sigY + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...N.textLight)
  doc.text('Authorized Signatory', sigBoxX + 27.5, sigY + 15.5, { align: 'center' })
  y = sigY + SIGN_H

  // ===== AD BANNER - Only on last page, reduced height, dynamic =====
  // Check if banner fits
  if (isLastPageReservedForBanner) {
    if (y + BANNER_H + FOOTER_H > pageHeight - margin) {
      doc.addPage()
      pageNumber++
      y = margin + 2
    }
    const bannerY = y + 2
    const posterW = usableWidth
    const posterX = margin
    try {
      const imgs: any = data.productImages || {}
      const variant = data.adBannerVariant || 'grid'
      let bannerImg = null
      if (variant === 'flyer' && imgs['flyer']) bannerImg = imgs['flyer']
      else if (variant === 'grid' && imgs['productgrid']) bannerImg = imgs['productgrid']
      else if (imgs['flyer']) bannerImg = imgs['flyer']

      if (bannerImg) {
        doc.addImage(bannerImg, 'PNG', posterX, bannerY, posterW, BANNER_H)
      } else {
        // Fallback simple banner
        doc.setFillColor(...LB)
        doc.setDrawColor(...A)
        doc.setLineWidth(0.15)
        doc.roundedRect(posterX, bannerY, posterW, BANNER_H, 1, 1, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(...A)
        doc.text('SMART COMPUTERS - IT SOLUTIONS', posterX + 4, bannerY + 7)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...N.textMid)
        doc.text('Computers • Laptops • Printers • CCTV • Accessories & Repair', posterX + 4, bannerY + 10.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...N.textDark)
        const phone = data.shop.phone || ''
        doc.text(phone ? `Call/WhatsApp: ${phone}` : 'Thank you for your business!', posterX + posterW - 4, bannerY + 10.5, { align: 'right' })
      }
    } catch {
      // fallback on error
      doc.setFillColor(...LB)
      doc.setDrawColor(...N.border)
      doc.roundedRect(posterX, bannerY, posterW, BANNER_H, 1, 1, 'FD')
    }
    y = bannerY + BANNER_H + 4
  }

  // ===== FOOTER ON ALL PAGES =====
  drawFooterAll()

  return Buffer.from(doc.output('arraybuffer'))
}
