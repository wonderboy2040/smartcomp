import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseIncomingWebhook, markMessageAsRead, isCloudApiConfigured } from '@/lib/whatsapp-cloud'
import { listRows, updateRow, createRow } from '@/lib/sheets-client'
import { parseRateResponse } from '@/lib/whatsapp'

/**
 * WhatsApp Cloud API Webhook endpoint.
 *
 * Two responsibilities:
 *   1. GET  — Meta webhook verification (when you set up the webhook in Meta dashboard)
 *   2. POST — Incoming messages from suppliers. We auto-match to an existing enquiry,
 *             parse rates, and save the response. No manual paste needed.
 *
 * Webhook URL to register in Meta:  https://your-domain.com/api/whatsapp/webhook
 * Verify token (set WA_VERIFY_TOKEN env): any random string, e.g. "smartcomp_wh_2026"
 *
 * DATA PROTECTION: this endpoint only reads + creates + updates (soft). It never deletes.
 */

// ===== GET: Webhook verification =====
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode') || undefined
  const token = url.searchParams.get('hub.verify_token') || undefined
  const challenge = url.searchParams.get('hub.challenge') || undefined

  const result = verifyWebhook(mode, token, challenge)
  if (result.ok && result.challenge !== undefined) {
    // Meta expects the challenge as the plain response body
    return new NextResponse(result.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ===== POST: Incoming message handler =====
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages = parseIncomingWebhook(body)

    if (messages.length === 0) {
      // Could be a status update (sent/delivered/read) — acknowledge silently
      return NextResponse.json({ success: true, handled: 0 })
    }

    // Load suppliers once for matching by phone number
    const suppliers = await listRows<any>('Suppliers', { useCache: true })
    const suppliersByPhone = new Map<string, any>()
    for (const s of suppliers) {
      const phones = [s.whatsappNumber, s.phone].filter(Boolean).map(String)
      for (const p of phones) {
        const norm = normalizePhoneLocal(p)
        if (norm) suppliersByPhone.set(norm, s)
      }
    }

    // Load open enquiries to match against
    const enquiries = await listRows<any>('Enquiries')
    const openEnquiries = enquiries.filter(
      (e) => String(e.status) === 'sent' && !(e.appliedToItems === true || e.appliedToItems === 'true')
    )

    let handled = 0
    for (const msg of messages) {
      const normFrom = normalizePhoneLocal(msg.from)
      if (!normFrom) continue

      // 1. Find matching supplier by phone
      const supplier = suppliersByPhone.get(normFrom)
      if (!supplier) {
        // Unknown sender — still log a record so nothing is lost (data protection)
        await createRow('Enquiries', {
          supplierId: '',
          supplierName: msg.fromName || `Unknown (${msg.from})`,
          supplierPhone: msg.from,
          itemsJson: '[]',
          message: '(incoming, no matching supplier)',
          status: 'responded',
          sentAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
          respondedAt: new Date().toISOString(),
          response: msg.text,
          ratesJson: '[]',
          appliedToItems: false,
          isAuto: false,
        }).catch(() => {})
        continue
      }

      // 2. Find the most recent open enquiry for this supplier
      const matching = openEnquiries
        .filter((e) => String(e.supplierId) === String(supplier.id))
        .sort((a, b) => new Date(b.sentAt || b.createdAt || 0).getTime() - new Date(a.sentAt || a.createdAt || 0).getTime())[0]

      if (!matching) {
        // No open enquiry, but supplier replied — create a fresh "responded" record
        const rates = parseRateResponse(msg.text, [])
        await createRow('Enquiries', {
          supplierId: String(supplier.id),
          supplierName: String(supplier.name),
          supplierPhone: String(supplier.whatsappNumber || supplier.phone || ''),
          itemsJson: '[]',
          message: '(unsolicited reply)',
          status: 'responded',
          sentAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
          respondedAt: new Date().toISOString(),
          response: msg.text,
          ratesJson: JSON.stringify(rates),
          appliedToItems: false,
          isAuto: false,
        }).catch(() => {})
        handled++
        continue
      }

      // 3. Parse rates from the reply
      let items: any[] = []
      try {
        items = JSON.parse(String(matching.itemsJson || '[]'))
      } catch {
        items = []
      }
      const rates = parseRateResponse(msg.text, items)

      // 4. Update the matching enquiry with the response + parsed rates
      await updateRow('Enquiries', String(matching.id), {
        status: 'responded',
        respondedAt: new Date().toISOString(),
        response: msg.text,
        ratesJson: JSON.stringify(rates),
      }).catch(() => {})

      // 5. Mark the incoming message as read (optional, keeps Business app clean)
      await markMessageAsRead(msg.messageId).catch(() => {})

      handled++
    }

    return NextResponse.json({ success: true, handled })
  } catch (e: any) {
    // Always return 200 to Meta so they don't retry endlessly; log the error
    console.error('Webhook POST error:', e?.message)
    return NextResponse.json({ success: false, error: e?.message }, { status: 200 })
  }
}

// local helper (avoids importing the ESM normalizePhone for type issues)
function normalizePhoneLocal(raw: string): string {
  const s = String(raw || '').replace(/[^\d]/g, '')
  if (s.length === 10) return '91' + s
  if (s.length === 12 && s.startsWith('91')) return s
  if (s.length === 11 && s.startsWith('0')) return '91' + s.slice(1)
  return s
}
