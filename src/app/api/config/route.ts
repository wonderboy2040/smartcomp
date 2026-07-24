import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, testConnection } from '@/lib/sheets-client'
import { getAppsScriptUrl, getAppPin, clearRuntimeConfigCache } from '@/lib/runtime-config'

// GET /api/config - check if app is configured (for setup wizard)
export async function GET() {
  const url = getAppsScriptUrl()
  return NextResponse.json({
    configured: isConfigured(),
    pinRequired: !!getAppPin(),
    urlPreview: url ? maskUrl(url) : null,
    // Only expose whether the URL ends with /exec — never the full URL itself
    endsWithExec: !!url && url.includes('/exec'),
    // Whether the desktop runtime config file is being used (vs env var)
    runtimeConfigActive: !!process.env.SMARTCOMP_CONFIG_PATH,
  })
}

function maskUrl(url: string): string {
  if (!url) return '(empty)'
  if (url.length <= 70) return url
  return url.slice(0, 40) + '...' + url.slice(-30)
}

// POST /api/config - test connection OR save runtime config (desktop mode)
export async function POST(req: NextRequest) {
  // Detect desktop runtime-config mode
  const configPath = process.env.SMARTCOMP_CONFIG_PATH
  let body: any = null
  try {
    body = await req.json().catch(() => null)
  } catch {}

  // If the desktop app is sending a save request, persist to the runtime config file
  if (configPath && body && (body.appsScriptUrl !== undefined || body.appPin !== undefined)) {
    try {
      const fs = require('fs')
      const path = require('path')
      const dir = path.dirname(configPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      // Merge with existing config
      const existing: any = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        : {}

      if (typeof body.appsScriptUrl === 'string') {
        existing.appsScriptUrl = body.appsScriptUrl.trim() || undefined
      }
      if (typeof body.appPin === 'string') {
        existing.appPin = body.appPin.trim() || undefined
      }

      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8')
      clearRuntimeConfigCache()

      return NextResponse.json({
        success: true,
        message: 'Settings saved. All devices using this Google Sheet will see the changes immediately.',
        configured: !!existing.appsScriptUrl && existing.appsScriptUrl.includes('/exec'),
      })
    } catch (e: any) {
      return NextResponse.json({ success: false, message: e?.message || 'Failed to save config' }, { status: 500 })
    }
  }

  // Default: test connection
  const result = await testConnection()
  return NextResponse.json(result)
}
