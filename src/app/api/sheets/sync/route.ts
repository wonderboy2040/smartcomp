import { NextResponse } from 'next/server'
import { isConfigured, testConnection } from '@/lib/sheets-client'

// PERFORMANCE: This endpoint no longer loads Invoices/Quotations/Payments
// just to return counts. The dashboard endpoint already has all stats.
// This removes 3 unnecessary Apps Script calls on every page load.

export async function GET() {
  try {
    const enabled = isConfigured()
    return NextResponse.json({
      enabled,
      lastSync: enabled ? new Date().toISOString() : null,
      lastSyncStatus: enabled ? 'success' : null,
      lastSyncMessage: enabled ? 'Data stored directly in Google Sheets' : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST() {
  const result = await testConnection()
  return NextResponse.json(result)
}
