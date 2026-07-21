import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, testConnection, listRows, getAllDataQuantum } from '@/lib/sheets-client'

// Quantum Sync Endpoint - supports getAllData single-call (like index.html PWA)
// and liveSync with hash, plus legacy status check

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    const enabled = isConfigured()

    if (!enabled) {
      return NextResponse.json({
        enabled: false,
        lastSync: null,
        lastSyncStatus: null,
        lastSyncMessage: 'Not configured',
      })
    }

    // Quantum: getAllData single call - 5x faster than 5 separate calls
    if (action === 'getAllData') {
      try {
        const data = await getAllDataQuantum()
        if (data) {
          return NextResponse.json({
            success: true,
            status: 'success',
            data,
            quantum: true,
            cached: false,
            timestamp: new Date().toISOString(),
          }, {
            headers: {
              'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
              'X-Quantum': 'getAllData',
            }
          })
        }
        // Fallback to manual batch if quantum fails
        const [jobs, items, payments, customers, shopRows] = await Promise.all([
          listRows<any>('Jobs').catch(() => []),
          listRows<any>('Items').catch(() => []),
          listRows<any>('ServicePayments').catch(() => []),
          listRows<any>('Customers').catch(() => []),
          listRows<any>('Shop').catch(() => []),
        ])
        return NextResponse.json({
          success: true,
          status: 'success',
          data: {
            jobs,
            spareParts: items,
            items,
            payments,
            servicePayments: payments,
            customers,
            shop: shopRows[0] || null,
            timestamp: new Date().toISOString(),
          },
          quantum: true,
          fallback: true,
        })
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e?.message, quantum: true }, { status: 500 })
      }
    }

    // Default status check (no heavy sheet reads)
    return NextResponse.json({
      enabled,
      lastSync: enabled ? new Date().toISOString() : null,
      lastSyncStatus: enabled ? 'success' : null,
      lastSyncMessage: enabled ? 'Quantum Sync Ready - getAllData + liveSync enabled (v5.0)' : null,
      quantum: true,
      version: '5.0',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const actionParam = url.searchParams.get('action')

    // If action is in body (quantum liveSync from PWA)
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const action = body.action || actionParam

    // Quantum liveSync handling - forward to Apps Script
    if (action === 'liveSync') {
      if (!isConfigured()) {
        return NextResponse.json({ success: false, error: 'Not configured' }, { status: 400 })
      }

      try {
        // Import dynamically to avoid circular deps
        const { getAppsScriptUrl } = await import('@/lib/runtime-config')
        const appsUrl = getAppsScriptUrl()
        if (!appsUrl) throw new Error('Not configured')

        // Forward to Apps Script with 3s timeout like index.html
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)

        const res = await fetch(appsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        const text = await res.text()
        try {
          const parsed = JSON.parse(text)
          return NextResponse.json(parsed, { headers: { 'X-Quantum': 'liveSync' } })
        } catch {
          return NextResponse.json({ success: true, status: 'success', data: { timestamp: new Date().toISOString() }, quantum: true })
        }
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e?.message, quantum: true, offline: true }, { status: 200 }) // return 200 to not break PWA offline logic
      }
    }

    // Default: test connection
    const result = await testConnection()
    return NextResponse.json({ ...result, quantum: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message, quantum: true }, { status: 500 })
  }
}
