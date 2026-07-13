import { NextRequest, NextResponse } from 'next/server'
import { getRow, updateRow, deleteRow, listRows, createRow } from '@/lib/sheets-client'
import { safeJsonParse } from '@/lib/utils'
import { sendJobStatusNotification } from '@/lib/notifications'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const job = await getRow<any>('Jobs', id)
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...job,
      partsUsed: safeJsonParse<any[]>(job.partsUsedJson, []),
      statusHistory: safeJsonParse<any[]>(job.statusHistoryJson, []),
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

    // Helper: append to status history + send notification
    async function appendStatusAndNotify(jobId: string, job: any, newStatus: string, note: string, updatedJob: any) {
      try {
        const history = safeJsonParse<any[]>(job?.statusHistoryJson, [])
        history.push({ status: newStatus, timestamp: new Date().toISOString(), note })
        await updateRow('Jobs', jobId, { statusHistoryJson: JSON.stringify(history) }).catch(() => {})

        // Send WhatsApp notification (fire-and-forget, never blocks)
        const shopRows = await listRows<any>('Shop', { useCache: true })
        const shopName = String(shopRows[0]?.name || 'Smart Computers')
        const trackUrl = job?.trackToken ? `${process.env.NEXT_PUBLIC_BASE_URL || ''}/track/${job.jobId}-${job.trackToken}` : undefined
        const notif = await sendJobStatusNotification(
          { ...job, ...updatedJob },
          newStatus,
          shopName,
          trackUrl
        )
        return notif
      } catch {
        return null
      }
    }

    if (action === 'updateStatus') {
      const existing = await getRow<any>('Jobs', id)
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const newStatus = String(body?.status || 'Pending')
      const updated = await updateRow('Jobs', id, {
        status: newStatus,
        notes: String(body?.notes || ''),
        assignedEngineer: String(body?.assignedEngineer || ''),
      })

      // Send notification if status actually changed
      let notifResult: any = null
      if (String(existing.status) !== newStatus) {
        notifResult = await appendStatusAndNotify(id, existing, newStatus, `Status changed to ${newStatus}`, updated)
      }

      return NextResponse.json({ success: true, job: updated, notification: notifResult })
    }

    if (action === 'complete') {
      const existing = await getRow<any>('Jobs', id)
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      // Mark job as completed with final amount, parts used, profit calc
      const partsUsed = body?.partsUsed || []
      const finalAmount = Number(body?.finalAmount) || 0
      const paymentMode = String(body?.paymentMode || 'Cash')
      const paymentType = String(body?.paymentType || 'Final')
      const engineerSharePct = Number(body?.engineerSharePct) || 50
      const warrantyDays = Number(body?.warrantyDays) || Number(existing?.warrantyDays) || 30
      const partsProfit = partsUsed.reduce((s: number, p: any) => {
        return s + ((Number(p?.sellPrice) || 0) - (Number(p?.costPrice) || 0)) * (Number(p?.qty) || 1)
      }, 0)
      const serviceProfit = Math.max(0, finalAmount - partsUsed.reduce((s: number, p: any) => {
        return s + (Number(p?.costPrice) || 0) * (Number(p?.qty) || 1)
      }, 0))

      const engineerShare = Math.round((serviceProfit * engineerSharePct / 100) + (partsProfit * engineerSharePct / 100))
      const adminShare = (serviceProfit + partsProfit) - engineerShare

      // Compute warranty expiry
      const warrantyExpiry = new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000).toISOString()

      const updated = await updateRow('Jobs', id, {
        status: 'Completed',
        partsUsedJson: JSON.stringify(partsUsed),
        finalAmount,
        serviceCharge: Number(body?.serviceCharge) || 0,
        paidAmount: Number(body?.paidAmount) || Number(existing?.paidAmount) || 0,
        paymentMode,
        paymentType,
        engineerShare,
        adminShare,
        partsProfit,
        serviceProfit,
        warrantyDays,
        warrantyExpiry,
        completedDate: new Date().toISOString(),
        diagnosisNotes: String(body?.diagnosisNotes || ''),
        notes: String(body?.notes || ''),
      })

      // Record final payment
      if (finalAmount > 0) {
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

      // Send "Completed" notification
      const notifResult = await appendStatusAndNotify(id, existing, 'Completed', 'Job completed', updated)

      return NextResponse.json({
        success: true,
        job: updated,
        engineerShare,
        adminShare,
        partsProfit,
        serviceProfit,
        warrantyExpiry,
        notification: notifResult,
      })
    }

    if (action === 'deliver') {
      const existing = await getRow<any>('Jobs', id)
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const updated = await updateRow('Jobs', id, {
        status: 'Delivered',
        deliveredAt: new Date().toISOString(),
      })

      // Send "Delivered" notification
      const notifResult = await appendStatusAndNotify(id, existing, 'Delivered', 'Job delivered to customer', updated)

      return NextResponse.json({ success: true, job: updated, notification: notifResult })
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
      const fields = ['customerName', 'customerMobile', 'deviceType', 'brandModel', 'serialNumber', 'problemDesc', 'accessories', 'serviceType', 'priority', 'estimatedAmount', 'advanceAmount', 'advanceMode', 'assignedEngineer', 'notes', 'diagnosisNotes', 'warrantyDays', 'serviceCharge', 'status']
      for (const f of fields) {
        if (body[f] !== undefined) data[f] = body[f]
      }
      // Auto-recompute finalAmount if serviceCharge is being updated
      if (body.serviceCharge !== undefined) {
        const existing = await getRow<any>('Jobs', id)
        const partsUsed = safeJsonParse<any[]>(existing?.partsUsedJson, [])
        const partsTotal = partsUsed.reduce((s: number, p: any) => s + (Number(p?.sellPrice) || 0) * (Number(p?.qty) || 1), 0)
        data.finalAmount = (Number(body.serviceCharge) || 0) + partsTotal
      }
      const updated = await updateRow('Jobs', id, data)
      return NextResponse.json({ success: true, job: updated })
    }

    if (action === 'recordPayment') {
      // Record a partial / full payment WITHOUT completing the job
      const existing = await getRow<any>('Jobs', id)
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const amount = Number(body?.amount) || 0
      const mode = String(body?.mode || 'Cash')
      if (amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

      const newPaid = (Number(existing.paidAmount) || 0) + amount
      const updated = await updateRow('Jobs', id, {
        paidAmount: newPaid,
        paymentMode: mode,
        updatedAt: new Date().toISOString(),
      })

      // Also record in ServicePayments sheet
      await createRow('ServicePayments', {
        jobId: String(existing.jobId || ''),
        customerName: String(existing.customerName || ''),
        amount,
        mode,
        type: 'Partial',
        date: new Date().toISOString(),
        engineerShare: 0,
        adminShare: amount,
        notes: 'Partial payment recorded',
      }).catch(() => {})

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
