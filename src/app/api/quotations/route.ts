import { NextRequest, NextResponse } from 'next/server'
import { listRows, createRow, getRow } from '@/lib/sheets-client'
import { computeInvoice, nextNumber, type LineItem } from '@/lib/calc'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const customerId = url.searchParams.get('customerId')
    const status = url.searchParams.get('status')

    let quotations = await listRows<any>('Quotations')
    if (customerId) quotations = quotations.filter((q) => q.customerId === customerId)
    if (status) quotations = quotations.filter((q) => q.status === status)

    quotations.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())

    const result = quotations.map((q) => ({
      ...q,
      customer: {
        id: q.customerId,
        name: q.customerName,
        phone: q.customerPhone,
        gstNumber: q.customerGstin,
      },
      subtotal: Number(q.subtotal) || 0,
      gstAmount: Number(q.gstAmount) || 0,
      courierCharges: Number(q.courierCharges) || 0,
      otherCharges: Number(q.otherCharges) || 0,
      discount: Number(q.discount) || 0,
      grandTotal: Number(q.grandTotal) || 0,
    }))

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, items, courierCharges, otherCharges, discount, notes, validTill, status, date } = body

    if (!customerId) return NextResponse.json({ error: 'Customer required' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Items required' }, { status: 400 })

    // PERFORMANCE: Parallel fetch customer, existing quotations, and shop
    const [customer, existing, shopRows] = await Promise.all([
      getRow<any>('Customers', customerId),
      listRows<any>('Quotations'),
      listRows<any>('Shop', { useCache: true }),
    ])
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 400 })

    const calc = computeInvoice(items as LineItem[], { courierCharges, otherCharges, discount })

    const shop = shopRows[0] || { quotationPrefix: 'SCSS' }
    const number = await nextNumber(shop.quotationPrefix || 'SCSS', existing.map((q) => ({ number: q.number })))

    const quotation = await createRow('Quotations', {
      number,
      customerId,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      customerGstin: customer.gstNumber || '',
      date: date || new Date().toISOString(),
      validTill: validTill || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      itemsJson: JSON.stringify(calc.items),
      subtotal: calc.subtotal,
      gstAmount: calc.gstAmount,
      courierCharges: calc.courierCharges,
      otherCharges: calc.otherCharges,
      discount: calc.discount,
      grandTotal: calc.grandTotal,
      notes: notes || '',
      status: status || 'draft',
      convertedToInvoiceId: '',
    })

    return NextResponse.json({
      ...quotation,
      customer: { id: customerId, name: customer.name, phone: customer.phone, gstNumber: customer.gstNumber },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
