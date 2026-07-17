import { NextResponse } from 'next/server'
import { isConfigured, testConnection } from '@/lib/sheets-client'

// GET /api/config - check if app is configured (for setup wizard)
export async function GET() {
  return NextResponse.json({
    configured: isConfigured(),
  })
}

// POST /api/config - test connection
export async function POST() {
  const result = await testConnection()
  return NextResponse.json(result)
}
