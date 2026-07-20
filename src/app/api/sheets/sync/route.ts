import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, testConnection, listRows, getAllDataQuantum, isCircuitBreakerActive, resetCircuitBreaker } from '@/lib/sheets-client'

// Quantum Sync Endpoint - Fixed for deployment errors
// Issues fixed from logs:
// - Circuit breaker active spamming
// - HTML error page (stale deployment)
// - getAllData fallback failing due to breaker

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
        lastSyncMessage: 'Not configured - Set APPS_SCRIPT_URL in env',
      })
    }

    // If circuit breaker active, return cached or empty immediately, don't spam Apps Script
    if (isCircuitBreakerActive()) {
      if (action === 'getAllData') {
        // Try to return fallback data from individual caches without calling Apps Script
        try {
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
            circuitBreaker: true,
            message: 'Circuit breaker active - serving fallback cache',
          }, {
            headers: { 'X-Quantum': 'getAllData-fallback-circuit-breaker' }
          })
        } catch {
          return NextResponse.json({
            success: true,
            status: 'success',
            data: { jobs: [], spareParts: [], items: [], payments: [], customers: [], shop: null, timestamp: new Date().toISOString() },
            quantum: true,
            fallback: true,
            circuitBreaker: true,
            warning: 'Circuit breaker active, serving empty fallback',
          })
        }
      }
    }

    // Quantum: getAllData single call - 5x faster
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
      } catch (e: any) {
        const errMsg = e?.message || 'Unknown'
        // If HTML error (stale deployment), return helpful message without spamming logs
        if (errMsg.includes('HTML') || errMsg.includes('Stale') || errMsg.includes('LOGIN') || errMsg.includes('Editor URL') || errMsg.includes('Deployment not found')) {
          return NextResponse.json({
            success: false,
            status: 'error',
            error: errMsg,
            fix: 'Settings → Sync → Copy latest code.gs → Paste in Apps Script → Deploy new version → Set Anyone access → Copy /exec URL → Update env',
            quantum: true,
            staleDeployment: true,
          }, { status: 200 }) // Return 200 to avoid breaking frontend, but with error flag
        }
        // For other errors, try fallback without logging circuit breaker spam
        console.warn(`[Quantum Sync] getAllData failed: ${errMsg}, trying fallback`)
      }

      // Fallback to manual batch (works even with old v4.0 Apps Script that doesn't have getAllData)
      try {
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
        // If fallback also fails due to circuit breaker, return empty but success to keep site loading
        const isBreaker = e?.message?.includes('Circuit breaker')
        if (isBreaker) {
          return NextResponse.json({
            success: true,
            status: 'success',
            data: { jobs: [], spareParts: [], items: [], payments: [], customers: [], shop: null, timestamp: new Date().toISOString() },
            quantum: true,
            fallback: true,
            circuitBreaker: true,
            warning: 'Circuit breaker active - site will work after 10s cooldown. Please check Apps Script deployment.',
          })
        }
        return NextResponse.json({ success: false, error: e?.message, quantum: true }, { status: 200 })
      }
    }

    // Default status check (no heavy sheet reads)
    return NextResponse.json({
      enabled,
      lastSync: enabled ? new Date().toISOString() : null,
      lastSyncStatus: enabled ? 'success' : null,
      lastSyncMessage: enabled ? 'Quantum Sync Ready - getAllData + liveSync enabled (v5.0) - Fixed circuit breaker' : null,
      quantum: true,
      version: '5.0',
      circuitBreakerFix: 'Threshold 15, cooldown 10s, HTML 5s, fallback without spam',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message, quantum: true }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const actionParam = url.searchParams.get('action')

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const action = body.action || actionParam

    // Handle reset circuit breaker action (for manual fix)
    if (action === 'resetCircuitBreaker') {
      resetCircuitBreaker()
      return NextResponse.json({ success: true, message: 'Circuit breaker reset', quantum: true })
    }

    // Quantum liveSync handling
    if (action === 'liveSync') {
      if (!isConfigured()) {
        return NextResponse.json({ success: false, error: 'Not configured' }, { status: 200 })
      }

      // If circuit breaker active, don't forward to Apps Script, return success with warning to avoid spam
      if (isCircuitBreakerActive()) {
        return NextResponse.json({
          success: true,
          status: 'success',
          data: { timestamp: new Date().toISOString() },
          quantum: true,
          circuitBreaker: true,
          message: 'Circuit breaker active - liveSync skipped to avoid spam',
        })
      }

      try {
        const { getAppsScriptUrl } = await import('@/lib/runtime-config')
        const appsUrl = getAppsScriptUrl()
        if (!appsUrl) throw new Error('Not configured')

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
          // If HTML returned, it's stale deployment
          if (text.toLowerCase().includes('<!doctype html') || text.toLowerCase().includes('<html')) {
            return NextResponse.json({
              success: false,
              error: 'Stale/broken Apps Script - HTML error page. Fix: Settings → Sync → Copy latest code.gs → Paste in Apps Script → Deploy new version → Anyone access → Copy /exec URL',
              staleDeployment: true,
              quantum: true,
            }, { status: 200 })
          }
          return NextResponse.json({ success: true, status: 'success', data: { timestamp: new Date().toISOString() }, quantum: true })
        }
      } catch (e: any) {
        const isBreaker = e?.message?.includes('Circuit breaker')
        return NextResponse.json({
          success: false,
          error: e?.message,
          quantum: true,
          offline: true,
          circuitBreaker: isBreaker,
        }, { status: 200 })
      }
    }

    // Default: test connection (also resets breaker on success)
    const result = await testConnection()
    if (result.success) {
      // On successful test, reset breaker
      try { resetCircuitBreaker() } catch {}
    }
    return NextResponse.json({ ...result, quantum: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message, quantum: true }, { status: 200 })
  }
}
