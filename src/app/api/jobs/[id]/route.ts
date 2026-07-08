import { NextRequest, NextResponse } from 'next/server'
import { getRow, updateRow, deleteRow, listRows, createRow } from '@/lib/sheets-client'
import { safeJsonParse } from '@/lib/utils'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const job = await getRow<any>('Jobs', id)
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...job,
      partsUsed: safeJsonParse<any[]>(job.partsUsedJson, []),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { action } = body

    if (action === 'updateStatus') {
      const updated = await updateRow('Jobs', id, {
        status: String(body?.status || 'Pending'),
        notes: String(body?.notes || ''),
        assignedEngineer: String(body?.assignedEngineer || ''),
      })
      return NextResponse.json({ success: true, job: updated })
    }

    if (action === 'complete') {
      // Mark job as completed with final amount, parts used, profit calc
      const partsUsed = body?.partsUsed || []
      const finalAmount = Number(body?.finalAmount) || 0
      const paymentMode = String(body?.paymentMode || 'Cash')
      const paymentType = String(body?.paymentType || 'Final')
      const engineerSharePct = Number(body?.engineerSharePct) || 50 // default 50%
      const partsProfit = partsUsed.reduce((s: number, p: any) => {
        return s + ((Number(p?.sellPrice) || 0) - (Number(p?.costPrice) || 0)) * (Number(p?.qty) || 1)
      }, 0)
      const serviceProfit = Math.max(0, finalAmount - partsUsed.reduce((s: number, p: any) => {
        return s + (Number(p?.costPrice) || 0) * (Number(p?.qty) || 1)
      }, 0))

      // Engineer gets: serviceProfit share + partsProfit share
      // Admin gets: rest
      const engineerShare = Math.round((serviceProfit * engineerSharePct / 100) + (partsProfit * engineerSharePct / 100))
      const adminShare = (serviceProfit + partsProfit) - engineerShare

      const updated = await updateRow('Jobs', id, {
        status: 'Completed',
        partsUsedJson: JSON.stringify(partsUsed),
        finalAmount,
        paymentMode,
        paymentType,
        engineerShare,
        adminShare,
        partsProfit,
        serviceProfit,
        notes: String(body?.notes || ''),
      })

      // Record final payment
      if (finalAmount > 0) {
        // Get advance amount already paid
        const job = await getRow<any>('Jobs', id)
        const advance = Number(job?.advanceAmount) || 0
        const balanceDue = Math.max(0, finalAmount - advance)
        if (balanceDue > 0) {
          await createRow('ServicePayments', {
            jobId: String(job?.jobId || ''),
            customerName: String(job?.customerName || ''),
            amount: balanceDue,
            mode: paymentMode,
            type: 'Final',
            date: new Date().toISOString(),
            engineerShare,
            adminShare,
            notes: 'Final payment at job completion',
          }).catch(() => {})
        }
      }

      return NextResponse.json({ success: true, job: updated, engineerShare, adminShare, partsProfit, serviceProfit })
    }

    if (action === 'deliver') {
      const updated = await updateRow('Jobs', id, {
        status: 'Delivered',
        deliveredAt: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, job: updated })
    }

    if (action === 'addPart') {
      const job = await getRow<any>('Jobs', id)
      if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const existing = safeJsonParse<any[]>(job.partsUsedJson, [])
      existing.push(body?.part)
      const updated = await updateRow('Jobs', id, { partsUsedJson: JSON.stringify(existing) })
      return NextResponse.json({ success: true, partsUsed: existing })
    }

    if (action === 'update') {
      // Generic update
      const data: any = {}
      const fields = ['customerName', 'customerMobile', 'deviceType', 'brandModel', 'serialNumber', 'problemDesc', 'accessories', 'estimatedAmount', 'advanceAmount', 'advanceMode', 'assignedEngineer', 'notes', 'status']
      for (const f of fields) {
        if (body[f] !== undefined) data[f] = body[f]
      }
      const updated = await updateRow('Jobs', id, data)
      return NextResponse.json({ success: true, job: updated })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteRow('Jobs', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
