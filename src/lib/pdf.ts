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
  // Base64 product images for the bottom advertising showcase banner
  productImages?: Record<string, string>
  // Advertising banner style: 'grid' | 'featured' | 'strip'
  adBannerVariant?: string
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

// Advertising banner style variants shown on every printed sheet
export const AD_BANNER_VARIANTS = [
  { id: 'grid', name: 'Product Grid', description: 'Premium 4x4 product-grid flyer image' },
  { id: 'featured', name: 'Featured Mix', description: 'Headline panel + product showcase' },
  { id: 'strip', name: 'Compact Strip', description: 'Minimal image pills + Call/Visit CTA' },
  { id: 'flyer', name: 'Premium Flyer', description: 'Full premium A4 flyer promo card' },
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

// Blend two RGB colors (t = 0 -> a, t = 1 -> b)
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
  const pageEnds: Record<number, number> = {} // per-page content-end Y (for the responsive band)

  // ===== A4 PAGE LAYOUT ZONES (all values in mm from page top) =====
  //
  //  0mm ┌─────────────────────────┐
  //      │       HEADER (34mm)     │
  //      ├─────────────────────────┤  ~40mm
  //      │    Bill-To / Ship-To    │
  //      ├─────────────────────────┤  ~80mm
  //      │      ITEMS TABLE        │
  //      │   (auto-paginated)      │
  //      ├─────────────────────────┤  ← CONTENT_LIMIT (242mm)
  //      │  Totals / Bank / Terms  │
  //      │  Signature              │
  //      ├─────────────────────────┤  ← BAND_BOTTOM - band height
  //      │   AD BANNER (24-48mm)   │
  //      ├─────────────────────────┤  ← BAND_BOTTOM (282mm)
  //      │   FOOTER (15mm)         │
  //      └─────────────────────────┘ 297mm
  //
  const FOOTER_Y     = pageHeight - 8   // 289mm — footer text baseline
  const FOOTER_LINE  = pageHeight - 10  // 287mm — footer separator line
  const BAND_BOTTOM  = FOOTER_LINE - 2  // 285mm — ad banner must end above this
  const AD_BAND_MIN  = 24               // smallest possible ad band
  const AD_BAND_MAX  = 48               // largest possible ad band
  const AD_GAP       = 4                // gap between content end and ad band top
  const SIG_H        = 14               // space reserved for signature block
  // Content must stop here so there is room for signature + minimum ad band + footer
  const CONTENT_LIMIT = BAND_BOTTOM - AD_BAND_MIN - SIG_H - AD_GAP // ~235mm
  // autoTable bottom margin (distance from page bottom where table triggers a page break)
  const TABLE_BOTTOM_MARGIN = pageHeight - CONTENT_LIMIT // ~62mm

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
    doc.line(margin, FOOTER_LINE, pageWidth - margin, FOOTER_LINE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...N.textVLight)
    const footerText = `${isInvoice ? 'Invoice' : isService ? 'Service Invoice' : 'Quotation'} ${data.number} | ${data.shop.name || 'Smart Computers'} | ${totalPages > 1 ? `Page ${pageNum} of ${totalPages} | ` : ''}Computer generated | ${formatDateTime(new Date())}`
    doc.text(footerText, pageWidth / 2, FOOTER_Y, { align: 'center', maxWidth: usableWidth })
  }

  const addPageIfNeeded = (requiredSpace: number): boolean => {
    if (y + requiredSpace > CONTENT_LIMIT) {
      drawFooter(pageNumber, 1)
      doc.addPage()
      pageNumber++
      y = margin + 5
      return true
    }
    return false
  }

  // ===== HEADER - A4 Perfect Fit =====
  const headerHeight = 34
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
  doc.setFontSize(20)
  doc.setTextColor(...HT)
  const shopNameX = margin + logoOffset
  doc.text(data.shop.name || 'Smart Computers', shopNameX, y + 6, { maxWidth: 96 })

  // Shop details - Compact, A4 optimized
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...subColor)
  let infoY = y + 11
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
  doc.setFontSize(18)
  doc.setTextColor(...A)
  let docTitle = isInvoice ? 'TAX INVOICE' : isService ? 'SERVICE INVOICE' : 'QUOTATION'
  if (tpl.id === 'gst-vibrant-bold') docTitle = `★ ${docTitle} ★`
  doc.text(docTitle, rightX, y + 2, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...subColor)
  let metaY = y + 8
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
  const boxHeight = 34
  const halfWidth = (usableWidth - 4) / 2

  // Bill To
  doc.setFillColor(...LB)
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.15)
  doc.roundedRect(margin, y, halfWidth, boxHeight, 1.5, 1.5, 'FD')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...A)
  doc.text(isInvoice ? 'BILL TO / CUSTOMER DETAILS' : isService ? 'BILL TO / SERVICE CUSTOMER' : 'QUOTE TO', margin + 3, y + 4)
  
  doc.setDrawColor(...A)
  doc.setLineWidth(0.3)
  doc.line(margin + 3, y + 5.5, margin + 30, y + 5.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...N.textDark)
  doc.text(data.customer.name || 'Walk-in Customer', margin + 3, y + 11, { maxWidth: halfWidth - 6 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...N.textMid)
  let by = y + 15
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
    doc.setFontSize(8.5)
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
    doc.setFontSize(8.5)
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
    { header: 'Item name', dataKey: 'name' },
    { header: 'HSN/ SAC', dataKey: 'hsn' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'Unit', dataKey: 'unit' },
    { header: 'GST (Rs.)', dataKey: 'gst' },
    { header: 'Taxable', dataKey: 'taxable' },
    { header: 'Rate (Rs.)', dataKey: 'rate' },
    { header: 'Amount (Rs.)', dataKey: 'total' },
  ]

  const tableBody = data.calc.items.map((item, i) => ({
    no: String(i + 1),
    name: item.name,
    hsn: item.hsnCode || '-',
    qty: String(item.quantity),
    unit: (item as any).unit || 'Nos',
    gst: item.gstApplicable ? formatCurrency(item.gstAmount).replace('Rs. ', '') : '-',
    taxable: formatCurrency(item.amount).replace('Rs. ', ''),
    rate: formatCurrency(item.rate).replace('Rs. ', ''),
    total: formatCurrency(item.total).replace('Rs. ', ''),
  }))

  // Check if we need new page for table
  addPageIfNeeded(40)

  autoTable(doc, {
    startY: y,
    head: [tableColumns.map(c => c.header)],
    body: tableBody.map(r => tableColumns.map(c => (r as any)[c.dataKey])),
    margin: { left: margin, right: margin, bottom: TABLE_BOTTOM_MARGIN },
    styles: {
      fontSize: 10,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
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
      fontSize: 10,
      cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 },
      lineColor: TH,
      lineWidth: 0,
      minCellHeight: 9,
    },
    bodyStyles: {
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      fontSize: 10,
      minCellHeight: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, fontSize: 9 },
      1: { cellWidth: 'auto', fontStyle: 'bold', halign: 'left' },
      2: { halign: 'center', cellWidth: 16, fontSize: 9 },
      3: { halign: 'center', cellWidth: 12, fontSize: 9 },
      4: { halign: 'center', cellWidth: 12, fontSize: 9 },
      5: { halign: 'right', cellWidth: 20, fontSize: 9 },
      6: { halign: 'right', cellWidth: 20, fontSize: 9 },
      7: { halign: 'right', cellWidth: 20, fontSize: 9 },
      8: { halign: 'right', cellWidth: 22, fontStyle: 'bold', fontSize: 10 },
    },
    alternateRowStyles: { fillColor: N.bgRow },
    didParseCell: (data: any) => {
      // Bold total column
      if (data.column.index === 8 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: (data: any) => {
      // Record where this page's table content ended so the ad band can be
      // sized responsively (and keep our y cursor in sync).
      y = data.cursor.y
      pageEnds[data.pageNumber] = data.cursor.y
    },
  })

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 4
  // autoTable adds its own pages internally — keep our page counter in sync
  pageNumber = Math.max(pageNumber, doc.getNumberOfPages())

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
      head: [['HSN/ SAC', 'Taxable amount (Rs.)', 'CGST Rate', 'CGST Amt (Rs.)', 'SGST Rate', 'SGST Amt (Rs.)', 'Total Tax (Rs.)']],
      body: hsnSummary.map(h => [
        h.hsn,
        formatCurrency(h.taxable).replace('Rs. ', ''),
        `${h.cgstRate}%`,
        formatCurrency(h.cgstAmt).replace('Rs. ', ''),
        `${h.sgstRate}%`,
        formatCurrency(h.sgstAmt).replace('Rs. ', ''),
        formatCurrency(h.total).replace('Rs. ', ''),
      ]),
      margin: { left: margin, right: margin, bottom: TABLE_BOTTOM_MARGIN },
      styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
      headStyles: { fillColor: N.bgRowAlt, textColor: N.textDark, fontStyle: 'bold', fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 20 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20 },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: (data: any) => {
        pageEnds[data.pageNumber] = data.cursor.y
      },
    })
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 4
  }
  // autoTable may have added pages for the HSN summary too
  pageNumber = Math.max(pageNumber, doc.getNumberOfPages())

  // ===== TOTALS - A4 Perfect Fit - Right Aligned =====
  const totalsWidth = 72
  const totalsX = pageWidth - margin - totalsWidth
  let totalsY = y
  const rowHeight = 5.5

  // Check if totals need new page (keep together, above the band)
  if (y + 50 > CONTENT_LIMIT) {
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
    doc.setFontSize(bold ? 11 : 10)
    doc.setTextColor(...(textColor || N.textMid))
    doc.text(label, totalsX + 3, totalsY + 4)
    doc.text(value, totalsX + totalsWidth - 3, totalsY + 4, { align: 'right' })
    totalsY += rowHeight
  }

  // Border for totals section
  doc.setDrawColor(...N.border)
  doc.setLineWidth(0.15)
  
  drawTotalsRow('Sub Total', formatCurrency(data.calc.subtotal), { bold: false })
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

  // Grand Total - Highlighted (single clean draw)
  totalsY += 1
  const gtRowH = 7 // slightly taller for emphasis
  doc.setFillColor(...A)
  doc.rect(totalsX, totalsY, totalsWidth, gtRowH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...(isLightBg(A) ? N.textDark : N.white))
  doc.text('GRAND TOTAL', totalsX + 3, totalsY + 5)
  doc.text(formatCurrency(data.calc.grandTotal), totalsX + totalsWidth - 3, totalsY + 5, { align: 'right' })
  totalsY += gtRowH

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
  doc.setFontSize(9)
  doc.setTextColor(...N.textVLight)
  doc.text('AMOUNT IN WORDS', margin, wordsY + 2)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...N.textDark)
  const wordsText = `${numberToWords(data.calc.grandTotal)} Only`
  const wordsLines = doc.splitTextToSize(wordsText, totalsX - margin - 6)
  doc.text(wordsLines.slice(0, 3), margin, wordsY + 6) // Max 3 lines for A4 fit

  y = Math.max(totalsY, wordsY + 6 + Math.min(wordsLines.length, 3) * 3.5) + 6

  // ===== BANK + QR + TERMS - A4 Fit =====
  const bottomSectionY = y
  const remainingSpace = CONTENT_LIMIT - y // space left above the band
  const colWidth = (usableWidth - 4) / 2
  const rightColX = margin + colWidth + 4
  let leftY = bottomSectionY
  let rightY = bottomSectionY

  // Bank details — ALWAYS shown (wired from Smart Computers settings)
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

  // UPI QR (only if there is room)
  if (remainingSpace > 40 && data.shop.upiId) {
    const qrAmount = isInvoice ? (Number(data.amountDue) || 0) : data.calc.grandTotal
    if (qrAmount > 0) {
      try {
        const upiLink = `upi://pay?pa=${encodeURIComponent(data.shop.upiId)}&pn=${encodeURIComponent(data.shop.name || 'Shop')}&am=${qrAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.number || '')}`
        const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 180, margin: 1 })
        const qrSize = 22
        doc.addImage(qrDataUrl, 'PNG', margin, leftY, qrSize, qrSize)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...A)
        doc.text('Scan & Pay', margin + qrSize + 3, leftY + 4)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...N.textMid)
        doc.text(`Rs.${qrAmount.toFixed(2)} via UPI`, margin + qrSize + 3, leftY + 8)
        doc.text(`${data.shop.upiId}`, margin + qrSize + 3, leftY + 11)
        leftY += qrSize + 4
      } catch {}
    }
  }

  // Terms & Notes (only if there is room)
  if (remainingSpace > 40 && (data.terms || data.notes)) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...A)
    doc.text(data.notes && data.terms ? 'TERMS & NOTES' : data.terms ? 'TERMS & CONDITIONS' : 'NOTES', rightColX, rightY)
    rightY += 3.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...N.textMid)
    const combinedText = `${data.terms ? data.terms : ''}${data.terms && data.notes ? '\n' : ''}${data.notes ? data.notes : ''}`
    const termLines = doc.splitTextToSize(combinedText, colWidth - 4)
    const limitedLines = termLines.slice(0, 8)
    doc.text(limitedLines, rightColX, rightY)
    rightY += limitedLines.length * 2.8 + 2
  } else if (remainingSpace <= 40) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...N.textLight)
    doc.text('Thank you for your business!', rightColX, rightY)
    doc.text(`Warranty as per manufacturer | ${data.shop.name}`, rightColX, rightY + 3)
  }

  y = Math.max(leftY, rightY) + 4

  // ===== PRODUCT SHOWCASE AD BANNER (advertise on EVERY page) =====
  // Premium branded strip with product images (Computers, Laptops,
  // Printers, Accessories) so every printed invoice / quotation / service
  // invoice promotes the shop. Several style variants are available and
  // drawn in the reserved bottom band of each page.
  const AD_PRODUCTS = [
    { key: 'computers', label: 'Computers' },
    { key: 'laptop', label: 'Laptops' },
    { key: 'printers', label: 'Printers' },
    { key: 'accessories', label: 'Accessories' },
  ]

  const drawAdBanner = (variant: string, topY: number, bandH: number) => {
    const bx = margin
    const bw = usableWidth
    const by = topY
    const imgs: Record<string, string> = data.productImages || {}
    const phone = data.shop.phone || ''
    const shopName = data.shop.name || 'Smart Computers'

    // Shared band background (very light accent tint) + accent border
    doc.setFillColor(...mixColor(A, N.white, 0.94))
    doc.setDrawColor(...A)
    doc.setLineWidth(0.4)
    doc.roundedRect(bx, by, bw, bandH, 1.8, 1.8, 'FD')

    // Place an image to COVER the given box (fill fully, no side margins,
    // crop overflow) so the banner reads as one merged full-width visual.
    const placeCover = (key: string, x: number, y: number, w: number, h: number) => {
      const im = imgs[key]
      if (!im) return
      let ar = 1.78
      try { const p = (doc as any).getImageProperties(im); ar = p.width / p.height } catch {}
      let dw = w, dh = w / ar
      if (dh < h) { dh = h; dw = h * ar }
      const dx = x + (w - dw) / 2
      const dy = y + (h - dh) / 2
      try { doc.addImage(im, 'PNG', dx, dy, dw, dh) } catch {}
    }

    // ---- Variant: premium A4 flyer (landscape, full) + product tiles, text below ----
    if (variant === 'flyer') {
      const pad = 2
      const imgX = bx + pad
      const imgY = by + pad
      const imgW = bw - pad * 2
      const imgH = bandH - 12 // room for the centered caption below
      placeCover('flyer', imgX, imgY, imgW, imgH)
      const capY = imgY + imgH + 3.5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...A)
      doc.text('CHECK OUT OUR LATEST OFFERS!', bx + bw / 2, capY, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...N.textMid)
      const cap2 = phone ? `Call ${phone}  •  Computers • Laptops • Printers • Accessories` : `Computers • Laptops • Printers • Accessories`
      doc.text(cap2, bx + bw / 2, capY + 4.5, { align: 'center' })
      return
    }

    // ---- Variant: product grid — premium 4x4 grid image, centered & resizable ----
    if (variant === 'grid') {
      const pad = 2
      const imgX = bx + pad
      const imgY = by + pad
      const imgW = bw - pad * 2
      const imgH = bandH - 12
      if (imgs['productgrid']) {
        placeCover('productgrid', imgX, imgY, imgW, imgH)
      } else {
        // Fallback: 4 clean product tiles
        const gap = 8
        const tileW = (usableWidth - gap * (AD_PRODUCTS.length - 1)) / AD_PRODUCTS.length
        const imgSize = Math.min(tileW - 6, imgH - 4)
        const totalW = tileW * AD_PRODUCTS.length + gap * (AD_PRODUCTS.length - 1)
        const startX = bx + (usableWidth - totalW) / 2
        AD_PRODUCTS.forEach((p, i) => {
          const tx = startX + i * (tileW + gap)
          doc.setFillColor(...N.white)
          doc.setDrawColor(...mixColor(A, N.white, 0.65))
          doc.setLineWidth(0.3)
          doc.roundedRect(tx, imgY, tileW, imgH, 1.5, 1.5, 'FD')
          if (imgs[p.key]) { try { doc.addImage(imgs[p.key], 'PNG', tx + (tileW - imgSize) / 2, imgY + 2, imgSize, imgSize) } catch {} }
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...N.textDark)
          doc.text(p.label, tx + tileW / 2, imgY + imgH - 1, { align: 'center' })
        })
      }
      const capY = imgY + imgH + 3.5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...A)
      doc.text('CHECK OUT OUR LATEST OFFERS!', bx + bw / 2, capY, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...N.textMid)
      const cap2 = phone ? `Call ${phone}  •  Computers • Laptops • Printers • Accessories` : `Computers • Laptops • Printers • Accessories`
      doc.text(cap2, bx + bw / 2, capY + 4.5, { align: 'center' })
      return
    }    // ---- Variant: featured (headline panel + product tiles) ----
    if (variant === 'featured') {
      const leftW = 56
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...A)
      doc.text('WE ALSO', bx + 4, by + 10)
      doc.text('SUPPLY', bx + 4, by + 18)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...N.textMid)
      doc.text(shopName, bx + 4, by + 23)
      if (phone) doc.text(`Call: ${phone}`, bx + 4, by + 27)
      const tilesX = bx + leftW + 6
      const tilesW = bw - leftW - 6
      const gap = 5
      const tileW = (tilesW - gap * (AD_PRODUCTS.length - 1)) / AD_PRODUCTS.length
      const tileTop = by + 4
      const imgSize = 22
      const tileH = bandH - 8
      AD_PRODUCTS.forEach((p, i) => {
        const tx = tilesX + i * (tileW + gap)
        doc.setFillColor(...N.white)
        doc.setDrawColor(...mixColor(A, N.white, 0.6))
        doc.setLineWidth(0.25)
        doc.roundedRect(tx, tileTop, tileW, tileH, 1.2, 1.2, 'FD')
        if (imgs[p.key]) {
          try { doc.addImage(imgs[p.key], 'PNG', tx + (tileW - imgSize) / 2, tileTop + 2, imgSize, imgSize) } catch {}
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...N.textDark)
        doc.text(p.label, tx + tileW / 2, tileTop + tileH - 2, { align: 'center' })
      })
      return
    }

    // ---- Variant: compact strip ----
    if (variant === 'strip') {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...A)
      doc.text('WE ALSO SUPPLY', bx + 4, by + bandH / 2 + 1.5)
      const startX = bx + 52
      const endX = bx + bw - 56
      const pillW = (endX - startX) / AD_PRODUCTS.length
      AD_PRODUCTS.forEach((p, i) => {
        const px = startX + i * pillW
        if (imgs[p.key]) {
          try { doc.addImage(imgs[p.key], 'PNG', px + 1, by + (bandH - 16) / 2, 16, 16) } catch {}
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...N.textDark)
        doc.text(p.label, px + 19, by + bandH / 2 + 1.5)
      })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...A)
      const cta = phone ? `Call: ${phone}` : shopName
      doc.text(cta, bx + bw - 4, by + bandH / 2 + 1.5, { align: 'right' })
      return
    }
  }

  // ===== Responsive ad band — drawn on EVERY page, sized to the white space =====
  const adVariant = data.adBannerVariant || 'grid'
  const lastContentEnd = y

  // Compute band geometry: fills bottom white space, clamped to [AD_BAND_MIN, AD_BAND_MAX]
  const computeBand = (contentEnd: number) => {
    // Band top = content end + gap, but never higher than BAND_BOTTOM - AD_BAND_MAX
    let top = Math.max(contentEnd + AD_GAP, BAND_BOTTOM - AD_BAND_MAX)
    let h = BAND_BOTTOM - top
    if (h < AD_BAND_MIN) { h = AD_BAND_MIN; top = BAND_BOTTOM - h }
    if (h > AD_BAND_MAX) { h = AD_BAND_MAX; top = BAND_BOTTOM - h }
    return { top, h }
  }

  // ===== SIGNATURE (last page only) — placed just above the ad band =====
  const lastBand = computeBand(lastContentEnd)
  const sigY = lastBand.top - 2 // 2mm gap above the band

  doc.setPage(pageNumber)
  doc.setDrawColor(...N.textVLight)
  doc.setLineWidth(0.2)
  const sigLineX = pageWidth - margin - 45
  doc.line(sigLineX, sigY, pageWidth - margin, sigY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...N.textDark)
  doc.text(`For ${data.shop.name || 'Smart Computers'}:`, sigLineX + 22.5, sigY - 3, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...N.textLight)
  doc.text('Authorized Signatory', sigLineX + 22.5, sigY + 4, { align: 'center' })

  // Draw ad banners on every page
  for (let i = 1; i <= pageNumber; i++) {
    doc.setPage(i)
    const pe = i < pageNumber ? (pageEnds[i] ?? margin + 10) : lastContentEnd
    const { top, h } = computeBand(pe)
    drawAdBanner(adVariant, top, h)
  }

  // Draw all footers
  for (let i = 1; i <= pageNumber; i++) {
    doc.setPage(i)
    drawFooter(i, pageNumber)
  }
  doc.setPage(pageNumber)

  return Buffer.from(doc.output('arraybuffer'))
}
