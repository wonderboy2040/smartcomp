import { NextRequest, NextResponse } from 'next/server'
import { listRows, isConfigured } from '@/lib/sheets-client'
import { universalSearch } from '@/lib/pro-command-engine'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const limit = parseInt(url.searchParams.get('limit') || '15')

    if (!q || q.trim().length < 2) {
      return NextResponse.json({
        results: [],
        query: q,
        message: 'Query too short, minimum 2 characters',
      })
    }

    if (!isConfigured()) {
      return NextResponse.json({ results: [], query: q, message: 'Not configured' })
    }

    const [invoices, items, customers, jobs, quotations, suppliers] = await Promise.all([
      listRows<any>('Invoices').then(r => r.slice(0, 200)).catch(() => []),
      listRows<any>('Items').catch(() => []),
      listRows<any>('Customers').catch(() => []),
      listRows<any>('Jobs').then(r => r.slice(0, 150)).catch(() => []),
      listRows<any>('Quotations').then(r => r.slice(0, 100)).catch(() => []),
      listRows<any>('Suppliers').catch(() => []),
    ])

    const results = universalSearch(q, {
      invoices,
      items,
      customers,
      jobs,
      quotations,
      suppliers,
    }).slice(0, limit)

    return NextResponse.json({
      query: q,
      results,
      total: results.length,
      meta: {
        engine: 'Universal Search v7.0 PRO',
        searchedIn: {
          invoices: invoices.length,
          items: items.length,
          customers: customers.length,
          jobs: jobs.length,
          quotations: quotations.length,
          suppliers: suppliers.length,
        },
        timestamp: new Date().toISOString(),
      }
    }, {
      headers: {
        'X-Search-Engine': 'universal-pro',
        'Cache-Control': 'public, max-age=60',
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Search error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, limit = 15 } = body

    if (!query) {
      return NextResponse.json({ error: 'query required' }, { status: 400 })
    }

    // Reuse GET logic via internal call
    const fakeUrl = new URL(`http://localhost/api/smart/search?q=${encodeURIComponent(query)}&limit=${limit}`)
    const mockReq = {
      url: fakeUrl.toString(),
    } as unknown as NextRequest

    // Inline logic to avoid fetch loop
    const q = query
    if (!isConfigured()) {
      return NextResponse.json({ results: [], query: q })
    }

    const [invoices, items, customers, jobs, quotations, suppliers] = await Promise.all([
      listRows<any>('Invoices').then(r => r.slice(0, 200)).catch(() => []),
      listRows<any>('Items').catch(() => []),
      listRows<any>('Customers').catch(() => []),
      listRows<any>('Jobs').then(r => r.slice(0, 150)).catch(() => []),
      listRows<any>('Quotations').then(r => r.slice(0, 100)).catch(() => []),
      listRows<any>('Suppliers').catch(() => []),
    ])

    const { universalSearch: searchFn } = await import('@/lib/pro-command-engine')
    const results = searchFn(q, { invoices, items, customers, jobs, quotations, suppliers }).slice(0, limit)

    return NextResponse.json({ query: q, results, total: results.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
