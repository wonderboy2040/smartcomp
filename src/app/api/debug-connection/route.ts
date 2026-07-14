import { NextRequest, NextResponse } from 'next/server'
import { isConfigured } from '@/lib/sheets-client'

/**
 * POST /api/debug-connection
 *
 * Server-side diagnostic that calls the configured APPS_SCRIPT_URL directly
 * and returns the FULL response (status, headers, body) so the user can see
 * exactly what Google is returning. This is for debugging only — the URL
 * itself is never exposed to the client.
 *
 * Body: { method?: 'GET' | 'POST', action?: string }
 */
export async function POST(req: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 503 })
    }

    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL!
    const body = await req.json().catch(() => ({}))
    const method = (body.method || 'GET').toUpperCase() as 'GET' | 'POST'
    const action = body.action || 'test'

    // Build URL with query params for GET, or body for POST
    let url = APPS_SCRIPT_URL
    let fetchOptions: any = { method, redirect: 'follow', signal: AbortSignal.timeout(30000) }

    if (method === 'GET') {
      const u = new URL(APPS_SCRIPT_URL)
      u.searchParams.set('action', action)
      u.searchParams.set('t', String(Date.now()))
      url = u.toString()
    } else {
      fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' }
      fetchOptions.body = JSON.stringify({ action })
    }

    console.log('[debug-connection] Calling Apps Script:', method, 'action:', action)

    const res = await fetch(url, fetchOptions)
    const text = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => { headers[key] = value })

    // Extract <title> tag content if present
    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null

    const lower = text.toLowerCase()
    return NextResponse.json({
      success: res.ok,
      status: res.status,
      statusText: res.statusText,
      contentType: headers['content-type'] || '',
      redirected: res.redirected,
      finalUrl: res.url, // final URL after redirects (helps detect login redirects)
      bodyLength: text.length,
      bodyPreview: text.slice(0, 2000), // first 2000 chars — enough to see the full error
      isHtml: lower.includes('<html') || lower.includes('<!doctype'),
      title,
      looksLikeLoginPage:
        lower.includes('sign in - google accounts') ||
        lower.includes('accounts.google.com/servicelogin') ||
        lower.includes('service login'),
      looksLikeErrorPage:
        lower.includes('<title>error</title>') ||
        /<title>[^<]*(error|កំហុស|错误|錯誤|ত্রুটি|गलती|erreur|fehler|erra|erro)[^<]*<\/title>/i.test(text),
      looksLikeEditorPage:
        lower.includes('<title>apps script</title>') ||
        (lower.includes('script.google.com') && lower.includes('editor')),
      looksLikeJson: lower.trimStart().startsWith('{') || lower.trimStart().startsWith('['),
      diagnosis: diagnose(title, lower, res.redirected, res.url),
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || 'Network error',
      name: e?.name,
      stack: e?.stack?.slice(0, 500),
    }, { status: 500 })
  }
}

function diagnose(title: string | null, lowerBody: string, redirected: boolean, finalUrl: string): string {
  if (lowerBody.trimStart().startsWith('{') || lowerBody.trimStart().startsWith('[')) {
    return 'Response is JSON — Apps Script is working correctly. The issue may be elsewhere.'
  }
  if (redirected && (finalUrl.includes('accounts.google.com') || finalUrl.includes('servicelogin'))) {
    return 'LOGIN REQUIRED: Google redirected to a sign-in page. Open the Apps Script URL directly in your browser, sign in with your Google account, then redeploy with "Who has access: Anyone".'
  }
  if (lowerBody.includes('sign in - google accounts') || lowerBody.includes('accounts.google.com/servicelogin')) {
    return 'LOGIN REQUIRED: Google is showing a sign-in page. Open the Apps Script URL directly in your browser, sign in, then redeploy with "Who has access: Anyone".'
  }
  if (lowerBody.includes('<title>apps script</title>') || (lowerBody.includes('script.google.com') && lowerBody.includes('editor'))) {
    return 'WRONG URL: This is the Apps Script editor page. You copied the /edit URL. Use Deploy → New deployment → Web app → copy the /exec URL instead.'
  }
  // Error page detection (multilingual)
  if (title && /error|កំហុស|错误|錯誤|ত্রুটি|गलती|erreur|fehler|erro/i.test(title)) {
    return `APPS SCRIPT ERROR: Google is showing an error page titled "${title}". This usually means the script has a runtime error. Open the Apps Script editor → Run → "doGet" or "doPost" function → check the execution log for the error. Common causes: (1) syntax error in code.gs, (2) the sheet name doesn\'t exist, (3) missing permissions for SpreadsheetApp.`
  }
  if (lowerBody.includes('not found') || lowerBody.includes('404')) {
    return 'DEPLOYMENT NOT FOUND: The Apps Script deployment was deleted or the URL is stale. Create a new deployment: Deploy → New deployment → Web app → copy new /exec URL.'
  }
  if (lowerBody.includes('<!doctype html') || lowerBody.includes('<html')) {
    return 'UNKNOWN HTML RESPONSE: Apps Script returned an HTML page. Check the bodyPreview field to see what Google returned, and the title field for the page title.'
  }
  return 'Unknown response type. Check bodyPreview.'
}
