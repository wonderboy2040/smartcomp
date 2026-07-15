import { NextRequest, NextResponse } from 'next/server'
import { listRows, getRow, createInvoiceFull } from '@/lib/sheets-client'
import { computeInvoice, nextInvoiceNumber, type LineItem } from '@/lib/calc'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const paymentType = url.searchParams.get('paymentType')
    const customerId = url.searchParams.get('customerId')
    const limit = parseInt(url.searchParams.get('limit') || '200')

    let invoices = await listRows<any>('Invoices')
    
    if (status) invoices = invoices.filter((i) => i.paymentStatus === status)
    if (paymentType) invoices = invoices.filter((i) => i.paymentType === paymentType)
    if (customerId) invoices = invoices.filter((i) => i.customerId === customerId)

    invoices.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
    
    invoices = invoices.slice(0, limit).map((inv) => ({
      ...inv,
      customer: {
        id: inv.customerId,
        name: inv.customerName,
        phone: inv.customerPhone,
        gstNumber: inv.customerGstin,
      },
      subtotal: Number(inv.subtotal) || 0,
      gstAmount: Number(inv.gstAmount) || 0,
      courierCharges: Number(inv.courierCharges) || 0,
      otherCharges: Number(inv.otherCharges) || 0,
      discount: Number(inv.discount) || 0,
      grandTotal: Number(inv.grandTotal) || 0,
      totalCost: Number(inv.totalCost) || 0,
      profit: Number(inv.profit) || 0,
      amountPaid: Number(inv.amountPaid) || 0,
      amountDue: Number(inv.amountDue) || 0,
    }))

    return NextResponse.json(invoices, {
      headers: { 'X-Ultra-Fast': 'true', 'X-Version': '4.0' }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await req.json()
    const { customerId, items, courierCharges, otherCharges, discount, paymentType, amountPaid, notes, date, deductStock = true } = body

    if (!customerId) return NextResponse.json({ error: 'Customer required' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Items required' }, { status: 400 })

    // ULTRA FAST: Parallel fetch
    const [customer, existing] = await Promise.all([
      getRow<any>('Customers', customerId),
      listRows<any>('Invoices', { useCache: true }),
    ])
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 400 })

    const calc = computeInvoice(items as LineItem[], { courierCharges, otherCharges, discount })
    const paid = Number(amountPaid) || 0
    const due = Math.max(0, calc.grandTotal - paid)
    const number = await nextInvoiceNumber(existing.map((i) => ({ number: i.number })))

    // Prepare ultra fast transaction data - SINGLE Apps Script call instead of 4-6
    const stockUpdates: { id: string; deductQty: number }[] = []
    if (deductStock) {
      const qtyMap = new Map<string, number>()
      for (const item of calc.items) {
        if (item.itemId) {
          qtyMap.set(item.itemId, (qtyMap.get(item.itemId) || 0) + item.quantity)
        }
      }
      for (const [id, qty] of qtyMap.entries()) {
        stockUpdates.push({ id, deductQty: qty })
      }
    }

    const customerUpdate = due > 0 ? {
      id: customerId,
      creditBalance: (Number(customer.creditBalance) || 0) + due
    } : null

    const payment = paid > 0 ? {
      invoiceId: '', // Will be set in Apps Script after invoice creation
      invoiceNumber: number,
      customerName: customer.name,
      amount: paid,
      type: paymentType || 'cash',
      date: new Date().toISOString(),
      notes: 'Initial payment',
      reference: '',
    } : null

    // ULTRA FAST: Single Apps Script call does invoice + stock + customer + payment
    const result = await createInvoiceFull({
      number,
      customerId,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      customerGstin: customer.gstNumber || '',
      date: date || new Date().toISOString(),
      itemsJson: JSON.stringify(calc.items),
      subtotal: calc.subtotal,
      gstAmount: calc.gstAmount,
      courierCharges: calc.courierCharges,
      otherCharges: calc.otherCharges,
      discount: calc.discount,
      grandTotal: calc.grandTotal,
      totalCost: calc.totalCost,
      profit: calc.profit,
      paymentType: paymentType || (paid >= calc.grandTotal ? 'cash' : 'credit'),
      paymentStatus: paid >= calc.grandTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      amountPaid: paid,
      amountDue: due,
      notes: notes || '',
      stockUpdates: stockUpdates.length > 0 ? stockUpdates : undefined,
      customerUpdate: customerUpdate || undefined,
      payment: payment || undefined,
    })

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      ...result.data,
      customer: { id: customerId, name: customer.name, phone: customer.phone, gstNumber: customer.gstNumber },
      ultraFast: true,
      elapsedMs: elapsed,
      operationsSaved: '4-6 calls -> 1 call = 3x faster',
    }, {
      headers: {
        'X-Ultra-Fast': 'true',
        'X-Elapsed-Ms': elapsed.toString(),
        'X-Version': '4.0',
      }
    })
  } catch (e: any) {
    console.error('Invoice ultra fast error:', e)
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
