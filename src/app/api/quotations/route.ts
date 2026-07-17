import { NextRequest, NextResponse } from 'next/server'
import { listRows, createQuotationUltra } from '@/lib/sheets-client'
import { computeInvoice, type LineItem } from '@/lib/calc'

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

    return NextResponse.json(result, {
      headers: { 'X-Ultra-Fast': 'true', 'X-Version': '6.0' }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await req.json()
    const { customerId, items, courierCharges = 0, otherCharges = 0, discount = 0, notes = '', validTill, status = 'draft', date } = body

    if (!customerId) return NextResponse.json({ error: 'Customer required' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Items required' }, { status: 400 })

    const calc = computeInvoice(items as LineItem[], { courierCharges, otherCharges, discount })

    // ULTRA-ULTRA FAST v6.0: Single call - server fetches customer + generates number
    const result = await createQuotationUltra({
      customerId,
      itemsJson: JSON.stringify(calc.items),
      subtotal: calc.subtotal,
      gstAmount: calc.gstAmount,
      courierCharges: calc.courierCharges,
      otherCharges: calc.otherCharges,
      discount: calc.discount,
      grandTotal: calc.grandTotal,
      notes: notes || '',
      date: date || new Date().toISOString(),
      validTill: validTill || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status,
    })

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      ...result.data,
      ultraFast: true,
      ultraUltraFast: true,
      version: '6.0',
      elapsedMs: elapsed,
    }, {
      headers: {
        'X-Ultra-Fast': 'true',
        'X-Ultra-Ultra-Fast': 'true',
        'X-Elapsed-Ms': elapsed.toString(),
        'X-Version': '6.0',
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
