import { NextRequest, NextResponse } from 'next/server'
import { getRow, updateRow, deleteRow, listRows, createRow, bulkUpdate } from '@/lib/sheets-client'
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

    async function appendStatusAndNotify(jobId: string, job: any, newStatus: string, note: string, updatedJob: any) {
      try {
        const history = safeJsonParse<any[]>(job?.statusHistoryJson, [])
        history.push({ status: newStatus, timestamp: new Date().toISOString(), note })
        await updateRow('Jobs', jobId, { statusHistoryJson: JSON.stringify(history) }).catch(() => {})

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

      let notifResult: any = null
      if (String(existing.status) !== newStatus) {
        notifResult = await appendStatusAndNotify(id, existing, newStatus, `Status changed to ${newStatus}`, updated)
      }

      return NextResponse.json({ success: true, job: updated, notification: notifResult })
    }

    if (action === 'complete') {
      const existing = await getRow<any>('Jobs', id)
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const partsUsed = body?.partsUsed || []
      const finalAmount = Number(body?.finalAmount) || 0
      const paymentMode = String(body?.paymentMode || 'Cash')
      const engineerSharePct = Number(body?.engineerSharePct) || 50
      const warrantyDays = Number(body?.warrantyDays) || Number(existing?.warrantyDays) || 30
      const deductStock = body?.deductStock !== false // default true
      const partsProfit = partsUsed.reduce((s: number, p: any) => {
        return s + ((Number(p?.sellPrice) || 0) - (Number(p?.costPrice) || 0)) * (Number(p?.qty) || 1)
      }, 0)
      const partsCostTotal = partsUsed.reduce((s: number, p: any) => {
        return s + (Number(p?.costPrice) || 0) * (Number(p?.qty) || 1)
      }, 0)
      const serviceProfit = Math.max(0, finalAmount - partsCostTotal - partsUsed.reduce((s: number, p: any) => s + (Number(p?.sellPrice || 0)-Number(p?.costPrice||0))*Number(p?.qty||1), 0) + partsProfit)

      // Recalculate correctly: serviceProfit = serviceCharge, partsProfit as above, but final may include both
      const svcCharge = Number(body?.serviceCharge) || 0
      const actualServiceProfit = svcCharge
      const engineerShare = Math.round((actualServiceProfit * engineerSharePct / 100) + (partsProfit * engineerSharePct / 100))
      const adminShare = (actualServiceProfit + partsProfit) - engineerShare

      const warrantyExpiry = new Date(Date.now() + warrantyDays * 24 * 60 * 60 * 1000).toISOString()

      const updated = await updateRow('Jobs', id, {
        status: 'Completed',
        partsUsedJson: JSON.stringify(partsUsed),
        finalAmount,
        serviceCharge: svcCharge,
        paidAmount: Number(body?.paidAmount) || Number(existing?.paidAmount) || 0,
        paymentMode,
        engineerShare,
        adminShare,
        partsProfit,
        serviceProfit: actualServiceProfit,
        warrantyDays,
        warrantyExpiry,
        completedDate: new Date().toISOString(),
        diagnosisNotes: String(body?.diagnosisNotes || ''),
        notes: String(body?.notes || ''),
      })

      // Deduct stock for linked items (v3.0.2 feature)
      if (deductStock && partsUsed.length > 0) {
        try {
          const linkedParts = partsUsed.filter((p: any) => p.itemId)
          if (linkedParts.length > 0) {
            const itemIds = [...new Set(linkedParts.map((p: any) => p.itemId))]
            const dbItems = await Promise.all(itemIds.map((itemId: string) => getRow<any>('Items', itemId).catch(() => null)))
            const stockUpdates: { id: string; data: any }[] = []
            for (const part of linkedParts) {
              const dbItem = dbItems.find((d: any) => d && String(d.id) === String(part.itemId))
              if (dbItem) {
                const currentQty = Number(dbItem.quantity) || 0
                const deductQty = Number(part.qty) || 1
                stockUpdates.push({
                  id: String(part.itemId),
                  data: { quantity: Math.max(0, currentQty - deductQty) }
                })
              }
            }
            // Merge updates for same item (sum quantities)
            const merged = new Map<string, number>()
            for (const upd of stockUpdates) {
              const existing = merged.get(upd.id) || 0
              // We need to recalc properly - get current from db and sum deductions
              // For simplicity, we already have individual deductions, sum them
              merged.set(upd.id, existing + (Number(partsUsed.find((p: any) => p.itemId === upd.id)?.qty) || 0))
            }
            // Actually redo with proper grouping
            const qtyMap = new Map<string, number>()
            for (const p of linkedParts) {
              qtyMap.set(p.itemId, (qtyMap.get(p.itemId) || 0) + (Number(p.qty) || 1))
            }
            const finalUpdates: { id: string; data: any }[] = []
            for (const [itemId, totalQty] of qtyMap.entries()) {
              const dbItem = dbItems.find((d: any) => d && String(d.id) === String(itemId))
              if (dbItem) {
                finalUpdates.push({
                  id: itemId,
                  data: { quantity: Math.max(0, (Number(dbItem.quantity) || 0) - totalQty) }
                })
              }
            }
            if (finalUpdates.length > 0) {
              await bulkUpdate('Items', finalUpdates).catch(() => {})
            }
          }
        } catch (err) {
          console.error('Stock deduction failed:', err)
          // Don't fail the whole complete action if stock deduction fails
        }
      }

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

      const notifResult = await appendStatusAndNotify(id, existing, 'Completed', 'Job completed', updated)

      return NextResponse.json({
        success: true,
        job: updated,
        engineerShare,
        adminShare,
        partsProfit,
        serviceProfit: actualServiceProfit,
        warrantyExpiry,
        stockDeducted: deductStock,
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
      const data: any = {}
      const fields = ['customerName', 'customerMobile', 'deviceType', 'brandModel', 'serialNumber', 'problemDesc', 'accessories', 'serviceType', 'priority', 'estimatedAmount', 'advanceAmount', 'advanceMode', 'assignedEngineer', 'notes', 'diagnosisNotes', 'warrantyDays', 'serviceCharge', 'status']
      for (const f of fields) {
        if (body[f] !== undefined) data[f] = body[f]
      }
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
