import { NextRequest, NextResponse } from 'next/server'
import { listRows, createRow, updateRow } from '@/lib/sheets-client'
import { buildEnquiryMessage, generateWhatsAppLink, parseRateResponse } from '@/lib/whatsapp'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const supplierId = url.searchParams.get('supplierId')
    const status = url.searchParams.get('status')

    let enquiries = await listRows<any>('Enquiries')
    if (supplierId) enquiries = enquiries.filter((e) => e.supplierId === supplierId)
    if (status) enquiries = enquiries.filter((e) => e.status === status)

    enquiries.sort((a, b) => new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime())
    enquiries = enquiries.slice(0, 200)

    const suppliers = await listRows<any>('Suppliers', { useCache: true })
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]))

    const result = enquiries.map((e) => ({
      ...e,
      appliedToItems: e.appliedToItems === true || e.appliedToItems === 'true',
      isAuto: e.isAuto === true || e.isAuto === 'true',
      // Always provide a non-null supplier object so the UI never crashes on .name/.phone
      supplier: supplierMap.get(e.supplierId) || {
        id: String(e.supplierId || ''),
        name: String(e.supplierName || 'Unknown Supplier'),
        phone: String(e.supplierPhone || ''),
        whatsappNumber: String(e.supplierPhone || ''),
      },
      // Defensive string coercion for status (Sheets may return number/blank)
      status: String(e.status || 'sent'),
      itemsJson: String(e.itemsJson || '[]'),
      message: String(e.message || ''),
      response: String(e.response || ''),
      ratesJson: String(e.ratesJson || '[]'),
    }))

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { supplierIds, itemIds, allItems = false, isAuto = false } = body

    if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one supplier' }, { status: 400 })
    }

    // Get shop (listRows returns array; take first)
    const shopRows = await listRows<any>('Shop', { useCache: true })
    const shop = shopRows[0] || { name: 'Smart Computers' }

    // Get items
    let items: any[] = []
    if (allItems) {
      items = await listRows<any>('Items')
    } else if (Array.isArray(itemIds) && itemIds.length > 0) {
      const allItemsList = await listRows<any>('Items')
      items = allItemsList.filter((i) => itemIds.includes(i.id))
    } else {
      return NextResponse.json({ error: 'Select items or choose all items' }, { status: 400 })
    }

    if (items.length === 0) return NextResponse.json({ error: 'No items to enquire' }, { status: 400 })

    // Get suppliers
    const allSuppliers = await listRows<any>('Suppliers')
    const suppliers = allSuppliers.filter((s) => supplierIds.includes(s.id))

    const results = []
    for (const supplier of suppliers) {
      const message = buildEnquiryMessage(shop.name, items.map((i) => ({ name: i.name, sku: i.sku })))
      const phone = supplier.whatsappNumber || supplier.phone
      const link = generateWhatsAppLink(phone, message)

      const enquiry = await createRow('Enquiries', {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierPhone: phone,
        itemsJson: JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, sku: i.sku }))),
        message,
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: '',
        response: '',
        ratesJson: '[]',
        appliedToItems: false,
        isAuto,
      })

      results.push({
        enquiryId: enquiry.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        phone,
        whatsappLink: link,
        message,
      })
    }

    return NextResponse.json({ success: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
