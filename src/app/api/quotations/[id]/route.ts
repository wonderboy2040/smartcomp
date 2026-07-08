import { NextRequest, NextResponse } from 'next/server'
import { getRow, deleteRow, updateRow, createRow, listRows } from '@/lib/sheets-client'
import { computeInvoice, nextNumber, type LineItem } from '@/lib/calc'
import { safeJsonParse } from '@/lib/utils'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const q = await getRow<any>('Quotations', id)
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      ...q,
      customer: {
        id: q.customerId,
        name: q.customerName,
        phone: q.customerPhone,
        gstNumber: q.customerGstin,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

// PUT /api/quotations/[id] — Edit an existing quotation
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await getRow<any>('Quotations', id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const newItems = (body.items || []).map((i: any) => ({
      itemId: i.itemId,
      name: i.name,
      sku: i.sku || '',
      hsnCode: i.hsnCode || '',
      quantity: Number(i.quantity) || 0,
      rate: Number(i.rate) || 0,
      discount: Number(i.discount) || 0,
      gstApplicable: i.gstApplicable === true || i.gstApplicable === 'true',
      gstRate: Number(i.gstRate) || 0,
      costPrice: Number(i.costPrice) || 0,
    }))

    const computed = computeInvoice(newItems, {
      courierCharges: Number(body.courierCharges) || 0,
      otherCharges: Number(body.otherCharges) || 0,
      discount: Number(body.discount) || 0,
    })

    const updated = await updateRow('Quotations', id, {
      customerId: String(body.customerId || existing.customerId || ''),
      customerName: String(body.customerName || existing.customerName || ''),
      customerPhone: String(body.customerPhone || existing.customerPhone || ''),
      customerGstin: String(body.customerGstin || existing.customerGstin || ''),
      date: body.date || existing.date,
      validTill: body.validTill || existing.validTill,
      itemsJson: JSON.stringify(newItems),
      subtotal: computed.subtotal,
      gstAmount: computed.gstAmount,
      courierCharges: computed.courierCharges,
      otherCharges: computed.otherCharges,
      discount: computed.discount,
      grandTotal: computed.grandTotal,
      notes: String(body.notes || existing.notes || ''),
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const action = body.action || 'convert'

    if (action === 'convert') {
      const q = await getRow<any>('Quotations', id)
      if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const items = safeJsonParse<any[]>(q.itemsJson, []) as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(q.courierCharges) || 0,
        otherCharges: Number(q.otherCharges) || 0,
        discount: Number(q.discount) || 0,
      })

      // Generate invoice number
      const existingInvoices = await listRows<any>('Invoices')
      const shopRows = await listRows<any>('Shop')
      const shop = shopRows[0] || { invoicePrefix: 'INV' }
      const number = await nextNumber(shop.invoicePrefix || 'INV', existingInvoices.map((i) => ({ number: i.number })))

      // Create invoice
      const invoice = await createRow('Invoices', {
        number,
        customerId: String(q.customerId || ''),
        customerName: String(q.customerName || ''),
        customerPhone: String(q.customerPhone || ''),
        customerGstin: String(q.customerGstin || ''),
        date: new Date().toISOString(),
        itemsJson: q.itemsJson,
        subtotal: calc.subtotal,
        gstAmount: calc.gstAmount,
        courierCharges: calc.courierCharges,
        otherCharges: calc.otherCharges,
        discount: calc.discount,
        grandTotal: calc.grandTotal,
        totalCost: calc.totalCost,
        profit: calc.profit,
        paymentType: 'credit',
        paymentStatus: 'unpaid',
        amountPaid: 0,
        amountDue: calc.grandTotal,
        notes: String(q.notes || ''),
      })

      // Update quotation
      await updateRow('Quotations', id, { status: 'converted', convertedToInvoiceId: String(invoice.id || '') })

      // Deduct stock
      for (const item of calc.items) {
        if (item.itemId) {
          const dbItem = await getRow<any>('Items', String(item.itemId))
          if (dbItem) {
            await updateRow('Items', String(item.itemId), {
              quantity: Math.max(0, (Number(dbItem.quantity) || 0) - item.quantity),
            })
          }
        }
      }

      // Update customer credit
      if (q.customerId) {
        const customer = await getRow<any>('Customers', String(q.customerId))
        if (customer) {
          const currentCredit = Number(customer.creditBalance) || 0
          await updateRow('Customers', String(q.customerId), { creditBalance: currentCredit + calc.grandTotal })
        }
      }

      return NextResponse.json({ success: true, invoiceId: invoice.id, invoiceNumber: number })
    }

    if (action === 'updateStatus') {
      const q = await updateRow('Quotations', id, { status: String(body.status || '') })
      return NextResponse.json(q)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteRow('Quotations', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
