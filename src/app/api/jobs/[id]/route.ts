import { NextRequest, NextResponse } from 'next/server'
import { getRow, updateRow, listRows } from '@/lib/sheets-client'
import { jobSchema } from '@/lib/validators'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const job = await getRow('Jobs', id)
    if (!job || job.deleted) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    return NextResponse.json(job)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await getRow('Jobs', id)
    if (!existing || existing.deleted) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const body = await req.json()
    // Validate (allow partial updates — fall back to existing values for missing fields).
    const parsed = jobSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const updated = await updateRow('Jobs', id, {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const job = await getRow('Jobs', id)

    if (job?.partsUsedJson) {
      try {
        const parts = JSON.parse(job.partsUsedJson)
        const items = await listRows('Items')
        for (const part of parts) {
          // Skip entries without a valid itemId (silent data loss otherwise).
          if (!part || !part.itemId) continue
          const item = items.find((i: any) => i.id === part.itemId)
          if (item) {
            // Only patch the quantity field — don't rewrite the entire row.
            await updateRow('Items', part.itemId, {
              quantity: (parseInt(item.quantity) || 0) + (parseInt(part.qty) || 0),
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
