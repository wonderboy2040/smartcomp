import { NextRequest, NextResponse } from 'next/server'
import { getRow, updateRow, deleteRow } from '@/lib/sheets-client'
import { parseRateResponse } from '@/lib/whatsapp'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const e = await getRow('Enquiries', id)
    if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(e)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { response, action } = body

    if (action === 'respond') {
      const enquiry = await getRow<any>('Enquiries', id)
      if (!enquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const items = JSON.parse(enquiry.itemsJson || '[]')
      const parsedRates = parseRateResponse(response, items)

      const updated = await updateRow('Enquiries', id, {
        response,
        status: 'responded',
        respondedAt: new Date().toISOString(),
        ratesJson: JSON.stringify(parsedRates),
      })

      return NextResponse.json({ success: true, enquiry: updated, parsedRates })
    }

    if (action === 'applyRates') {
      const enquiry = await getRow<any>('Enquiries', id)
      if (!enquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const rates = JSON.parse(enquiry.ratesJson || '[]') as any[]
      const items = JSON.parse(enquiry.itemsJson || '[]') as any[]
      let appliedCount = 0

      for (const rate of rates) {
        const matchedItem = items.find(
          (i) => i.name === rate.itemName || i.name.toLowerCase().includes(rate.itemName.toLowerCase())
        )
        if (matchedItem?.id) {
          const updateData: any = { costPrice: rate.rate }
          if (rate.gstApplicable !== null && rate.gstApplicable !== undefined) {
            updateData.gstApplicable = rate.gstApplicable
          }
          if (rate.gstRate !== undefined) {
            updateData.gstRate = rate.gstRate
          }
          await updateRow('Items', matchedItem.id, updateData)
          appliedCount++
        }
      }

      await updateRow('Enquiries', id, { status: 'rate_updated', appliedToItems: true })

      return NextResponse.json({ success: true, appliedCount })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteRow('Enquiries', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
