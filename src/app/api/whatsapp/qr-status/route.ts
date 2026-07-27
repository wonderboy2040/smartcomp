import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/whatsapp/qr-status?sessionId=xxx
 * Returns the current status of a QR login session.
 *
 * POST /api/whatsapp/qr-status
 * Body: { sessionId, confirm?: boolean, phoneNumber?: string }
 *   - If confirm=true, marks the session as 'connected' (manual confirmation
 *     flow for self-hosted deployments without a real webhook).
 */

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

// Share the same in-memory store as qr-login/route.ts
// (In Next.js dev, each route module is a separate module instance, so we
// use a globalThis pointer to share state.)
const g = globalThis as any
if (!g.__waQrSessions) g.__waQrSessions = new Map<string, QrSession>()
const sessions: Map<string, QrSession> = g.__waQrSessions

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const session = sessions.get(sessionId)
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Check expiry
    if (session.status === 'pending' && Date.now() > session.expiresAt) {
      session.status = 'expired'
    }

    return NextResponse.json({
      sessionId: session.sessionId,
      status: session.status,
      phoneNumber: session.phoneNumber,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      connectedAt: session.connectedAt,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, confirm, phoneNumber } = body
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const session = sessions.get(sessionId)
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    if (session.status === 'expired' || Date.now() > session.expiresAt) {
      session.status = 'expired'
      return NextResponse.json({ error: 'Session expired. Generate a new QR code.' }, { status: 410 })
    }

    if (confirm) {
      session.status = 'connected'
      session.phoneNumber = String(phoneNumber || '')
      session.connectedAt = Date.now()
      return NextResponse.json({
        sessionId: session.sessionId,
        status: 'connected',
        phoneNumber: session.phoneNumber,
        connectedAt: session.connectedAt,
      })
    }

    return NextResponse.json({ status: session.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
