import { NextResponse } from 'next/server'
import { qrSessions, QR_SESSION_TTL, genToken, type QrSession } from '@/lib/whatsapp-qr-store'

/**
 * WhatsApp QR Login — Create Session
 *
 * POST /api/whatsapp/qr-login
 * Returns: { sessionId, qrPayload, qrToken, expiresAt }
 *
 * The QR payload is a `wa.me/?text=...` link so WhatsApp accepts it as
 * valid. When the user scans with WhatsApp, it opens a chat to themselves
 * (or any number) with a pre-filled message containing the session token.
 * In a production webhook setup, a listener catches that message and flips
 * the session to 'connected'. For self-hosted, the user manually confirms
 * via the "Confirm Login" button which POSTs to /api/whatsapp/qr-status.
 */

export async function POST() {
  try {
    // Cleanup expired sessions first
    qrSessions.cleanup()

    const sessionId = 'wa_' + genToken(16)
    const qrToken = genToken(24)

    // WhatsApp-compatible payload: wa.me with pre-filled text.
    // The text contains the session token so a real webhook listener
    // (or the manual confirm flow) can identify which session to mark
    // as connected.
    const loginMessage = `SMARTCOMP LOGIN\nSession: ${sessionId}\nToken: ${qrToken}\nTime: ${new Date().toISOString()}`
    const qrPayload = `https://wa.me/?text=${encodeURIComponent(loginMessage)}`

    const now = Date.now()
    const session: QrSession = {
      sessionId,
      qrToken,
      qrPayload,
      status: 'pending',
      createdAt: now,
      expiresAt: now + QR_SESSION_TTL,
    }
    qrSessions.set(session)

    return NextResponse.json({
      sessionId,
      qrPayload,
      qrToken,
      expiresAt: session.expiresAt,
      ttl: QR_SESSION_TTL,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
