import { NextRequest, NextResponse } from 'next/server'
import { listRows, createRow } from '@/lib/sheets-client'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const search = url.searchParams.get('search') || undefined
    
    // PERFORMANCE: Load all 3 in parallel instead of sequential
    const [customers, invoices, quotations] = await Promise.all([
      listRows<any>('Customers', { search }),
      listRows<any>('Invoices', { useCache: true }),
      listRows<any>('Quotations', { useCache: true }),
    ])
    
    const result = customers.map((c) => ({
      ...c,
      creditBalance: Number(c.creditBalance) || 0,
      _count: {
        invoices: invoices.filter((i) => i.customerId === c.id).length,
        quotations: quotations.filter((q) => q.customerId === c.id).length,
      },
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const customer = await createRow('Customers', {
      ...body,
      creditBalance: 0,
    })
    return NextResponse.json(customer)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
