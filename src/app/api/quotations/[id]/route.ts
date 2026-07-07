import { NextRequest, NextResponse } from 'next/server'
import { getRow, deleteRow, updateRow, createRow, listRows } from '@/lib/sheets-client'
import { computeInvoice, nextNumber, type LineItem } from '@/lib/calc'

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const action = body.action || 'convert'

    if (action === 'convert') {
      const q = await getRow<any>('Quotations', id)
      if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const items = JSON.parse(q.itemsJson || '[]') as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(q.courierCharges) || 0,
        otherCharges: Number(q.otherCharges) || 0,
        discount: Number(q.discount) || 0,
      })

      // Generate invoice number
      const existingInvoices = await listRows<any>('Invoices')
      const shop = await getRow<any>('Shop') || { invoicePrefix: 'INV' }
      const number = await nextNumber(shop.invoicePrefix || 'INV', existingInvoices.map((i) => ({ number: i.number })))

      // Create invoice
      const invoice = await createRow('Invoices', {
        number,
        customerId: q.customerId,
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        customerGstin: q.customerGstin,
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
        notes: q.notes,
      })

      // Update quotation
      await updateRow('Quotations', id, { status: 'converted', convertedToInvoiceId: invoice.id })

      // Deduct stock
      for (const item of calc.items) {
        if (item.itemId) {
          const dbItem = await getRow<any>('Items', item.itemId)
          if (dbItem) {
            await updateRow('Items', item.itemId, {
              quantity: Math.max(0, (Number(dbItem.quantity) || 0) - item.quantity),
            })
          }
        }
      }

      // Update customer credit
      const customer = await getRow<any>('Customers', q.customerId)
      if (customer) {
        const currentCredit = Number(customer.creditBalance) || 0
        await updateRow('Customers', q.customerId, { creditBalance: currentCredit + calc.grandTotal })
      }

      return NextResponse.json({ success: true, invoiceId: invoice.id, invoiceNumber: number })
    }

    if (action === 'updateStatus') {
      const q = await updateRow('Quotations', id, { status: body.status })
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
