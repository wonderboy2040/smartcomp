import { NextRequest, NextResponse } from 'next/server'
import { getRow, listRows, isConfigured } from '@/lib/sheets-client'
import { generateWhatsAppLink, buildInvoiceShareMessage, buildPaymentReminderMessage } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 503 })
    }

    const shop = await getRow<any>('Shop') || { name: 'Smart Computers' }

    if (action === 'shareInvoice' || action === 'shareQuotation') {
      const { id } = body
      const docType = action === 'shareInvoice' ? 'invoice' : 'quotation'
      const sheet = docType === 'invoice' ? 'Invoices' : 'Quotations'
      const record = await getRow<any>(sheet, id)
      if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const phone = record.customerPhone
      if (!phone) return NextResponse.json({ error: 'Customer has no phone' }, { status: 400 })

      const message = buildInvoiceShareMessage(
        shop.name,
        record.customerName,
        docType,
        record.number,
        Number(record.grandTotal) || 0,
        docType === 'quotation' && record.validTill ? new Date(record.validTill) : undefined
      )
      const link = generateWhatsAppLink(phone, message)

      return NextResponse.json({ success: true, link, message, phone })
    }

    if (action === 'paymentReminder') {
      const { invoiceId } = body
      const invoice = await getRow<any>('Invoices', invoiceId)
      if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const phone = invoice.customerPhone
      if (!phone) return NextResponse.json({ error: 'Customer has no phone' }, { status: 400 })

      const message = buildPaymentReminderMessage(
        shop.name,
        invoice.customerName,
        invoice.number,
        Number(invoice.amountDue) || 0
      )
      const link = generateWhatsAppLink(phone, message)

      return NextResponse.json({ success: true, link, message, phone })
    }

    if (action === 'customMessage') {
      const { phone, message } = body
      if (!phone || !message) return NextResponse.json({ error: 'Phone and message required' }, { status: 400 })
      const link = generateWhatsAppLink(phone, message)
      return NextResponse.json({ success: true, link })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
