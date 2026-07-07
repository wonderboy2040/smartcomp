import { NextRequest, NextResponse } from 'next/server'
import { listRows, createRow, isConfigured } from '@/lib/sheets-client'
import { buildEnquiryMessage, generateWhatsAppLink } from '@/lib/whatsapp'

// Cron job: Auto-create enquiries on 1st and 15th of month
// Vercel cron config in vercel.json: "0 10 1,15 * *"
// External cron (Render): curl -X POST https://your-app.com/api/cron/auto-enquiry -H "Authorization: Bearer YOUR_SECRET"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 503 })
    }

    const today = new Date()
    const day = today.getDate()
    if (day !== 1 && day !== 15) {
      return NextResponse.json({ success: true, message: 'Not an enquiry day', day })
    }

    const shop = await listRows<any>('Shop')
    const shopData = shop[0] || { name: 'Smart Computers' }

    const suppliers = (await listRows<any>('Suppliers')).filter(
      (s) => (s.active === true || s.active === 'true') && (s.includeInAutoEnquiry === true || s.includeInAutoEnquiry === 'true')
    )

    if (suppliers.length === 0) {
      return NextResponse.json({ success: true, message: 'No active suppliers' })
    }

    const items = await listRows<any>('Items')
    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'No items to enquire' })
    }

    const existingEnquiries = await listRows<any>('Enquiries')
    const todayStr = today.toISOString().slice(0, 10)

    const created = []
    for (const supplier of suppliers) {
      // Check if already sent today
      const alreadySent = existingEnquiries.some(
        (e) => e.supplierId === supplier.id && (e.isAuto === true || e.isAuto === 'true') && (e.sentAt || '').slice(0, 10) === todayStr
      )
      if (alreadySent) continue

      const message = buildEnquiryMessage(shopData.name, items.map((i) => ({ name: i.name, sku: i.sku })))
      const phone = supplier.whatsappNumber || supplier.phone
      const link = generateWhatsAppLink(phone, message)

      const enquiry = await createRow('Enquiries', {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierPhone: phone,
        itemsJson: JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, sku: i.sku }))),
        message,
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: '',
        response: '',
        ratesJson: '[]',
        appliedToItems: false,
        isAuto: true,
      })

      created.push({ enquiryId: enquiry.id, supplierName: supplier.name, whatsappLink: link })
    }

    return NextResponse.json({ success: true, message: `Auto-created ${created.length} enquiries`, enquiries: created })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
