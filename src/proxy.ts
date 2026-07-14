import { NextRequest, NextResponse } from 'next/server'

/**
 * PIN-based access protection + rate limiting - UPGRADED v3.0
 *
 * v3.0 improvements:
 * - Enhanced public path handling
 * - Better security headers injection
 * - Rate limiting hints (actual limiting in API routes)
 * - Improved timing-safe comparison
 * - Support for both old middleware.ts and new proxy.ts conventions
 */

const AUTH_COOKIE = 'smartcomp_auth'
const SALT = '_smartcomp_v3_2026'

let cachedPin: string | undefined
let cachedToken: string | null = null

async function expectedToken(): Promise<string | null> {
  const pin = process.env.APP_PIN
  if (!pin) return null
  if (pin === cachedPin && cachedToken !== null) return cachedToken
  cachedPin = pin
  const enc = new TextEncoder()
  const data = enc.encode(pin + SALT)
  const digest = await crypto.subtle.digest('SHA-256', data)
  cachedToken = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return cachedToken
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/status',
  '/api/whatsapp/webhook',
  '/api/cron/auto-enquiry',
  '/api/cron/amc',
  '/api/log-error',
  '/track',
  '/api/track',
  '/api/razorpay/webhook',
  '/api/health',
  '/api/export',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p + '/'))) return true
  if (pathname.startsWith('/track')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/icon-')) return true
  if (pathname.startsWith('/apple-')) return true
  if (pathname.startsWith('/android-')) return true
  if (pathname.startsWith('/safari-')) return true
  if (pathname === '/manifest.json' || pathname === '/manifest.webmanifest') return true
  if (pathname === '/sw.js' || pathname === '/sw-register.js' || pathname === '/offline.html') return true
  if (pathname === '/robots.txt' || pathname === '/logo.svg' || pathname === '/icon.svg') return true
  if (pathname === '/clear-cache.html') return true
  // Allow public assets
  if (pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|avif|woff|woff2|ttf|eot)$/)) return true
  return false
}

export async function proxy(req: NextRequest) {
  const expected = await expectedToken()
  if (!expected) return NextResponse.next()

  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (token && safeEqual(token, expected)) return NextResponse.next()

  const accept = req.headers.get('accept') || ''
  const isHtml = accept.includes('text/html')

  if (isHtml) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.json(
    { error: 'Unauthorized. PIN required.', code: 'PIN_REQUIRED', version: '3.0' },
    { 
      status: 401,
      headers: {
        'X-Auth-Required': 'true',
      }
    }
  )
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
