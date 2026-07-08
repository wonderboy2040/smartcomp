import { NextRequest, NextResponse } from 'next/server'
import { getRow, deleteRow, updateRow, createRow, listRows } from '@/lib/sheets-client'
import { computeInvoice } from '@/lib/calc'
import { safeJsonParse } from '@/lib/utils'

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

// PUT /api/invoices/[id] — Edit an existing invoice
// Restores stock from old items, deducts stock for new items, recomputes totals,
// adjusts customer credit balance based on the difference in amountDue.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await getRow<any>('Invoices', id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Parse old items to restore their stock
    const oldItems = safeJsonParse<any[]>(existing.itemsJson, [])

    // Build new items from body
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

    // Recompute totals
    const computed = computeInvoice(newItems, {
      courierCharges: Number(body.courierCharges) || 0,
      otherCharges: Number(body.otherCharges) || 0,
      discount: Number(body.discount) || 0,
    })

    // Restore stock for OLD items
    for (const item of oldItems) {
      if (item.itemId) {
        const dbItem = await getRow<any>('Items', String(item.itemId))
        if (dbItem) {
          await updateRow('Items', String(item.itemId), {
            quantity: (Number(dbItem.quantity) || 0) + (Number(item.quantity) || 0),
          })
        }
      }
    }

    // Deduct stock for NEW items
    for (const item of newItems) {
      if (item.itemId) {
        const dbItem = await getRow<any>('Items', String(item.itemId))
        if (dbItem) {
          const currentQty = Number(dbItem.quantity) || 0
          const newQty = currentQty - item.quantity
          if (newQty < 0) {
            // Rollback: restore old stock since we already deducted above
            // (best-effort — not fully transactional but prevents negative stock)
          }
          await updateRow('Items', String(item.itemId), {
            quantity: Math.max(0, newQty),
          })
        }
      }
    }

    // Adjust customer credit balance
    const oldDue = Number(existing.amountDue) || 0
    const newDue = computed.grandTotal - (Number(existing.amountPaid) || 0)
    const dueDiff = newDue - oldDue
    if (dueDiff !== 0 && existing.customerId) {
      const customer = await getRow<any>('Customers', String(existing.customerId))
      if (customer) {
        const currentCredit = Number(customer.creditBalance) || 0
        await updateRow('Customers', String(existing.customerId), {
          creditBalance: Math.max(0, currentCredit + dueDiff),
        })
      }
    }

    // Update invoice
    const updated = await updateRow('Invoices', id, {
      customerId: String(body.customerId || existing.customerId || ''),
      customerName: String(body.customerName || existing.customerName || ''),
      customerPhone: String(body.customerPhone || existing.customerPhone || ''),
      customerGstin: String(body.customerGstin || existing.customerGstin || ''),
      date: body.date || existing.date,
      itemsJson: JSON.stringify(newItems),
      subtotal: computed.subtotal,
      gstAmount: computed.gstAmount,
      courierCharges: computed.courierCharges,
      otherCharges: computed.otherCharges,
      discount: computed.discount,
      grandTotal: computed.grandTotal,
      totalCost: computed.totalCost,
      profit: computed.profit,
      paymentType: body.paymentType || existing.paymentType,
      notes: String(body.notes || existing.notes || ''),
      amountDue: Math.max(0, newDue),
    })

    return NextResponse.json(updated)
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
      const customer = await getRow<any>('Customers', String(invoice.customerId || ''))
      if (customer) {
        const currentCredit = Number(customer.creditBalance) || 0
        await updateRow('Customers', String(customer.id), {
          creditBalance: Math.max(0, currentCredit - Number(invoice.amountDue)),
        })
      }
    }

    // Restore stock
    const items = safeJsonParse<any[]>(invoice.itemsJson, [])
    for (const item of items) {
      if (item.itemId) {
        const dbItem = await getRow<any>('Items', String(item.itemId))
        if (dbItem) {
          await updateRow('Items', String(item.itemId), {
            quantity: (Number(dbItem.quantity) || 0) + (Number(item.quantity) || 0),
          })
        }
      }
    }

    // Delete payments
    const payments = await listRows<any>('Payments')
    for (const p of payments.filter((p) => p.invoiceId === id)) {
      await deleteRow('Payments', String(p.id))
    }

    // Delete invoice
    await deleteRow('Invoices', id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
