// WhatsApp helper - generates wa.me links and message templates
// Note: For full automation, use WhatsApp Business API / Twilio / WATI

export interface WhatsAppMessage {
  to: string // phone number with country code, no + sign
  message: string
}

// Generate wa.me link for opening WhatsApp with prefilled message
export function generateWhatsAppLink(phone: string, message: string): string {
  // Defensive: Google Sheets may store phone as a number, not a string.
  // Coerce to string before calling .replace(). Also handle null/undefined.
  const phoneStr = String(phone ?? '')
  const cleanPhone = phoneStr.replace(/[^\d]/g, '')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${cleanPhone}?text=${encoded}`
}

// Build rate enquiry message for supplier
// SIMPLE FORMAT — just shop name, item list, and "prices?"
// Suppliers in the computer hardware trade prefer short messages.
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
  msg += `Please find attached ${docType === 'invoice' ? 'invoice' : 'quotation'}:\n\n`
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
//
// Handles common Indian computer hardware trade reply formats:
//   "3450+"            → rate=3450, gstType='extra'  (GST is ADDITIONAL, 18% on top)
//   "3450 nett"        → rate=3450, gstType='inclusive' (GST is INCLUDED in price)
//   "3450"             → rate=3450, gstType='unknown'
//   "3450 + GST"       → rate=3450, gstType='extra'
//   "3450 + 18%"       → rate=3450, gstType='extra', gstRate=18
//   "3450 incl GST"    → rate=3450, gstType='inclusive'
//   "3450 (GST extra)" → rate=3450, gstType='extra'
//   "3450 (GST incl)"  → rate=3450, gstType='inclusive'
//   "GST: 3450+"       → same as above
//
// totalCost = what you actually pay:
//   - extra:     rate + (rate * gstRate/100), e.g. 3450 + 18% = 4071
//   - inclusive: rate (already includes GST)
//   - unknown:   rate (treated as inclusive for safety)
export interface ParsedRate {
  itemName: string
  rate: number          // the base rate as quoted
  gstApplicable: boolean | null
  gstType: 'extra' | 'inclusive' | 'unknown' | null
  gstRate?: number
  totalCost: number     // effective cost including GST if extra
  raw: string           // original line text
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

    // Skip lines that are clearly not rate lines (greetings, thank you, etc.)
    const lowerTrim = trimmed.toLowerCase()
    if (/^(thank|hello|hi|ok|yes|no|sure|please|dear|regards|best)\b/.test(lowerTrim) && !/\d{2,}/.test(trimmed)) {
      continue
    }

    // Patterns to extract item name + rate. Order matters — try most specific first.
    const patterns = [
      // "1. Item Name: Rs.3450+" or "1. Item Name: 3450 nett"
      /^\d+\.?\s*(.+?):?\s*rs\.?\s*(\d+(?:[.,]\d+)?)/i,
      // "Item Name: Rs.3450+"
      /^(.+?):?\s*rs\.?\s*(\d+(?:[.,]\d+)?)/i,
      // "1. Item Name - 3450+"
      /^\d+\.?\s*(.+?)\s*[-:]\s*(\d+(?:[.,]\d+)?)/,
      // "Item Name: 3450+"
      /^(.+?):\s*(\d+(?:[.,]\d+)?)/,
      // "3450+" (rate only, no item name — match by line number to original items)
      /^(\d+(?:[.,]\d+)?)\s*([+\-].*)?$/,
    ]

    let matched: RegExpMatchArray | null = null
    let itemNameRaw = ''
    let rateStr = ''

    for (const p of patterns) {
      matched = trimmed.match(p)
      if (matched) {
        if (p.source.startsWith('^(\\d+')) {
          // Rate-only pattern (last one) — no item name in the line
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

    // Match item name to original items (or assign by line order if no name)
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
      // Rate-only line: assign to the next unmatched original item by order
      const usedNames = new Set(results.map(r => r.itemName))
      matchedItem = originalItems.find(i => !usedNames.has(i.name))
      if (matchedItem) itemName = matchedItem.name
    }

    // Detect GST type from the line text
    const fullLine = trimmed.toLowerCase()
    let gstType: 'extra' | 'inclusive' | 'unknown' | null = null
    let gstRate: number | undefined
    let gstApplicable: boolean | null = null

    // Extract GST rate if mentioned (e.g. "18%", "18 %", "GST 18")
    const gstRateMatch = fullLine.match(/(\d+)\s*%/) || fullLine.match(/gst\s*(\d+)/)
    if (gstRateMatch) gstRate = parseFloat(gstRateMatch[1])

    // "3450+" → GST extra (the + suffix is trade shorthand for "plus GST")
    // "3450 + GST", "3450 (GST extra)", "3450 GST extra", "3450 + 18%"
    if (/\d\s*\+/i.test(trimmed) || /\+\s*(gst|18%|18\s*%)/i.test(trimmed) || /gst\s*extra/i.test(fullLine) || /extra\s*gst/i.test(fullLine)) {
      gstType = 'extra'
      gstApplicable = true
      if (!gstRate) gstRate = 18 // default to 18% for computer hardware
    }
    // "3450 nett" → GST inclusive ("nett" means final/all-inclusive price in trade)
    // "3450 incl GST", "3450 including GST", "3450 (GST incl)"
    else if (/\bnett\b/i.test(trimmed) || /incl/i.test(fullLine) || /including\s*gst/i.test(fullLine) || /gst\s*incl/i.test(fullLine)) {
      gstType = 'inclusive'
      gstApplicable = true
      if (!gstRate) gstRate = 18
    }
    // "3450 without GST", "3450 no GST"
    else if (/without\s*gst/i.test(fullLine) || /no\s*gst/i.test(fullLine) || /gst\s*no/i.test(fullLine)) {
      gstType = 'extra'
      gstApplicable = false
    }
    // "3450 with GST"
    else if (/with\s*gst/i.test(fullLine) || /gst\s*yes/i.test(fullLine)) {
      gstType = 'inclusive'
      gstApplicable = true
      if (!gstRate) gstRate = 18
    }
    // Bare number with no GST context
    else {
      gstType = 'unknown'
      gstApplicable = null
    }

    // Calculate totalCost (what the buyer actually pays)
    let totalCost = rate
    if (gstType === 'extra' && gstRate) {
      totalCost = rate + (rate * gstRate / 100)
    }
    // inclusive or unknown → totalCost = rate

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

// Build bulk enquiry payload (for sending to multiple suppliers)
export function buildBulkEnquiry(
  shopName: string,
  suppliersWithItems: { supplier: { name: string; phone: string; whatsappNumber: string }; items: { name: string; sku?: string }[] }[]
): WhatsAppMessage[] {
  return suppliersWithItems.map(({ supplier, items }) => ({
    to: supplier.whatsappNumber || supplier.phone,
    message: buildEnquiryMessage(shopName, items),
  }))
}

// Schedule helper - returns dates for 2 monthly enquiries (1st and 15th)
export function getNextEnquiryDates(from: Date = new Date()): Date[] {
  const dates: Date[] = []
  const now = new Date(from)
  const day = now.getDate()
  
  // Next 1st
  const next1st = new Date(now.getFullYear(), now.getMonth() + (day >= 1 ? 1 : 0), 1)
  // Next 15th
  const next15th = new Date(now.getFullYear(), now.getMonth() + (day >= 15 ? 1 : 0), 15)
  
  dates.push(next1st, next15th)
  dates.sort((a, b) => a.getTime() - b.getTime())
  return dates
}

// Check if today is an enquiry day (1st or 15th)
export function isEnquiryDay(date: Date = new Date()): boolean {
  const day = date.getDate()
  return day === 1 || day === 15
}
