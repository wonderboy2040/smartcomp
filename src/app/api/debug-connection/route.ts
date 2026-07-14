import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, getSanitizedUrl } from '@/lib/sheets-client'

/**
 * POST /api/debug-connection
 *
 * Server-side diagnostic that calls APPS_SCRIPT_URL directly
 * and returns FULL response details for debugging Sheets sync issues.
 * FIXED: Now uses sanitized URL (strips quotes/spaces) and better HTML detection incl. Arabic "فشل"
 */

export async function POST(req: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured or invalid. Check env var.', configured: false }, { status: 503 })
    }

    const APPS_SCRIPT_URL = getSanitizedUrl()
    const body = await req.json().catch(() => ({}))
    const method = (body.method || 'GET').toUpperCase() as 'GET' | 'POST'
    const action = body.action || 'test'

    let url = APPS_SCRIPT_URL
    let fetchOptions: any = { method, redirect: 'follow', signal: AbortSignal.timeout(30000) }

    if (method === 'GET') {
      const u = new URL(APPS_SCRIPT_URL)
      u.searchParams.set('action', action)
      u.searchParams.set('t', String(Date.now()))
      u.searchParams.set('_debug', '1')
      url = u.toString()
    } else {
      fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'application/json' }
      fetchOptions.body = JSON.stringify({ action })
    }

    console.log('[debug-connection] Calling Apps Script sanitized URL, method:', method, 'action:', action)

    const res = await fetch(url, fetchOptions)
    const text = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => { headers[key] = value })

    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null
    const lower = text.toLowerCase()

    return NextResponse.json({
      success: res.ok && (lower.trimStart().startsWith('{') || lower.trimStart().startsWith('[')),
      status: res.status,
      statusText: res.statusText,
      contentType: headers['content-type'] || '',
      redirected: res.redirected,
      finalUrl: res.url,
      bodyLength: text.length,
      bodyPreview: text.slice(0, 3000),
      isHtml: lower.includes('<html') || lower.includes('<!doctype'),
      title,
      looksLikeLoginPage: lower.includes('sign in - google accounts') || lower.includes('accounts.google.com/servicelogin') || lower.includes('service login'),
      looksLikeErrorPage: (title && /error|فشل|काम|गलती|fehler|erreur|erro|fail/i.test(title)) || lower.includes('فشل') || lower.includes('<title>error</title>'),
      looksLikeEditorPage: lower.includes('<title>apps script</title>') || (lower.includes('script.google.com') && lower.includes('editor')),
      looksLikeJson: lower.trimStart().startsWith('{') || lower.trimStart().startsWith('['),
      sanitizedUrlUsed: APPS_SCRIPT_URL.slice(0, 60) + '.../exec',
      diagnosis: diagnose(title, lower, res.redirected, res.url, text),
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || 'Network error',
      name: e?.name,
      stack: e?.stack?.slice(0, 800),
    }, { status: 500 })
  }
}

function diagnose(title: string | null, lowerBody: string, redirected: boolean, finalUrl: string, raw: string): string {
  if (lowerBody.trimStart().startsWith('{') || lowerBody.trimStart().startsWith('[')) {
    try {
      const j = JSON.parse(raw)
      if (j.success) return `✅ Response is valid JSON and success=true — Apps Script is working! Version: ${j.version || 'unknown'}. If data still not syncing, check your sheet for rows.`
      return `Response is JSON but success=false: ${j.error || 'unknown error'}. Check Apps Script execution logs.`
    } catch {
      return 'Response starts like JSON but failed to parse. Check bodyPreview.'
    }
  }
  if (redirected && (finalUrl.includes('accounts.google.com') || finalUrl.includes('servicelogin'))) {
    return 'LOGIN REQUIRED: Google redirected to sign-in. FIX: Apps Script → Deploy → Manage deployments → Edit → Who has access: Anyone → Save → Redeploy.'
  }
  if (lowerBody.includes('sign in - google accounts') || lowerBody.includes('accounts.google.com/servicelogin') || lowerBody.includes('فشل') || (title && title.includes('فشل'))) {
    if (lowerBody.includes('فشل') || (title && title.includes('فشل'))) {
      return `APPS SCRIPT ERROR PAGE: Google showing "${title || 'فشل'}" error page. This means OLD code.gs is deployed or script has runtime error.\n\nFIX:\n1. Open Google Sheet → Extensions → Apps Script\n2. Replace entire code with latest apps-script/code.gs from repo (v2.4+)\n3. Deploy → Manage deployments → New version → Deploy\n4. Copy new /exec URL → Update APPS_SCRIPT_URL env → Redeploy site\n5. Then Test Connection again.`
    }
    return 'LOGIN REQUIRED: Google showing sign-in page. Redeploy Web App with "Anyone" access.'
  }
  if (lowerBody.includes('<title>apps script</title>') || (lowerBody.includes('script.google.com') && lowerBody.includes('editor'))) {
    return 'WRONG URL: You are using editor /edit URL, need /exec URL. Deploy → New deployment → Web app → copy /exec URL.'
  }
  if (title && /error|فشل|काम|गलती|fehler|erreur|fail/i.test(title)) {
    return `APPS SCRIPT ERROR PAGE titled "${title}". Open Apps Script → Executions log to see error. Usually missing SpreadsheetApp permission or old code. Paste latest code.gs and redeploy.`
  }
  if (lowerBody.includes('not found') || lowerBody.includes('404') || lowerBody.includes('deleted deployment')) {
    return 'DEPLOYMENT NOT FOUND: URL stale or deployment deleted. Create new deployment and copy new /exec URL.'
  }
  if (lowerBody.includes('<!doctype html') || lowerBody.includes('<html')) {
    return `HTML RESPONSE (title="${title || 'no title'}") instead of JSON. Causes: wrong /edit URL, restricted access (not Anyone), or script error. Check bodyPreview for details.`
  }
  return 'Unknown response. Check bodyPreview field for Google response.'
}
