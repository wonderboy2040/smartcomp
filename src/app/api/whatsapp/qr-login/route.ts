import { NextResponse } from 'next/server'

/**
 * WhatsApp QR Login — Session Manager
 *
 * This simulates a WhatsApp Web-style QR login flow. In production, this would
 * connect to a WhatsApp Business Cloud API or a Baileys/whatsapp-web.js session
 * manager running on a separate worker. For now, we generate a session token
 * and QR code payload that the frontend renders as a QR image.
 *
 * Flow:
 *   1. POST /api/whatsapp/qr-login    → creates session, returns { sessionId, qrPayload }
 *   2. Frontend polls GET /api/whatsapp/qr-status?sessionId=xxx every 3s
 *   3. When user scans QR with WhatsApp → status becomes 'connected'
 *   4. POST /api/whatsapp/qr-logout    → destroys session
 *
 * The QR payload is a wa.me link with a one-time token. When the user opens
 * it on their phone, WhatsApp opens and (in a real deployment) sends a
 * webhook callback that flips the session status to 'connected'.
 *
 * In this self-hosted deployment without a real webhook, the user can
 * manually confirm login by clicking "I've scanned — confirm login" in the
 * UI, which POSTs to /api/whatsapp/qr-status with { confirm: true }.
 */

// In-memory session store (resets on server restart — fine for single-user desktop app)
interface QrSession {
  sessionId: string
  qrToken: string
  qrPayload: string
  status: 'pending' | 'connected' | 'expired' | 'error'
  phoneNumber?: string
  createdAt: number
  expiresAt: number
  connectedAt?: number
}
const sessions = new Map<string, QrSession>()
const SESSION_TTL = 5 * 60 * 1000 // 5 min to scan

function genToken(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function POST() {
  try {
    // Expire old sessions
    const now = Date.now()
    for (const [id, s] of sessions.entries()) {
      if (s.expiresAt < now) sessions.delete(id)
    }

    const sessionId = 'wa_' + genToken(16)
    const qrToken = genToken(24)
    const qrPayload = `https://wa.me/login?t=${qrToken}&s=${sessionId}`

    const session: QrSession = {
      sessionId,
      qrToken,
      qrPayload,
      status: 'pending',
      createdAt: now,
      expiresAt: now + SESSION_TTL,
    }
    sessions.set(sessionId, session)

    return NextResponse.json({
      sessionId,
      qrPayload,
      qrToken,
      expiresAt: session.expiresAt,
      ttl: SESSION_TTL,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
