// WhatsApp helper - generates wa.me links and message templates
// Note: For full automation, use WhatsApp Business API / Twilio / WATI

export interface WhatsAppMessage {
  to: string // phone number with country code, no + sign
  message: string
}

// Generate wa.me link for opening WhatsApp with prefilled message
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^\d]/g, '')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${cleanPhone}?text=${encoded}`
}

// Build rate enquiry message for supplier
export function buildEnquiryMessage(
  shopName: string,
  items: { name: string; sku?: string }[],
  enquiryNumber?: string
): string {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  let msg = `*${shopName}*\n`
  msg += `*Rate Enquiry* - ${today}\n`
  if (enquiryNumber) msg += `Ref: ${enquiryNumber}\n`
  msg += `\nHello Sir/Madam,\n\nPlease provide latest rates for the following items:\n\n`
  items.forEach((item, i) => {
    msg += `${i + 1}. ${item.name}${item.sku ? ` (SKU: ${item.sku})` : ''}\n`
  })
  msg += `\nPlease reply in this format so I can update my records:\n`
  msg += `\`\`\`\n1. Item Name: Rs.XXXX (GST: Yes/No)\n2. ...\n\`\`\`\n`
  msg += `\nThank you!`
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
  let msg = `*${shopName}*\n\n`
  msg += `Dear ${customerName},\n\n`
  msg += `Please find attached ${docType === 'invoice' ? 'invoice' : 'quotation'}:\n\n`
  msg += `*${docType === 'invoice' ? 'Invoice' : 'Quotation'} No:* ${number}\n`
  msg += `*Amount:* Rs. ${amount.toFixed(2)}\n`
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
  let msg = `*${shopName}*\n\n`
  msg += `Dear ${customerName},\n\n`
  msg += `This is a gentle reminder for the pending payment:\n\n`
  msg += `*Invoice No:* ${invoiceNumber}\n`
  msg += `*Amount Due:* Rs. ${amount.toFixed(2)}\n`
  if (dueDate) msg += `*Due Date:* ${dueDate.toLocaleDateString('en-IN')}\n`
  msg += `\nKindly arrange the payment at your earliest convenience.\n\nThank you!`
  return msg
}

// Parse rate response from supplier (natural language to structured rates)
export interface ParsedRate {
  itemName: string
  rate: number
  gstApplicable: boolean | null
  gstRate?: number
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

    // Match patterns like "1. Item Name: Rs.1000" or "Item Name - Rs.1000 GST Yes"
    // Try to find item name and rate
    const patterns = [
      // "1. Item: Rs.1000"
      /^\d+\.?\s*(.+?):?\s*rs\.?\s*(\d+(?:[.,]\d+)?)/i,
      // "1. Item - Rs.1000"
      /^\d+\.?\s*(.+?)\s*[-:]\s*rs\.?\s*(\d+(?:[.,]\d+)?)/i,
      // "Item: 1000"
      /^(.+?):\s*(\d+(?:[.,]\d+)?)/,
    ]

    let matched: RegExpMatchArray | null = null
    for (const p of patterns) {
      matched = trimmed.match(p)
      if (matched) break
    }

    if (matched && matched[1] && matched[2]) {
      const itemNameRaw = matched[1].trim()
      const rate = parseFloat(matched[2].replace(/[.,]/g, m => m === ',' ? '' : '.'))
      
      // Find matching original item
      const matchedItem = originalItems.find(
        (i) => itemNameRaw.toLowerCase().includes(i.name.toLowerCase()) ||
               (i.sku && itemNameRaw.toLowerCase().includes(i.sku.toLowerCase())) ||
               i.name.toLowerCase().includes(itemNameRaw.toLowerCase())
      )
      const itemName = matchedItem?.name || itemNameRaw

      // Check for GST mention
      const lowerLine = trimmed.toLowerCase()
      const gstApplicable = lowerLine.includes('gst yes') || lowerLine.includes('gst: yes') || lowerLine.includes('with gst')
      const noGst = lowerLine.includes('gst no') || lowerLine.includes('gst: no') || lowerLine.includes('without gst') || lowerLine.includes('no gst')
      
      // Try to extract GST rate
      const gstRateMatch = trimmed.match(/gst\s*(\d+)%?/i)
      const gstRate = gstRateMatch ? parseFloat(gstRateMatch[1]) : undefined

      results.push({
        itemName,
        rate,
        gstApplicable: gstApplicable ? true : (noGst ? false : null),
        gstRate,
      })
    }
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
