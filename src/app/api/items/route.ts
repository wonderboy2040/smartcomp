import { NextRequest, NextResponse } from 'next/server'
import { listRows, createRow, isConfigured } from '@/lib/sheets-client'

export async function GET(req: NextRequest) {
  try {
    if (!isConfigured()) return NextResponse.json([])
    const url = new URL(req.url)
    const search = url.searchParams.get('search') || undefined
    const category = url.searchParams.get('category')
    const lowStock = url.searchParams.get('lowStock') === 'true'

    let items = await listRows<any>('Items', { search })

    if (category && category !== 'all') {
      items = items.filter((i) => i.category === category)
    }
    if (lowStock) {
      items = items.filter((i) => Number(i.quantity) <= Number(i.minQuantity || 0))
    }

    // Get suppliers for join
    const suppliers = await listRows<any>('Suppliers', { useCache: true })
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]))
    
    const result = items.map((i) => ({
      ...i,
      gstApplicable: i.gstApplicable === true || i.gstApplicable === 'true',
      gstRate: Number(i.gstRate) || 0,
      costPrice: Number(i.costPrice) || 0,
      sellingPrice: Number(i.sellingPrice) || 0,
      quantity: Number(i.quantity) || 0,
      minQuantity: Number(i.minQuantity) || 0,
      supplier: i.supplierId ? supplierMap.get(i.supplierId) : null,
    }))

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const item = await createRow('Items', {
      ...body,
      gstApplicable: body.gstApplicable !== false,
      gstRate: Number(body.gstRate) || 18,
      costPrice: Number(body.costPrice) || 0,
      sellingPrice: Number(body.sellingPrice) || 0,
      quantity: Number(body.quantity) || 0,
      minQuantity: Number(body.minQuantity) || 0,
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
