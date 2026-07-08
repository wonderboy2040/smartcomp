import { NextRequest, NextResponse } from 'next/server'

/**
 * PIN-based access protection middleware (Edge Runtime compatible).
 *
 * Behavior:
 *   - If APP_PIN env var is NOT set  -> app is open (backward compatible).
 *   - If APP_PIN is set (any length, typically 4 digits):
 *       * Requests without a valid smartcomp_auth cookie are redirected to /login
 *         (HTML pages) or return 401 (API/asset requests that aren't auth-related).
 *       * /login, /api/auth/*, /manifest.json, /sw.js, icons, and Next static
 *         assets are always allowed through.
 *
 * The cookie value is a SHA-256 hex digest of (APP_PIN + salt), computed via
 * the Web Crypto API (Edge Runtime compatible). The PIN itself is never stored
 * in the cookie.
 */

const AUTH_COOKIE = 'smartcomp_auth'
const SALT = '_smartcomp_v1'

// Cache the expected token per-edge-instance so we don't re-hash on every request.
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

// Paths that are always public (even when PIN is enabled)
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/status',
  // WhatsApp Cloud API webhook — Meta calls this server-to-server, has no PIN cookie.
  // Secured by WA_VERIFY_TOKEN + HMAC signature instead.
  '/api/whatsapp/webhook',
  // Cron endpoint — secured by CRON_SECRET header, not PIN cookie.
  '/api/cron/auto-enquiry',
  // Error logger POST — must work even before login so we can debug crash-on-load.
  // (GET is PIN-protected to prevent stack trace leaks)
  '/api/log-error',
  // Public job tracking page + API — customers access without PIN.
  // Secured by unguessable trackToken in the URL.
  '/track',
  '/api/track',
  // Razorpay webhook — Razorpay calls this server-to-server.
  // Secured by RAZORPAY_WEBHOOK_SECRET signature verification.
  '/api/razorpay/webhook',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  // Public tracking page (e.g., /track/SC20260708001-abc12345)
  if (pathname.startsWith('/track')) return true
  // Next.js internals + static assets
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
  return false
}

export async function middleware(req: NextRequest) {
  const expected = await expectedToken()
  // No PIN configured -> open access
  if (!expected) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Public paths bypass auth
  if (isPublic(pathname)) return NextResponse.next()

  // Check auth cookie
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (token && safeEqual(token, expected)) return NextResponse.next()

  // Not authenticated
  const accept = req.headers.get('accept') || ''
  const isHtml = accept.includes('text/html')

  if (isHtml) {
    // Redirect browser to login, remember where to come back
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // API / non-HTML -> 401
  return NextResponse.json(
    { error: 'Unauthorized. PIN required.', code: 'PIN_REQUIRED' },
    { status: 401 }
  )
}

export const config = {
  // Run on everything except Next internals are already allowed above;
  // we still match all so we can gate API routes too.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
