import { NextResponse } from 'next/server'
import { startWhatsAppConnection, getState } from '@/lib/whatsapp-baileys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/whatsapp/qr-login
 *
 * Starts a REAL WhatsApp Web connection using Baileys.
 * Returns a genuine QR code (as data URL image) that the phone app
 * recognises when scanning via:
 *   WhatsApp → Settings → Linked Devices → Link a Device
 *
 * The QR is a real WhatsApp pairing code — NOT a wa.me link.
 * Scanning it links the phone to this "device" and enables:
 *   - Auto-capture of incoming supplier rate replies
 *   - Real-time message monitoring
 *   - Session persistence (reconnects automatically)
 */
export async function POST() {
  try {
    const current = getState()

    // If already connected, return success
    if (current.state === 'connected') {
      return NextResponse.json({
        status: 'connected',
        phoneNumber: current.phoneNumber,
        connectedAt: current.connectedAt,
        message: 'Already connected to WhatsApp',
      })
    }

    // Start connection — this generates a real QR code
    const result = await startWhatsAppConnection()

    // Wait a moment for QR to be generated (Baileys is async)
    // Poll state for up to 10 seconds waiting for QR
    let attempts = 0
    let qrCode = result.qrCode
    while (!qrCode && attempts < 20) {
      await new Promise(r => setTimeout(r, 500))
      const s = getState()
      qrCode = s.qrCode
      if (s.state === 'connected') {
        return NextResponse.json({
          status: 'connected',
          phoneNumber: s.phoneNumber,
          connectedAt: s.connectedAt,
        })
      }
      if (s.state === 'error') {
        return NextResponse.json({ error: s.error || 'Connection failed' }, { status: 500 })
      }
      attempts++
    }

    const finalState = getState()
    if (finalState.qrCode) {
      return NextResponse.json({
        status: 'waiting_qr',
        qrCode: finalState.qrCode,  // data URL image — ready for <img src="">
        qrRetry: finalState.qrRetry,
        message: 'Scan QR with WhatsApp → Settings → Linked Devices → Link a Device',
      })
    }

    return NextResponse.json({
      status: finalState.state,
      error: finalState.error || 'QR not generated. Try again.',
    }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to start WhatsApp connection' }, { status: 500 })
  }
}
