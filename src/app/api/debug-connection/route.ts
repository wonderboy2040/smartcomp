import { NextRequest, NextResponse } from 'next/server'
import { isConfigured, getSanitizedUrl } from '@/lib/sheets-client'

function cleanTitle(raw: string | null): string {
  if (!raw) return 'SmartComputers'
  const khmerRegex = new RegExp('[\u1780-\u17FF]')
  const arabicRegex = new RegExp('[\u0600-\u06FF]')
  if (khmerRegex.test(raw) || arabicRegex.test(raw) || raw === 'កំហុស' || raw.includes('បញ្ហា') || raw.includes('فشل')) {
    return 'SmartComputers'
  }
  if (raw.length <= 10 && /[^\x00-\x7F]/.test(raw)) return 'SmartComputers'
  return raw
}

export async function POST(req: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured', configured: false }, { status: 503 })
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

    const res = await fetch(url, fetchOptions)
    const text = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => { headers[key] = value })

    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i)
    const rawTitle = titleMatch ? titleMatch[1].trim() : null
    const title = cleanTitle(rawTitle)

    const lower = text.toLowerCase()
    const isJson = lower.trimStart().startsWith('{') || lower.trimStart().startsWith('[')

    return NextResponse.json({
      success: res.ok && isJson,
      status: res.status,
      statusText: res.statusText,
      contentType: headers['content-type'] || '',
      redirected: res.redirected,
      finalUrl: res.url,
      bodyLength: text.length,
      bodyPreview: text.slice(0, 3000),
      isHtml: lower.includes('<html') || lower.includes('<!doctype'),
      rawTitle: rawTitle,
      title: title, // Now always SmartComputers if was foreign
      titleWasForeign: rawTitle !== title,
      looksLikeLoginPage: lower.includes('sign in - google accounts') || lower.includes('accounts.google.com/servicelogin'),
      looksLikeErrorPage: (rawTitle && /error|فشل|កំហុស|បញ្ហា|fail/i.test(rawTitle)) || lower.includes('فشل') || lower.includes('កំហុស'),
      looksLikeEditorPage: lower.includes('<title>apps script</title>') || (lower.includes('script.google.com') && lower.includes('editor')),
      looksLikeJson: isJson,
      sanitizedUrlUsed: APPS_SCRIPT_URL.slice(0, 60) + '.../exec',
      diagnosis: diagnose(rawTitle, title, lower, res.redirected, res.url, text),
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      title: 'SmartComputers - Error',
      error: e?.message || 'Network error',
      name: e?.name,
      stack: e?.stack?.slice(0, 800),
    }, { status: 500 })
  }
}

function diagnose(rawTitle: string | null, cleanedTitle: string, lowerBody: string, redirected: boolean, finalUrl: string, raw: string): string {
  if (lowerBody.trimStart().startsWith('{') || lowerBody.trimStart().startsWith('[')) {
    try {
      const j = JSON.parse(raw)
      if (j.success) return `✅ SmartComputers Connected! Response is valid JSON. Version: ${j.version || '2.9'}. Title is now "${cleanedTitle}" (was "${rawTitle}" replaced). Sync should work.`
      return `SmartComputers: JSON but success=false: ${j.error || 'unknown'}. Check Executions log.`
    } catch {
      return 'SmartComputers: Response looks like JSON but parse failed. Check bodyPreview.'
    }
  }
  if (lowerBody.includes('schemas') && lowerBody.includes('already been declared')) {
    return `🔴 SmartComputers - DUPLICATE FILE ERROR (Title "${rawTitle}" → replaced with "${cleanedTitle}")\n\nAapke Apps Script me 2 files hain: Code.gs + Copy of Code. FIX:\n1. Extensions → Apps Script → Left Files → Copy of Code → 3 dots → Delete\n2. Sirf Code.gs me naya v2.9 paste → Save\n3. Deploy → Manage deployments → New version → Deploy\n\nTitle "កំហុស" ka matlab Google ka error page hai - duplicate ki wajah se. Delete karne se title automatic "SmartComputers" ho jayega.`
  }
  if (rawTitle && (rawTitle.includes('កំហុស') || rawTitle.includes('បញ្ហា') || /[\u1780-\u17FF]/.test(rawTitle))) {
    return `SmartComputers - Title "${rawTitle}" was Khmer Error (កំហុស = Error). Replaced with "${cleanedTitle}".\n\nIska matlab Apps Script me SyntaxError hai (duplicate file ya old code).\n\nFIX:\n1. Delete "Copy of Code" file\n2. Paste new v2.9 code.gs\n3. Deploy New version\n\nAb title SmartComputers dikhega aur JSON aayega.`
  }
  if (redirected && (finalUrl.includes('accounts.google.com') || finalUrl.includes('servicelogin'))) {
    return 'SmartComputers - LOGIN REQUIRED: Deploy → Who has access = Anyone'
  }
  if (lowerBody.includes('sign in - google accounts') || lowerBody.includes('accounts.google.com/servicelogin')) {
    return 'SmartComputers - LOGIN REQUIRED: Redeploy with Anyone access.'
  }
  if (lowerBody.includes('<title>apps script</title>') || (lowerBody.includes('script.google.com') && lowerBody.includes('editor'))) {
    return 'SmartComputers - WRONG URL: /edit not /exec. Need /exec URL.'
  }
  if (lowerBody.includes('not found') || lowerBody.includes('404')) {
    return 'SmartComputers - DEPLOYMENT NOT FOUND: New deployment karo.'
  }
  if (lowerBody.includes('<!doctype html') || lowerBody.includes('<html')) {
    return `SmartComputers - HTML Response (title "${cleanedTitle}" was "${rawTitle}" replaced). Causes: duplicate file, wrong /edit URL, restricted access, old code. Check bodyPreview.`
  }
  return `SmartComputers - Unknown response. Title cleaned to "${cleanedTitle}". Check bodyPreview.`
}
