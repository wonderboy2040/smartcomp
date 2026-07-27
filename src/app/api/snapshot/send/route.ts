import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/snapshot/send
 * Triggers a daily snapshot send — opens WhatsApp with the snapshot message
 * addressed to the shop owner.
 *
 * Since this is a client-side wa.me flow (no WhatsApp Business API), this
 * endpoint returns the snapshot + wa.me URL and the front-end opens it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const targetPhone = String(body.phone || '').replace(/[^\d]/g, '')
    const target = targetPhone.length === 10 ? `91${targetPhone}` : targetPhone

    // Fetch snapshot
    const snapshotUrl = new URL('/api/snapshot?format=whatsapp', req.url)
    const snapRes = await fetch(snapshotUrl)
    if (!snapRes.ok) {
      return NextResponse.json({ error: 'Failed to generate snapshot' }, { status: 500 })
    }
    const snap = await snapRes.json()
    const message = snap.whatsappMessage || ''

    const waUrl = target
      ? `https://wa.me/${target}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`

    return NextResponse.json({
      success: true,
      waUrl,
      snapshot: snap.snapshot,
      message,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
