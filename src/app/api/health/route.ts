import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, getCacheStats, testConnection } from '@/lib/sheets-client'
import { getAppsScriptUrl, getAppPin } from '@/lib/runtime-config'

/**
 * GET /api/health[?live=1]
 *
 * Two modes:
 *   - Default (no `?live=1`): "liveness" probe — returns immediately with
 *     `status: 'ok'` and cached config flags. This is what Render's health
 *     check should hit so it doesn't restart on slow Apps Script responses.
 *   - `?live=1`: "readiness" probe — does a live ping to the Apps Script
 *     backend and includes reachability + version in the response.
 *
 * This endpoint is intentionally PUBLIC (in proxy.ts PUBLIC_PATHS) so it can
 * be hit even before login — useful for diagnosing deployment issues.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const liveProbe = url.searchParams.get('live') === '1'

    const appsScriptUrl = getAppsScriptUrl()
    const pin = getAppPin()
    const configured = isConfigured()

    // Always include the basic "alive" signal so the liveness probe never
    // hangs even if the Apps Script backend is slow/down.
    if (!liveProbe) {
      return NextResponse.json({
        status: 'ok',
        version: '10.0.0-ultra',
        codename: 'SmartComp Ultra',
        timestamp: new Date().toISOString(),
        uptime: typeof process.uptime === 'function' ? process.uptime() : 0,
        configured,
        pinRequired: !!pin,
        appsScriptUrlSet: !!appsScriptUrl,
        appsScriptUrlEndsWithExec: !!appsScriptUrl && appsScriptUrl.includes('/exec'),
        cache: getCacheStats(),
        env: {
          nodeVersion: process.version,
          platform: process.platform,
          runtimeConfigActive: !!process.env.SMARTCOMP_CONFIG_PATH,
        },
        hint: 'Add ?live=1 for a live Apps Script reachability check.',
      })
    }

    // Live probe — ping the Apps Script backend.
    let appsScriptReachable: boolean | null = null
    let appsScriptError: string | null = null
    let appsScriptVersion: string | null = null
    let appsScriptAuthMismatch: boolean = false
    if (configured) {
      try {
        const result = await testConnection()
        appsScriptReachable = result.success
        if (!result.success) {
          appsScriptError = result.message
          if (result.message && result.message.includes('Apps Script has its OWN auth')) {
            appsScriptAuthMismatch = true
          }
        }
      } catch (e: any) {
        appsScriptReachable = false
        appsScriptError = e?.message || 'Unknown error'
        if (e?.message && e.message.includes('Apps Script has its OWN auth')) {
          appsScriptAuthMismatch = true
        }
      }
    }

    return NextResponse.json({
      status: 'ok',
      version: '10.0.0-ultra',
      codename: 'SmartComp Ultra',
      timestamp: new Date().toISOString(),
      uptime: typeof process.uptime === 'function' ? process.uptime() : 0,
      configured,
      pinRequired: !!pin,
      appsScriptUrlSet: !!appsScriptUrl,
      appsScriptUrlEndsWithExec: !!appsScriptUrl && appsScriptUrl.includes('/exec'),
      appsScriptReachable,
      appsScriptError,
      appsScriptVersion,
      appsScriptAuthMismatch,
      cache: getCacheStats(),
      env: {
        nodeVersion: process.version,
        platform: process.platform,
        runtimeConfigActive: !!process.env.SMARTCOMP_CONFIG_PATH,
      },
      hints: generateHints({ configured, pinRequired: !!pin, appsScriptReachable, appsScriptAuthMismatch, url: appsScriptUrl }),
    })
  } catch (e: any) {
    return NextResponse.json({
      status: 'error',
      error: e?.message,
      version: '10.0.0-ultra',
    }, { status: 500 })
  }
}

function generateHints(opts: {
  configured: boolean
  pinRequired: boolean
  appsScriptReachable: boolean | null
  appsScriptAuthMismatch: boolean
  url: string | undefined
}): string[] {
  const hints: string[] = []
  if (!opts.configured) {
    hints.push('APPS_SCRIPT_URL is not set. Set it as an env var on Render (or via the in-app Setup Wizard if running desktop mode), then redeploy.')
  } else if (!opts.url?.includes('/exec')) {
    hints.push('APPS_SCRIPT_URL is set but does not end with /exec. Make sure you deployed the Apps Script as a Web App and copied the /exec URL, not the /edit (editor) URL.')
  }
  if (opts.appsScriptAuthMismatch) {
    hints.push('🔴 CRITICAL: The deployed Apps Script is an OLDER or CUSTOM version that has its own auth check returning "unauthorized". You MUST redeploy the Apps Script with the latest code. Steps: (1) Open your Apps Script project at script.google.com (2) Delete ALL existing code (3) Open https://smartcomp-8m81.onrender.com/api/apps-script-code in a browser, copy the full code (4) Paste it into the Apps Script editor (5) Deploy → New deployment → Web app → "Anyone" access (6) Copy the new /exec URL (7) Update APPS_SCRIPT_URL env var on Render if URL changed (8) Redeploy on Render')
  } else if (opts.configured && opts.appsScriptReachable === false) {
    hints.push('Apps Script URL is configured but the backend is not reachable. Open the URL in a browser to check for authorization errors, or redeploy the Apps Script with "Anyone" access.')
  }
  if (opts.pinRequired && opts.appsScriptReachable && !opts.appsScriptAuthMismatch) {
    hints.push('PIN protection is ON. Make sure you have logged in via /login — every /api/* request (except public ones) requires the smartcomp_auth cookie.')
  }
  if (hints.length === 0) {
    hints.push('All checks passed. If data still does not load, check the browser Network tab for 401/404/500 responses on /api/* requests.')
  }
  return hints
}
