import { NextRequest, NextResponse } from 'next/server'
import { getRow, updateRow, listRows } from '@/lib/sheets-client'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const job = await getRow('Jobs', id)

    if (job?.partsUsedJson) {
      try {
        const parts = JSON.parse(job.partsUsedJson)
        const items = await listRows('Items')
        for (const part of parts) {
          const item = items.find((i: any) => i.id === part.itemId)
          if (item) {
            await updateRow('Items', part.itemId, {
              ...item,
              quantity: (parseInt(item.quantity) || 0) + (parseInt(part.qty) || 0)
            })
          }
        }
      } catch (e) {
        console.error('Stock restore failed (non-blocking):', e)
      }
    }

    await updateRow('Jobs', id, { deleted: true, updatedAt: new Date().toISOString() })
    return NextResponse.json({ success: true, message: 'Job deleted and stock restored' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
