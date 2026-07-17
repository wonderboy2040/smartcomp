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
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

export async function GET(req: NextRequest) {
  return POST(req)
}
