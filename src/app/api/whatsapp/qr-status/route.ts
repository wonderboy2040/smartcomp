import { NextRequest, NextResponse } from 'next/server'
import { qrSessions } from '@/lib/whatsapp-qr-store'

/**
 * GET /api/whatsapp/qr-status?sessionId=xxx
 * Returns the current status of a QR login session.
 *
 * POST /api/whatsapp/qr-status
 * Body: { sessionId, confirm?: boolean, phoneNumber?: string }
 *   - If confirm=true, marks the session as 'connected' (manual confirmation
 *     flow for self-hosted deployments without a real webhook).
 */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const session = qrSessions.get(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found. It may have expired — please generate a new QR code.', status: 'expired' },
        { status: 404 },
      )
    }

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

    const session = qrSessions.get(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found. The QR code may have expired — please generate a new one.', status: 'expired' },
        { status: 404 },
      )
    }

    // Check expiry first
    if (Date.now() > session.expiresAt) {
      session.status = 'expired'
      return NextResponse.json(
        { error: 'Session expired. Please generate a new QR code.', status: 'expired' },
        { status: 410 },
      )
    }

    if (confirm) {
      session.status = 'connected'
      session.phoneNumber = String(phoneNumber || '')
      session.connectedAt = Date.now()
      // Re-save (the store is a Map of references, but be explicit)
      qrSessions.set(session)
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
