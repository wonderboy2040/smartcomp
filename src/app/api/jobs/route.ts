import { NextRequest, NextResponse } from 'next/server'
import { listRows, createRow, isConfigured } from '@/lib/sheets-client'
import { safeJsonParse } from '@/lib/utils'
import { generateTrackToken } from '@/lib/notifications'

/**
 * GET /api/jobs — list all service jobs
 * Query: ?status=Pending ?engineer=xxx ?search=xxx
 */
export async function GET(req: NextRequest) {
  try {
    if (!isConfigured()) return NextResponse.json([])
    const url = new URL(req.url)
    const statusFilter = url.searchParams.get('status')
    const engineerFilter = url.searchParams.get('engineer')
    const search = url.searchParams.get('search')

    let jobs = await listRows<any>('Jobs')
    if (statusFilter) jobs = jobs.filter((j) => String(j.status) === statusFilter)
    if (engineerFilter) jobs = jobs.filter((j) => String(j.assignedEngineer || '') === engineerFilter)
    if (search) {
      const q = search.toLowerCase()
      jobs = jobs.filter((j) =>
        String(j?.jobId || '').toLowerCase().includes(q) ||
        String(j?.customerName || '').toLowerCase().includes(q) ||
        String(j?.customerMobile || '').includes(q) ||
        String(j?.brandModel || '').toLowerCase().includes(q) ||
        String(j?.deviceType || '').toLowerCase().includes(q) ||
        String(j?.serialNumber || '').toLowerCase().includes(q)
      )
    }

    // Sort: newest first
    jobs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

    // Defensive coercion + parse status history + build track URL
    const result = jobs.map((j) => ({
      ...j,
      jobId: String(j?.jobId || ''),
      trackToken: String(j?.trackToken || ''),
      customerName: String(j?.customerName || ''),
      customerMobile: String(j?.customerMobile || ''),
      deviceType: String(j?.deviceType || ''),
      brandModel: String(j?.brandModel || ''),
      serialNumber: String(j?.serialNumber || ''),
      problemDesc: String(j?.problemDesc || ''),
      accessories: String(j?.accessories || ''),
      serviceType: String(j?.serviceType || 'InShop'),
      priority: String(j?.priority || 'Low'),
      status: String(j?.status || 'Pending'),
      estimatedAmount: Number(j?.estimatedAmount) || 0,
      advanceAmount: Number(j?.advanceAmount) || 0,
      finalAmount: Number(j?.finalAmount) || 0,
      serviceCharge: Number(j?.serviceCharge) || 0,
      paidAmount: Number(j?.paidAmount) || 0,
      engineerShare: Number(j?.engineerShare) || 0,
      adminShare: Number(j?.adminShare) || 0,
      partsProfit: Number(j?.partsProfit) || 0,
      serviceProfit: Number(j?.serviceProfit) || 0,
      warrantyDays: Number(j?.warrantyDays) || 0,
      warrantyExpiry: j?.warrantyExpiry || '',
      diagnosisNotes: String(j?.diagnosisNotes || ''),
      partsUsed: safeJsonParse<any[]>(j?.partsUsedJson, []),
      statusHistory: safeJsonParse<any[]>(j?.statusHistoryJson, []),
      trackUrl: j?.trackToken ? `/track/${j.jobId}-${j.trackToken}` : '',
    }))

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

/**
 * POST /api/jobs — create a new service job
 * Generates jobId like SC20260708001 (prefix + yyyymmdd + sequence)
 * Also generates an unguessable trackToken for public tracking URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Generate job ID
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = `${y}${m}${d}`

    const existing = await listRows<any>('Jobs')
    const todays = existing.filter((j) => String(j?.jobId || '').includes(dateStr))
    let maxSeq = 0
    for (const j of todays) {
      const numStr = String(j?.jobId || '').slice(-3)
      const n = parseInt(numStr, 10)
      if (!isNaN(n) && n > maxSeq) maxSeq = n
    }
    const seq = String(maxSeq + 1).padStart(3, '0')

    const jobId = `SC${dateStr}${seq}`
    const trackToken = generateTrackToken()

    // Initial status history
    const statusHistory = [{
      status: 'Pending',
      timestamp: now.toISOString(),
      note: 'Job created',
    }]

    const job = await createRow('Jobs', {
      jobId,
      trackToken,
      customerName: String(body?.customerName || ''),
      customerMobile: String(body?.customerMobile || ''),
      deviceType: String(body?.deviceType || ''),
      brandModel: String(body?.brandModel || ''),
      serialNumber: String(body?.serialNumber || ''),
      problemDesc: String(body?.problemDesc || ''),
      accessories: String(body?.accessories || ''),
      serviceType: String(body?.serviceType || 'InShop'),
      priority: String(body?.priority || 'Low'),
      estimatedAmount: Number(body?.estimatedAmount) || 0,
      advanceAmount: Number(body?.advanceAmount) || 0,
      advanceMode: String(body?.advanceMode || ''),
      status: 'Pending',
      assignedEngineer: String(body?.assignedEngineer || ''),
      partsUsedJson: '[]',
      finalAmount: 0,
      serviceCharge: 0,
      paidAmount: 0,
      paymentMode: '',
      paymentType: '',
      engineerShare: 0,
      adminShare: 0,
      partsProfit: 0,
      serviceProfit: 0,
      notes: String(body?.notes || ''),
      diagnosisNotes: '',
      warrantyDays: Number(body?.warrantyDays) || 30,
      warrantyExpiry: '',
      statusHistoryJson: JSON.stringify(statusHistory),
      completedDate: '',
      deliveredAt: '',
    })

    // If advance was paid, record a ServicePayment
    if (Number(body?.advanceAmount) > 0) {
      await createRow('ServicePayments', {
        jobId,
        customerName: String(body?.customerName || ''),
        amount: Number(body?.advanceAmount),
        mode: String(body?.advanceMode || 'Cash'),
        type: 'Advance',
        date: new Date().toISOString(),
        engineerShare: 0,
        adminShare: Number(body?.advanceAmount),
        notes: 'Advance payment at job creation',
      }).catch(() => {})
    }

    return NextResponse.json({
      ...job,
      trackUrl: `/track/${jobId}-${trackToken}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
