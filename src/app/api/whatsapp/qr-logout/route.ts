import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/whatsapp/qr-logout
 * Body: { sessionId }
 * Destroys a WhatsApp QR login session.
 */

const g = globalThis as any
if (!g.__waQrSessions) g.__waQrSessions = new Map()
const sessions: Map<string, any> = g.__waQrSessions

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId } = body
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    if (sessions.has(sessionId)) {
      sessions.delete(sessionId)
      return NextResponse.json({ success: true, message: 'Logged out' })
    }
    return NextResponse.json({ success: true, message: 'Already logged out' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
