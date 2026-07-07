import { NextRequest, NextResponse } from 'next/server'

/**
 * Client-side error logger.
 *
 * When the global error boundary catches a runtime error, it POSTs the error
 * details here. We log them to the server console so they show up in Render
 * logs — this lets us see the actual stack trace and fix the root cause.
 *
 * This endpoint is public (no PIN) because errors can happen before login.
 */

// In-memory ring buffer of recent errors (kept for debugging)
const errorBuffer: any[] = []
const MAX_BUFFER = 50

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entry = {
      time: body?.time || new Date().toISOString(),
      message: String(body?.message || '').slice(0, 500),
      stack: String(body?.stack || '').slice(0, 2000),
      digest: String(body?.digest || '').slice(0, 100),
      url: String(body?.url || '').slice(0, 500),
    }
    // Store in buffer
    errorBuffer.push(entry)
    if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift()
    // Log to server console (shows in Render logs)
    console.error('[CLIENT_ERROR]', JSON.stringify(entry, null, 2))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 })
  }
}

export async function GET() {
  // Return recent errors for debugging (only works without PIN if public)
  return NextResponse.json({ errors: errorBuffer.slice(-20) })
}
