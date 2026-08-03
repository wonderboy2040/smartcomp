import { NextRequest, NextResponse } from 'next/server'
import { getAppPin } from '@/lib/runtime-config'

const SALT = '_smartcomp_v3_2026'
const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 1000

const attempts = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') || 'unknown'
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = attempts.get(ip)
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetAt: now + WINDOW_MS }
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }
  record.count++
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count, resetAt: record.resetAt }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const limit = checkRateLimit(ip)

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const { pin } = await req.json()
    const expectedPin = getAppPin()
    if (!expectedPin) {
      return NextResponse.json({ error: 'PIN not configured', code: 'PIN_NOT_SET' }, { status: 400 })
    }
    if (pin !== expectedPin) {
      return NextResponse.json(
        { error: 'Invalid PIN', code: 'INVALID_PIN' },
        { status: 401, headers: { 'X-RateLimit-Remaining': String(limit.remaining) } }
      )
    }
    const enc = new TextEncoder()
    const data = enc.encode(pin + SALT)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const token = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')

    const response = NextResponse.json({ success: true })
    response.cookies.set('smartcomp_auth', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7
    })
    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
