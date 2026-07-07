import { NextRequest, NextResponse } from 'next/server'
import { getRow, isConfigured } from '@/lib/sheets-client'
import { generateInvoicePdf } from '@/lib/pdf'
import { computeInvoice, type LineItem } from '@/lib/calc'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 503 })
    }

    const { id } = await params
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'invoice'

    const shop = await getRow<any>('Shop') || {
      name: 'Smart Computers',
      termsInvoice: '', termsQuotation: '',
    }

    if (type === 'invoice') {
      const invoice = await getRow<any>('Invoices', id)
      if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const items = JSON.parse(invoice.itemsJson || '[]') as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(invoice.courierCharges) || 0,
        otherCharges: Number(invoice.otherCharges) || 0,
        discount: Number(invoice.discount) || 0,
      })

      const pdfBuffer = generateInvoicePdf({
        number: invoice.number,
        date: new Date(invoice.date),
        shop: {
          name: shop.name, owner: shop.owner, phone: shop.phone, email: shop.email,
          address: shop.address, gstNumber: shop.gstNumber, state: shop.state, logoUrl: shop.logoUrl,
        },
        customer: {
          name: invoice.customerName, phone: invoice.customerPhone,
          address: '', gstNumber: invoice.customerGstin, state: '',
        },
        calc,
        notes: invoice.notes,
        terms: shop.termsInvoice,
        amountPaid: Number(invoice.amountPaid) || 0,
        amountDue: Number(invoice.amountDue) || 0,
        paymentType: invoice.paymentType,
        paymentStatus: invoice.paymentStatus,
        docType: 'invoice',
      })

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Invoice-${invoice.number}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      })
    } else if (type === 'quotation') {
      const q = await getRow<any>('Quotations', id)
      if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const items = JSON.parse(q.itemsJson || '[]') as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(q.courierCharges) || 0,
        otherCharges: Number(q.otherCharges) || 0,
        discount: Number(q.discount) || 0,
      })

      const pdfBuffer = generateInvoicePdf({
        number: q.number,
        date: new Date(q.date),
        validTill: q.validTill ? new Date(q.validTill) : undefined,
        shop: {
          name: shop.name, owner: shop.owner, phone: shop.phone, email: shop.email,
          address: shop.address, gstNumber: shop.gstNumber, state: shop.state, logoUrl: shop.logoUrl,
        },
        customer: {
          name: q.customerName, phone: q.customerPhone,
          address: '', gstNumber: q.customerGstin, state: '',
        },
        calc,
        notes: q.notes,
        terms: shop.termsQuotation,
        docType: 'quotation',
      })

      return new NextResponse(pdfBuffer, {
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
