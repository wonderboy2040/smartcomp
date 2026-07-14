import { NextRequest, NextResponse } from 'next/server'
import { listRows, createRow, updateRow, getRow, bulkUpdate } from '@/lib/sheets-client'
import { isConfigured } from '@/lib/sheets-client'
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

    // Sort by date desc
    invoices.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
    
    // Convert numbers
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

    return NextResponse.json(invoices)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, items, courierCharges, otherCharges, discount, paymentType, amountPaid, notes, date, deductStock = true } = body

    if (!customerId) return NextResponse.json({ error: 'Customer required' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Items required' }, { status: 400 })

    // PERFORMANCE: Parallel fetch customer, existing invoices, and shop
    const [customer, existing, shopRow] = await Promise.all([
      getRow<any>('Customers', customerId),
      listRows<any>('Invoices'),
      listRows<any>('Shop', { useCache: true }),
    ])
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 400 })

    // Compute totals
    const calc = computeInvoice(items as LineItem[], { courierCharges, otherCharges, discount })
    const paid = Number(amountPaid) || 0
    const due = Math.max(0, calc.grandTotal - paid)

    // Generate invoice number: SCSS/26-27/001
    const number = await nextInvoiceNumber(existing.map((i) => ({ number: i.number })))

    // Create invoice
    const invoice = await createRow('Invoices', {
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
    })

    // PERFORMANCE: Batch stock deduction — collect all, then single bulkUpdate call
    if (deductStock) {
      const qtyMap = new Map<string, number>()
      for (const item of calc.items) {
        if (item.itemId) {
          qtyMap.set(item.itemId, (qtyMap.get(item.itemId) || 0) + item.quantity)
        }
      }
      const itemIds = Array.from(qtyMap.keys())
      // Fetch current stock for all items in parallel
      const dbItems = await Promise.all(itemIds.map((id) => getRow<any>('Items', id)))
      const stockUpdates: { id: string; data: any }[] = []
      for (let i = 0; i < itemIds.length; i++) {
        const dbItem = dbItems[i]
        if (dbItem) {
          const deductQty = qtyMap.get(itemIds[i]) || 0
          stockUpdates.push({
            id: itemIds[i],
            data: { quantity: Math.max(0, (Number(dbItem.quantity) || 0) - deductQty) },
          })
        }
      }
      // Single HTTP call to update all stock
      if (stockUpdates.length > 0) {
        await bulkUpdate('Items', stockUpdates)
      }
    }

    // Update customer credit + create payment in parallel
    const postOps: Promise<any>[] = []
    if (due > 0) {
      const currentCredit = Number(customer.creditBalance) || 0
      postOps.push(updateRow('Customers', customerId, { creditBalance: currentCredit + due }))
    }
    if (paid > 0) {
      postOps.push(createRow('Payments', {
        invoiceId: invoice.id,
        invoiceNumber: number,
        customerName: customer.name,
        amount: paid,
        type: paymentType || 'cash',
        date: new Date().toISOString(),
        notes: 'Initial payment',
        reference: '',
      }))
    }
    if (postOps.length > 0) await Promise.all(postOps)

    return NextResponse.json({
      ...invoice,
      customer: { id: customerId, name: customer.name, phone: customer.phone, gstNumber: customer.gstNumber },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
