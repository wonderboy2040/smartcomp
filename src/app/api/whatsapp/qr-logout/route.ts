import { NextRequest, NextResponse } from 'next/server'
import { qrSessions } from '@/lib/whatsapp-qr-store'

/**
 * POST /api/whatsapp/qr-logout
 * Body: { sessionId }
 * Destroys a WhatsApp QR login session.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId } = body
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    if (qrSessions.has(sessionId)) {
      qrSessions.delete(sessionId)
      return NextResponse.json({ success: true, message: 'Logged out' })
    }
    return NextResponse.json({ success: true, message: 'Already logged out' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
