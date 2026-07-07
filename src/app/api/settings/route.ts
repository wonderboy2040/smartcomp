import { NextResponse } from 'next/server'
import { testConnection } from '@/lib/sheets-client'

// GET - connection status (no settings stored in app, only env var)
export async function GET() {
  return NextResponse.json({
    message: 'Google Sheets sync is configured via APPS_SCRIPT_URL environment variable.',
  })
}

// POST - test connection
export async function POST() {
  const result = await testConnection()
  return NextResponse.json(result)
}
