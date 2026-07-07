import { NextResponse } from 'next/server'
import { isConfigured, testConnection, listRows } from '@/lib/sheets-client'

export async function GET() {
  try {
    const enabled = isConfigured()
    if (!enabled) {
      return NextResponse.json({ enabled: false, lastSync: null, lastSyncStatus: null, pending: { invoices: 0, quotations: 0, payments: 0 } })
    }
    
    // Since data is in Google Sheets directly, everything is always "synced"
    const [invoices, quotations, payments] = await Promise.all([
      listRows<any>('Invoices'),
      listRows<any>('Quotations'),
      listRows<any>('Payments'),
    ])
    
    return NextResponse.json({
      enabled: true,
      lastSync: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncMessage: 'Data stored directly in Google Sheets',
      pending: {
        invoices: 0, // Always 0 since data is in Sheets directly
        quotations: 0,
        payments: 0,
      },
      counts: {
        invoices: invoices.length,
        quotations: quotations.length,
        payments: payments.length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST() {
  const result = await testConnection()
  return NextResponse.json(result)
}
