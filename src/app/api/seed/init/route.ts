import { NextRequest, NextResponse } from 'next/server'
import { seedData, isConfigured } from '@/lib/sheets-client'

const ALLOWED_SECRETS = [process.env.CRON_SECRET, process.env.VERCEL_CRON_SECRET].filter(Boolean) as string[]

export async function POST(req: NextRequest) {
  try {
    if (ALLOWED_SECRETS.length > 0) {
      const authHeader = req.headers.get('authorization') || ''
      const ok = ALLOWED_SECRETS.some((s) => authHeader === `Bearer ${s}`)
      if (!ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Seed endpoint requires CRON_SECRET in production' },
        { status: 503 }
      )
    }

    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 503 })
    }
    const results = await seedData()
    return NextResponse.json({ success: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
