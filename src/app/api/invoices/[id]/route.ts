import { NextRequest, NextResponse } from 'next/server'
import { getRow, deleteRow, updateRow, createRow, listRows } from '@/lib/sheets-client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoice = await getRow<any>('Invoices', id)
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    
    const payments = await listRows<any>('Payments')
    return NextResponse.json({
      ...invoice,
      customer: {
        id: invoice.customerId,
        name: invoice.customerName,
        phone: invoice.customerPhone,
        gstNumber: invoice.customerGstin,
      },
      payments: payments.filter((p) => p.invoiceId === id),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoice = await getRow<any>('Invoices', id)
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Restore customer credit balance
    if (Number(invoice.amountDue) > 0) {
      const customer = await getRow<any>('Customers', invoice.customerId)
      if (customer) {
        const currentCredit = Number(customer.creditBalance) || 0
        await updateRow('Customers', invoice.customerId, {
          creditBalance: Math.max(0, currentCredit - Number(invoice.amountDue)),
        })
      }
    }

    // Restore stock
    const items = JSON.parse(invoice.itemsJson || '[]')
    for (const item of items) {
      if (item.itemId) {
        const dbItem = await getRow<any>('Items', item.itemId)
        if (dbItem) {
          await updateRow('Items', item.itemId, {
            quantity: (Number(dbItem.quantity) || 0) + item.quantity,
          })
        }
      }
    }

    // Delete payments
    const payments = await listRows<any>('Payments')
    for (const p of payments.filter((p) => p.invoiceId === id)) {
      await deleteRow('Payments', p.id)
    }

    // Delete invoice
    await deleteRow('Invoices', id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
