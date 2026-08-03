import { NextRequest, NextResponse } from 'next/server'
import { listRows, updateRow } from '@/lib/sheets-client'
import { sendCustomerNotification } from '@/lib/notifications'

/**
 * POST /api/cron/amc
 * Daily cron — checks AMC contracts expiring in 30 days, sends WhatsApp alert.
 * Also marks expired contracts as 'expired'.
 *
 * On Render: use external cron (cron-job.org) to hit this daily at 10 AM.
 * Header: Authorization: Bearer CRON_SECRET
 *
 * SECURITY: CRON_SECRET is REQUIRED in production. If unset, the endpoint
 * returns 503 — preventing mass-WhatsApp-send abuse. GET is rejected to
 * prevent CSRF (an attacker can craft a GET link the admin might click).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured — cron disabled' },
        { status: 503 }
      )
    }
    // dev: allow without secret, but warn
    console.warn('[cron/amc] CRON_SECRET not set (dev mode) — allowing request')
  } else {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const contracts = await listRows<any>('AMCContracts')
    const shops = await listRows<any>('Shop')
    const shop = shops[0] || {}
    const shopName = String(shop.name || 'Smart Computers')

    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let alertsSent = 0
    let expiredMarked = 0

    for (const c of contracts) {
      if (String(c.status) !== 'active') continue
      const endDate = c.endDate ? new Date(c.endDate) : null
      if (!endDate) continue

      // Mark expired
      if (endDate < now) {
        await updateRow('AMCContracts', String(c.id), { status: 'expired' }).catch(() => {})
        expiredMarked++
        continue
      }

      // Expiring in 30 days — send alert
      if (endDate < in30Days && c.customerPhone) {
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        const message = `*${shopName}*\n\nDear ${c.customerName},\n\nYour AMC contract (${c.contractNumber}) is expiring in ${daysLeft} days.\n\nRenew now to continue uninterrupted service coverage.\n\nContact us to renew. Thank you!`

        const result = await sendCustomerNotification(String(c.customerPhone), message)
        if (result.success) alertsSent++
      }
    }

    return NextResponse.json({
      success: true,
      message: `AMC cron complete: ${alertsSent} alerts sent, ${expiredMarked} contracts marked expired`,
      alertsSent,
      expiredMarked,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

// GET is intentionally rejected — cron endpoints must be POST to avoid CSRF.
// (An attacker can craft a <img src="..."> or link the admin might click;
//  they cannot craft a cross-origin POST without CORS pre-flight.)
export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed — use POST with Authorization: Bearer <CRON_SECRET>' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
