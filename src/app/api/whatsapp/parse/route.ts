import { NextRequest, NextResponse } from 'next/server'
import { parseRateResponse } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { response, items = [] } = body
    if (!response) return NextResponse.json({ error: 'Response required' }, { status: 400 })
    const parsed = parseRateResponse(response, items)
    return NextResponse.json({ success: true, parsed })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
