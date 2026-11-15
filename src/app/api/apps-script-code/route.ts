import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getAppPin } from '@/lib/runtime-config'

const AUTH_COOKIE = 'smartcomp_auth'
const SALT_V3 = '_smartcomp_v3_2026'
const SALT_V1 = '_smartcomp_v1'

async function sha256Hex(text: string): Promise<string> {
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

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const pin = getAppPin()
  if (!pin) return true // no PIN configured = open access
  const cookie = req.cookies.get(AUTH_COOKIE)?.value
  if (!cookie) return false
  const expectedV3 = await sha256Hex(pin + SALT_V3)
  const expectedV1 = await sha256Hex(pin + SALT_V1)
  return safeEqual(cookie, expectedV3) || safeEqual(cookie, expectedV1)
}

/**
 * GET /api/apps-script-code
 *
 * Returns the LATEST apps-script/code.gs content as plain text.
 * This lets users copy the latest code directly from their running app
 * (Settings → Sync tab → "Copy latest Apps Script code" button) without
 * having to navigate to GitHub.
 *
 * The file is read at request-time (not bundled at build) so it always
 * reflects the current deployed version.
 */
export async function GET(req: NextRequest) {
  try {
    const authed = await isAuthenticated(req)
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve the path relative to the project root.
    // In Next.js, process.cwd() is the project root (where package.json lives).
    const filePath = path.join(process.cwd(), 'apps-script', 'code.gs')
    const content = await readFile(filePath, 'utf8')

    const format = req.nextUrl.searchParams.get('format') || 'text'

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        version: '2.7',
        filename: 'code.gs',
        size: content.length,
        content,
      })
    }

    // Default: plain text (easy to copy)
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not read apps-script/code.gs from disk: ' + (e?.message || 'unknown error'),
        hint: 'Make sure the apps-script/code.gs file is included in your deployment. If you deployed via Render/Vercel from the GitHub repo, the file should be present. If you only deployed the build output, you need to also include the apps-script directory.',
      },
      { status: 500 }
    )
  }
}
