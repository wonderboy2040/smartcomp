import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE = 'smartcomp_auth'
const SALT = '_smartcomp_v3_2026' // v3.0 unified salt - MUST match proxy.ts
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function POST(req: NextRequest) {
  const pin = process.env.APP_PIN
  if (!pin) {
    return NextResponse.json({ error: 'APP_PIN is not configured on the server. Open access mode.' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const enteredPin = String(body?.pin || '').trim()
  if (!/^\d{4,8}$/.test(enteredPin)) {
    return NextResponse.json({ error: 'PIN must be 4-8 digits' }, { status: 400 })
  }

  if (!safeEqual(enteredPin, pin)) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  const token = await sha256(pin + SALT)
  const res = NextResponse.json({ success: true, version: '3.0' })
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
  return res
}
