// WhatsApp helper - generates wa.me links and message templates
// Note: For full automation, use WhatsApp Business API / Twilio / WATI

export interface WhatsAppMessage {
  to: string // phone number with country code, no + sign
  message: string
}

// Generate wa.me link for opening WhatsApp with prefilled message
export function generateWhatsAppLink(phone: string, message: string): string {
  const phoneStr = String(phone ?? '')
  const cleanPhone = phoneStr.replace(/[^\d]/g, '')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${cleanPhone}?text=${encoded}`
}

// Build rate enquiry message for supplier
export function buildEnquiryMessage(
  shopName: string,
  items: { name: string; sku?: string }[],
  enquiryNumber?: string
): string {
  const sn = String(shopName || 'Smart Computers')
  let msg = `*${sn}*\n\n`
  items.forEach((item) => {
    const name = String(item?.name || '').trim()
    if (name) msg += `${name}\n`
  })
  msg += `\nprices?`
  return msg
}

// Build invoice/quote share message
export function buildInvoiceShareMessage(
  shopName: string,
  customerName: string,
  docType: 'invoice' | 'quotation',
  number: string,
  amount: number,
  dueDate?: Date
): string {
  const sn = String(shopName || 'Smart Computers')
  const cn = String(customerName || 'Customer')
  const num = String(number || '')
  const amt = Number(amount) || 0
  let msg = `*${sn}*\n\n`
  msg += `Dear ${cn},\n\n`
  msg += `Here are your ${docType === 'invoice' ? 'invoice' : 'quotation'} details:\n\n`
  msg += `*${docType === 'invoice' ? 'Invoice' : 'Quotation'} No:* ${num}\n`
  msg += `*Amount:* Rs. ${amt.toFixed(2)}\n`
  if (docType === 'invoice' && dueDate) {
    msg += `*Due Date:* ${dueDate.toLocaleDateString('en-IN')}\n`
  } else if (docType === 'quotation' && dueDate) {
    msg += `*Valid Till:* ${dueDate.toLocaleDateString('en-IN')}\n`
  }
  msg += `\nFor any queries, please contact us.\n\nThank you for your business!`
  return msg
}

// Build payment reminder message
export function buildPaymentReminderMessage(
  shopName: string,
  customerName: string,
  invoiceNumber: string,
  amount: number,
  dueDate?: Date
): string {
  const sn = String(shopName || 'Smart Computers')
  const cn = String(customerName || 'Customer')
  const inum = String(invoiceNumber || '')
  const amt = Number(amount) || 0
  let msg = `*${sn}*\n\n`
  msg += `Dear ${cn},\n\n`
  msg += `This is a gentle reminder for the pending payment:\n\n`
  msg += `*Invoice No:* ${inum}\n`
  msg += `*Amount Due:* Rs. ${amt.toFixed(2)}\n`
  if (dueDate) msg += `*Due Date:* ${dueDate.toLocaleDateString('en-IN')}\n`
  msg += `\nKindly arrange the payment at your earliest convenience.\n\nThank you!`
  return msg
}

// Parse rate response from supplier (natural language to structured rates)
export interface ParsedRate {
  itemName: string
  rate: number
  gstApplicable: boolean | null
  gstType: 'extra' | 'inclusive' | 'unknown' | null
  gstRate?: number
  totalCost: number
  raw: string
}

export function parseRateResponse(
  response: string,
  originalItems: { name: string; sku?: string }[]
): ParsedRate[] {
  const lines = response.split(/\n+/)
  const results: ParsedRate[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const lowerTrim = trimmed.toLowerCase()
    if (/^(thank|hello|hi|ok|yes|no|sure|please|dear|regards|best)\b/.test(lowerTrim) && !/\d{2,}/.test(trimmed)) {
      continue
    }

    const patterns = [
      /^\d+\.?\s*(.+?):?\s*rs\.?\s*(\d+(?:[.,]\d+)?)/i,
      /^(.+?):?\s*rs\.?\s*(\d+(?:[.,]\d+)?)/i,
      /^\d+\.?\s*(.+?)\s*[-:]\s*(\d+(?:[.,]\d+)?)/,
      /^(.+?):\s*(\d+(?:[.,]\d+)?)/,
      /^(\d+(?:[.,]\d+)?)\s*([+\-].*)?$/,
    ]

    let matched: RegExpMatchArray | null = null
    let itemNameRaw = ''
    let rateStr = ''

    for (const p of patterns) {
      matched = trimmed.match(p)
      if (matched) {
        if (p.source.startsWith('^(\\d+')) {
          rateStr = String(matched[1] || '')
          itemNameRaw = ''
        } else {
          itemNameRaw = String(matched[1] || '').trim()
          rateStr = String(matched[2] || '')
        }
        break
      }
    }

    if (!matched || !rateStr) continue

    const rate = parseFloat(rateStr.replace(/[.,]/g, m => m === ',' ? '' : '.'))
    if (isNaN(rate)) continue

    let itemName = itemNameRaw
    let matchedItem: { name: string; sku?: string } | undefined
    if (itemNameRaw) {
      matchedItem = originalItems.find(
        (i) => {
          const iName = String(i?.name || '').toLowerCase()
          const raw = itemNameRaw.toLowerCase()
          return iName.includes(raw) || raw.includes(iName) ||
                 (i.sku && raw.includes(String(i.sku).toLowerCase()))
        }
      )
      if (matchedItem) itemName = matchedItem.name
    } else {
      const usedNames = new Set(results.map(r => r.itemName))
      matchedItem = originalItems.find(i => !usedNames.has(i.name))
      if (matchedItem) itemName = matchedItem.name
    }

    const fullLine = trimmed.toLowerCase()
    let gstType: 'extra' | 'inclusive' | 'unknown' | null = null
    let gstRate: number | undefined
    let gstApplicable: boolean | null = null

    const gstRateMatch = fullLine.match(/(\d+)\s*%/) || fullLine.match(/gst\s*(\d+)/)
    if (gstRateMatch) gstRate = parseFloat(gstRateMatch[1])

    if (/\d\s*\+/i.test(trimmed) || /\+\s*(gst|18%|18\s*%)/i.test(trimmed) || /gst\s*extra/i.test(fullLine) || /extra\s*gst/i.test(fullLine)) {
      gstType = 'extra'
      gstApplicable = true
      if (!gstRate) gstRate = 18
    } else if (/\bnett\b/i.test(trimmed) || /incl/i.test(fullLine) || /including\s*gst/i.test(fullLine) || /gst\s*incl/i.test(fullLine)) {
      gstType = 'inclusive'
      gstApplicable = true
      if (!gstRate) gstRate = 18
    } else if (/without\s*gst/i.test(fullLine) || /no\s*gst/i.test(fullLine) || /gst\s*no/i.test(fullLine)) {
      gstType = 'extra'
      gstApplicable = false
    } else if (/with\s*gst/i.test(fullLine) || /gst\s*yes/i.test(fullLine)) {
      gstType = 'inclusive'
      gstApplicable = true
      if (!gstRate) gstRate = 18
    } else {
      gstType = 'unknown'
      gstApplicable = null
    }

    let totalCost = rate
    if (gstType === 'extra' && gstRate) {
      totalCost = rate + (rate * gstRate / 100)
    }

    results.push({
      itemName,
      rate,
      gstApplicable,
      gstType,
      gstRate,
      totalCost: Math.round(totalCost * 100) / 100,
      raw: trimmed,
    })
  }

  return results
}

// Build bulk enquiry payload
export function buildBulkEnquiry(
  shopName: string,
  suppliersWithItems: { supplier: { name: string; phone: string; whatsappNumber: string }; items: { name: string; sku?: string }[] }[]
): WhatsAppMessage[] {
  return suppliersWithItems.map(({ supplier, items }) => ({
    to: supplier.whatsappNumber || supplier.phone,
    message: buildEnquiryMessage(shopName, items),
  }))
}

// Schedule helper
export function getNextEnquiryDates(from: Date = new Date()): Date[] {
  const dates: Date[] = []
  const now = new Date(from)
  const day = now.getDate()

  const next1st = new Date(now.getFullYear(), now.getMonth() + (day >= 1 ? 1 : 0), 1)
  const next15th = new Date(now.getFullYear(), now.getMonth() + (day >= 15 ? 1 : 0), 15)

  dates.push(next1st, next15th)
  dates.sort((a, b) => a.getTime() - b.getTime())
  return dates
}

export function isEnquiryDay(date: Date = new Date()): boolean {
  const day = date.getDate()
  return day === 1 || day === 15
}

/**
 * Shares Invoice / Quotation / Service Invoice details on WhatsApp.
 * NO PDF attachment. NO View Link. Only clean text message.
 */
export async function shareWhatsAppPdf({
  docId,
  docType,
  docNumber,
  customerName,
  customerPhone,
  grandTotal,
  amountDue,
  notes,
  toast,
}: {
  docId: string
  docType: 'invoice' | 'quotation' | 'service'
  docNumber: string
  customerName: string
  customerPhone?: string
  grandTotal: number
  amountDue?: number
  notes?: string
  toast?: any
}) {
  try {
    const cleanPhone = String(customerPhone || '').replace(/[^\d]/g, '')
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone.length > 10 ? cleanPhone : ''

    const isPaid = (amountDue ?? 0) <= 0
    const statusText = isPaid ? 'PAID ✓' : `Balance Due: Rs. ${Number(amountDue).toFixed(2)}`
    const titleLabel = docType === 'invoice' ? 'Invoice' : docType === 'quotation' ? 'Quotation' : 'Service Invoice'

    const messageText = `*Smart Computers*\n\n` +
      `Dear *${customerName || 'Customer'}*,\n\n` +
      `Here are your ${titleLabel.toLowerCase()} details:\n\n` +
      `*${titleLabel} No:* ${docNumber}\n` +
      `*Total Amount:* Rs. ${Number(grandTotal).toFixed(2)}\n` +
      `*Status:* ${statusText}\n` +
      `${notes ? `*Notes:* ${notes}\n` : ''}\n` +
      `For any queries, please contact us.\n\n` +
      `Thank you for your business! 🙏`

    // Open WhatsApp directly with text only — NO PDF, NO View Link
    const waUrl = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`

    window.open(waUrl, '_blank')

    if (toast) {
      toast({
        title: 'WhatsApp Opened ✓',
        description: `Message ready for ${customerName || 'Customer'}`,
        duration: 3500,
      })
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      if (toast) toast({ title: 'Share failed', description: e.message || 'Error sharing', variant: 'destructive', duration: 5000 })
    }
  }
}
