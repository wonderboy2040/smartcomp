// Calculation helpers for invoices, quotations, profit, GST

export interface LineItem {
  itemId?: string
  name: string
  sku?: string
  hsnCode?: string
  quantity: number
  rate: number // selling price excluding GST
  gstApplicable: boolean
  gstRate: number // 0, 5, 12, 18, 28
  costPrice?: number // for profit calc
  discount?: number // per-item discount
}

export interface ComputedLineItem extends LineItem {
  amount: number // rate * qty - discount
  gstAmount: number
  total: number // amount + gstAmount
  costTotal: number // costPrice * qty
  profit: number // amount - costTotal
}

export interface InvoiceCalc {
  items: ComputedLineItem[]
  subtotal: number
  gstAmount: number
  sgstAmount: number
  cgstAmount: number
  courierCharges: number
  otherCharges: number
  discount: number
  grandTotal: number
  totalCost: number
  profit: number
}

export function computeLineItem(item: LineItem): ComputedLineItem {
  const qty = Number(item.quantity) || 0
  const rate = Number(item.rate) || 0
  const discount = Number(item.discount) || 0
  const amount = Math.max(0, rate * qty - discount)
  const gstAmount = item.gstApplicable
    ? (amount * (Number(item.gstRate) || 0)) / 100
    : 0
  const total = amount + gstAmount
  const costTotal = (Number(item.costPrice) || 0) * qty
  const profit = amount - costTotal
  return {
    ...item,
    amount: round2(amount),
    gstAmount: round2(gstAmount),
    total: round2(total),
    costTotal: round2(costTotal),
    profit: round2(profit),
  }
}

export function computeInvoice(
  items: LineItem[],
  options: {
    courierCharges?: number
    otherCharges?: number
    discount?: number
  } = {}
): InvoiceCalc {
  const computed = items.map(computeLineItem)
  const subtotal = computed.reduce((s, i) => s + i.amount, 0)
  const gstAmount = computed.reduce((s, i) => s + i.gstAmount, 0)
  const sgstAmount = round2(gstAmount / 2)  // SGST = 50% of total GST
  const cgstAmount = round2(gstAmount / 2)  // CGST = 50% of total GST
  const courierCharges = Number(options.courierCharges) || 0
  const otherCharges = Number(options.otherCharges) || 0
  const discount = Number(options.discount) || 0
  const grandTotal = Math.max(
    0,
    subtotal + gstAmount + courierCharges + otherCharges - discount
  )
  const totalCost = computed.reduce((s, i) => s + i.costTotal, 0)
  const profit = subtotal - totalCost - discount
  return {
    items: computed,
    subtotal: round2(subtotal),
    gstAmount: round2(gstAmount),
    sgstAmount,
    cgstAmount,
    courierCharges: round2(courierCharges),
    otherCharges: round2(otherCharges),
    discount: round2(discount),
    grandTotal: round2(grandTotal),
    totalCost: round2(totalCost),
    profit: round2(profit),
  }
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  const n = Number(amount) || 0
  if (currency === 'INR') {
    return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatNumber(n: number): string {
  return (Number(n) || 0).toLocaleString('en-IN')
}

// Generate next invoice number: SCSS/YY-YY/NNN
// e.g., SCSS/26-27/001 (financial year 2026-27, sequence 001)
export async function nextInvoiceNumber(
  existing: { number: string | number }[]
): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  // Financial year: April to March
  // If month >= April (4), FY = year-year+1, else FY = (year-1)-year
  const fyStart = month >= 4 ? year : year - 1
  const fyEnd = fyStart + 1
  const fyShort = `${String(fyStart).slice(2)}-${String(fyEnd).slice(2)}`
  const base = `SCSS/${fyShort}/`
  let max = 0
  for (const r of existing) {
    const num = String(r?.number || '')
    if (num.startsWith(base)) {
      const suffix = parseInt(num.slice(base.length), 10)
      if (!isNaN(suffix) && suffix > max) max = suffix
    }
  }
  return `${base}${String(max + 1).padStart(3, '0')}`
}

// Generate next quotation number: SCSS/QT/NNN
export async function nextQuotationNumber(
  existing: { number: string | number }[]
): Promise<string> {
  const base = `SCSS/QT/`
  let max = 0
  for (const r of existing) {
    const num = String(r?.number || '')
    if (num.startsWith(base)) {
      const suffix = parseInt(num.slice(base.length), 10)
      if (!isNaN(suffix) && suffix > max) max = suffix
    }
  }
  return `${base}${String(max + 1).padStart(3, '0')}`
}

// Legacy function kept for backward compatibility
export async function nextNumber(
  prefix: string,
  existing: { number: string | number }[]
): Promise<string> {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const base = `${prefix}${year}${month}`
  let max = 0
  for (const r of existing) {
    const num = String(r?.number || '')
    if (num.startsWith(base)) {
      const suffix = parseInt(num.slice(base.length), 10)
      if (!isNaN(suffix) && suffix > max) max = suffix
    }
  }
  return `${base}${String(max + 1).padStart(3, '0')}`
}

// Indian number format in words for invoice amount
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero'
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
    'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const inWords = (n: number): string => {
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '')
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '')
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '')
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '')
  }
  const rupees = Math.floor(num)
  const paise = Math.round((num - rupees) * 100)
  let words = 'Rs. ' + inWords(rupees) + ' Only'
  if (paise > 0) {
    words = 'Rs. ' + inWords(rupees) + ' and ' + inWords(paise) + ' Paise Only'
  }
  return words
}
