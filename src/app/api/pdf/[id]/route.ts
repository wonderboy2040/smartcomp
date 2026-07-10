import { NextRequest, NextResponse } from 'next/server'
import { getRow, listRows, isConfigured } from '@/lib/sheets-client'
import { generateInvoicePdf } from '@/lib/pdf'
import { computeInvoice, type LineItem } from '@/lib/calc'
import { safeJsonParse } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 503 })
    }

    const { id } = await params
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'invoice'

    const shopRows = await listRows<any>('Shop')
    const shop = shopRows[0] || { name: 'Smart Computers', termsInvoice: '', termsQuotation: '' }

    if (type === 'invoice') {
      const invoice = await getRow<any>('Invoices', id)
      if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const items = safeJsonParse<any[]>(invoice.itemsJson, []) as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(invoice.courierCharges) || 0,
        otherCharges: Number(invoice.otherCharges) || 0,
        discount: Number(invoice.discount) || 0,
      })

      const pdfBuffer = await generateInvoicePdf({
        number: String(invoice.number || ''),
        date: new Date(invoice.date || invoice.createdAt || Date.now()),
        shop: {
          name: String(shop.name || 'Smart Computers'),
          owner: String(shop.owner || ''),
          phone: String(shop.phone || ''),
          email: String(shop.email || ''),
          address: String(shop.address || ''),
          gstNumber: String(shop.gstNumber || ''),
          state: String(shop.state || ''),
          upiId: String(shop.upiId || ''),
        },
        customer: {
          name: String(invoice.customerName || ''),
          phone: String(invoice.customerPhone || ''),
          address: '',
          gstNumber: String(invoice.customerGstin || ''),
          state: '',
        },
        calc,
        notes: String(invoice.notes || ''),
        terms: String(shop.termsInvoice || ''),
        amountPaid: Number(invoice.amountPaid) || 0,
        amountDue: Number(invoice.amountDue) || 0,
        paymentType: String(invoice.paymentType || ''),
        paymentStatus: String(invoice.paymentStatus || ''),
        docType: 'invoice',
      })

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Invoice-${invoice.number}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      })
    } else if (type === 'quotation') {
      const q = await getRow<any>('Quotations', id)
      if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const items = safeJsonParse<any[]>(q.itemsJson, []) as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(q.courierCharges) || 0,
        otherCharges: Number(q.otherCharges) || 0,
        discount: Number(q.discount) || 0,
      })

      const pdfBuffer = await generateInvoicePdf({
        number: String(q.number || ''),
        date: new Date(q.date || q.createdAt || Date.now()),
        validTill: q.validTill ? new Date(q.validTill) : undefined,
        shop: {
          name: String(shop.name || 'Smart Computers'),
          owner: String(shop.owner || ''),
          phone: String(shop.phone || ''),
          email: String(shop.email || ''),
          address: String(shop.address || ''),
          gstNumber: String(shop.gstNumber || ''),
          state: String(shop.state || ''),
          upiId: String(shop.upiId || ''),
        },
        customer: {
          name: String(q.customerName || ''),
          phone: String(q.customerPhone || ''),
          address: '',
          gstNumber: String(q.customerGstin || ''),
          state: '',
        },
        calc,
        notes: String(q.notes || ''),
        terms: String(shop.termsQuotation || ''),
        docType: 'quotation',
      })

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Quotation-${q.number}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e: any) {
    console.error('PDF generation error:', e)
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
