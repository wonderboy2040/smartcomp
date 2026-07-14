/**
 * Server-side client for Google Apps Script backend - FIXED v2.9 SmartComputers branding
 * - Title "កំហុស" (Khmer Error) replaced with "SmartComputers"
 * - Duplicate file error ("Copy of Code" -> SCHEMAS already declared) now auto-detected with Hindi fix
 * - APPS_SCRIPT_URL sanitized (quotes trimmed, spaces removed)
 * - Timeout 30s, retry 500/502/503/504
 */

function getRawEnvUrl(): string {
  return process.env.APPS_SCRIPT_URL || ''
}
export function getSanitizedUrl(): string {
  let url = getRawEnvUrl().trim()
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'")) || (url.startsWith('`') && url.endsWith('`'))) {
    url = url.slice(1, -1).trim()
  }
  url = url.replace(/\s+/g, '')
  return url
}
function getAppsScriptUrlOrThrow(): string {
  const url = getSanitizedUrl()
  if (!url) throw new Error('APPS_SCRIPT_URL not configured')
  return url
}

const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 30 * 1000
function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) return entry.data as T
  if (entry) cache.delete(key)
  return null
}
function setCached(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}
function invalidateCache() { cache.clear() }

export function isConfigured(): boolean {
  const url = getSanitizedUrl()
  return !!url && url.length > 10 && url.includes('script.google.com')
}
export function getConfigError(): string | null {
  if (!isConfigured()) {
    const raw = getRawEnvUrl()
    if (!raw || !raw.trim()) return 'APPS_SCRIPT_URL environment variable is not set. Please set it in your deployment.'
    const sanitized = getSanitizedUrl()
    if (!sanitized.includes('script.google.com')) return `APPS_SCRIPT_URL invalid: "${maskUrl(raw)}". Should start with https://script.google.com/macros/s/.../exec`
    return 'APPS_SCRIPT_URL appears invalid. Check Settings → Sync.'
  }
  return null
}
function maskUrl(url: string): string {
  if (!url) return '(empty)'
  const s = url.trim()
  if (s.length <= 80) return s
  return s.slice(0, 45) + '...' + s.slice(-25)
}

// Clean foreign titles like Khmer កំហុស to SmartComputers
function cleanTitleForDisplay(rawTitle: string): string {
  if (!rawTitle) return 'SmartComputers'
  // Khmer Unicode range 1780-17FF and Arabic 0600-06FF
  const khmerRegex = new RegExp('[\u1780-\u17FF]')
  const arabicRegex = new RegExp('[\u0600-\u06FF]')
  const hasKhmer = khmerRegex.test(rawTitle)
  const hasArabic = arabicRegex.test(rawTitle)
  const isForeign = hasKhmer || hasArabic || rawTitle === 'កំហុស' || rawTitle.includes('បញ្ហា') || rawTitle.includes('فشل')
  if (isForeign) return 'SmartComputers'
  if (rawTitle.length <= 10) {
    const nonAscii = /[^\x00-\x7F]/.test(rawTitle)
    if (nonAscii) return 'SmartComputers'
  }
  return rawTitle
}

function diagnoseHtmlResponse(text: string): string | null {
  if (!text || text.length < 15) return null
  const lower = text.toLowerCase()
  const snippet = text.slice(0, 500).replace(/\s+/g, ' ').trim()
  const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i)
  const rawTitle = titleMatch ? titleMatch[1].trim() : ''
  const title = cleanTitleForDisplay(rawTitle)
  const khmerRegex = new RegExp('[\u1780-\u17FF]')

  const isKhmerTitle = rawTitle.includes('កំហុស') || rawTitle.includes('បញ្ហា') || khmerRegex.test(rawTitle)
  const isArabicTitle = rawTitle.includes('فشل') || lower.includes('فشل')

  if (isKhmerTitle || isArabicTitle) {
    if (lower.includes('schemas') && lower.includes('already been declared')) {
      return `SmartComputers - Duplicate File Error!\n\nAapke Apps Script me 2 files hain (Code.gs + Copy of Code). Dono me SCHEMAS hai → SyntaxError.\n\nFIX 30 sec:\n1. Sheet → Extensions → Apps Script\n2. Left Files me "Copy of Code" → 3 dots → Delete\n3. Sirf Code.gs rakho → naya v2.9 code paste → Save\n4. Deploy → Manage deployments → New version → Deploy\n5. Ab SmartComputers Connected ✅\n\nTitle "${rawTitle}" ko SmartComputers se replace kar diya.`
    }
    return `SmartComputers - Apps Script Error (foreign title "${rawTitle}" replaced with SmartComputers)\n\nFIX:\n1. Sheet → Extensions → Apps Script → Delete duplicate "Copy of Code" if exists\n2. Paste new v2.9 code.gs → Save → Deploy New version\n3. Test Connection\n\nPreview: ${snippet}`
  }

  if (lower.includes('sign in - google accounts') || lower.includes('accounts.google.com/servicelogin') || lower.includes('service login')) {
    return `SmartComputers - Google Login Required\n\nWeb App access restricted. Fix: Apps Script → Deploy → Manage deployments → Who has access = Anyone → Save → Redeploy.\n\nPreview: ${snippet}`
  }
  if (lower.includes('not found') && lower.includes('script')) {
    return `SmartComputers - Deployment Not Found (404)\n\nFix: Apps Script → New deployment → Web app → Anyone → copy new /exec URL → update env var.\n\nPreview: ${snippet}`
  }
  if (lower.includes('<title>apps script</title>') || (lower.includes('script.google.com') && lower.includes('editor'))) {
    return `SmartComputers - Wrong URL (Editor /edit not /exec)\n\nFix: Deploy → Web app → copy /exec URL: https://script.google.com/macros/s/.../exec\n\nPreview: ${snippet}`
  }
  if (lower.includes('authorize') || lower.includes('would like to') || lower.includes('authorization required')) {
    return `SmartComputers - Authorization Needed\n\nOpen APPS_SCRIPT_URL in browser → Allow → Test again.\n\nPreview: ${snippet}`
  }
  if (lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('<head')) {
    const t = title
    return `SmartComputers - HTML Response (title: "${t}") instead of JSON\n\nCauses:\n1. Wrong /edit URL (need /exec)\n2. Access not Anyone\n3. Script error → check Executions log\n4. Duplicate file Copy of Code → delete it\n5. Old code → paste v2.9 and redeploy\n\nPreview: ${snippet}`
  }
  return null
}

async function callAppsScript(payload: any): Promise<any> {
  const appsScriptUrl = getAppsScriptUrlOrThrow()
  let lastErr: any
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: AbortSignal.timeout(30000) as any,
      })
      if (res.status === 404 || res.status === 410) throw new Error(`SmartComputers: Apps Script HTTP ${res.status} - Deployment deleted or URL stale. Redeploy as New version.`)
      if (res.status >= 500 && res.status <= 599) throw new Error(`SmartComputers: Apps Script HTTP ${res.status} temporary error attempt ${attempt}/3`)
      if (!res.ok) throw new Error(`SmartComputers: Apps Script HTTP ${res.status}: ${res.statusText}`)
      const text = await res.text()
      if (!text || !text.trim()) throw new Error('SmartComputers: Empty response from Apps Script. Check Executions log.')
      try { return JSON.parse(text) } catch {
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('SmartComputers: Invalid JSON (first 300 chars): ' + text.slice(0, 300))
      }
    } catch (e: any) {
      lastErr = e
      const msg = e?.message || ''
      const name = e?.name || ''
      const isRetryable = (msg.includes('404') || msg.includes('410') || msg.includes('HTTP 5') || msg.includes('timeout') || msg.includes('aborted') || name === 'TimeoutError' || name === 'AbortError') && !msg.includes('SmartComputers - Duplicate') && !msg.includes('LOGIN')
      if (!isRetryable || attempt === 3) throw e
      await new Promise((r) => setTimeout(r, 1200 * attempt))
    }
  }
  throw lastErr || new Error('Apps Script POST failed')
}

async function getFromAppsScript(params: Record<string, string>): Promise<any> {
  const appsScriptUrl = getAppsScriptUrlOrThrow()
  const url = new URL(appsScriptUrl)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('_t', String(Date.now()))
  let lastErr: any
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow', headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(30000) as any })
      if (res.status === 404 || res.status === 410) throw new Error(`SmartComputers: Apps Script HTTP ${res.status} needs redeployment.`)
      if (res.status >= 500 && res.status <= 599) throw new Error(`SmartComputers: HTTP ${res.status} temp error.`)
      if (!res.ok) throw new Error(`SmartComputers: HTTP ${res.status}: ${res.statusText}`)
      const text = await res.text()
      if (!text || !text.trim()) throw new Error('SmartComputers: Empty GET response')
      try { return JSON.parse(text) } catch {
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('SmartComputers: Invalid JSON: ' + text.slice(0, 300))
      }
    } catch (e: any) {
      lastErr = e
      const msg = e?.message || ''
      const name = e?.name || ''
      const isRetryable = (msg.includes('404') || msg.includes('410') || msg.includes('HTTP 5') || msg.includes('timeout') || msg.includes('aborted') || name === 'TimeoutError' || name === 'AbortError') && !msg.includes('SmartComputers - Duplicate')
      if (!isRetryable || attempt === 3) throw e
      await new Promise((r) => setTimeout(r, 1200 * attempt))
    }
  }
  throw lastErr || new Error('GET failed')
}

export async function listRows<T = any>(sheet: string, options: { filter?: string; search?: string; useCache?: boolean; includeDeleted?: boolean } = {}): Promise<T[]> {
  if (!isConfigured()) return [] as T[]
  const useCache = options.useCache !== false
  const cacheKey = `list:${sheet}:${options.filter || ''}:${options.search || ''}:${options.includeDeleted ? '1' : '0'}`
  if (useCache) { const cached = getCached<T[]>(cacheKey); if (cached) return cached }
  const params: Record<string, string> = { action: 'list', sheet }
  if (options.filter) params.filter = options.filter
  if (options.search) params.search = options.search
  if (options.includeDeleted) params.includeDeleted = 'true'
  const res = await getFromAppsScript(params)
  if (!res.success) throw new Error(res.error || `Failed to list ${sheet}`)
  if (useCache) setCached(cacheKey, res.data)
  return res.data as T[]
}
export async function getRow<T = any>(sheet: string, id: string): Promise<T | null> {
  if (!isConfigured()) return null
  const res = await getFromAppsScript({ action: 'get', sheet, id })
  if (!res.success) return null
  return res.data as T
}
export async function createRow<T = any>(sheet: string, data: any): Promise<T> {
  const res = await callAppsScript({ action: 'create', sheet, data })
  if (!res.success) throw new Error(res.error || 'Failed to create')
  invalidateCache()
  return res.data as T
}
export async function updateRow<T = any>(sheet: string, id: string, data: any): Promise<T> {
  const res = await callAppsScript({ action: 'update', sheet, id, data })
  if (!res.success) throw new Error(res.error || 'Failed to update')
  invalidateCache()
  return res.data as T
}
export async function deleteRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'delete', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to delete')
  invalidateCache()
  return true
}
export async function restoreRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'restore', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to restore')
  invalidateCache()
  return true
}
export async function bulkCreate(sheet: string, data: any[]): Promise<number> {
  const res = await callAppsScript({ action: 'bulkCreate', sheet, data })
  if (!res.success) throw new Error(res.error || 'Failed to bulk create')
  invalidateCache()
  return res.count
}
export async function replaceAll(_sheet: string, _data: any[]): Promise<number> {
  throw new Error('replaceAll() disabled for data protection. Use createRow or updateRow.')
}
export async function bulkUpdate(sheet: string, updates: { id: string; data: any }[]): Promise<number> {
  if (updates.length === 0) return 0
  const res = await callAppsScript({ action: 'bulkUpdate', sheet, updates })
  if (!res.success) throw new Error(res.error || 'Failed to bulk update')
  invalidateCache()
  return res.count
}
export async function getShop(): Promise<any | null> {
  if (!isConfigured()) return null
  const cacheKey = 'shop:single'
  const cached = getCached<any>(cacheKey)
  if (cached !== null) return cached
  const res = await getFromAppsScript({ action: 'shop' })
  if (!res.success) return null
  setCached(cacheKey, res.data)
  return res.data
}
export async function saveShop(data: any): Promise<any> {
  const res = await callAppsScript({ action: 'saveShop', data })
  if (!res.success) throw new Error(res.error || 'Failed to save shop')
  invalidateCache()
  return res.data
}
export async function getDashboardStats(): Promise<any> {
  const cacheKey = 'dashboard:stats'
  const cached = getCached<any>(cacheKey)
  if (cached) return cached
  const res = await getFromAppsScript({ action: 'dashboard' })
  if (!res.success) throw new Error(res.error || 'Failed to get dashboard')
  setCached(cacheKey, res.data)
  return res.data
}
export async function testConnection(): Promise<{ success: boolean; message: string; urlPreview?: string }> {
  try {
    const raw = getRawEnvUrl()
    const urlStr = getSanitizedUrl()
    const urlPreview = raw ? maskUrl(raw) + (raw !== urlStr ? ` → ${maskUrl(urlStr)}` : '') : undefined
    if (!raw || !raw.trim()) return { success: false, message: 'APPS_SCRIPT_URL not set. Fix: Render → Environment → add https://script.google.com/macros/s/.../exec', urlPreview }
    if (!urlStr) return { success: false, message: 'APPS_SCRIPT_URL empty after sanitizing. Check quotes/spaces.', urlPreview }
    if (urlStr.includes('/macros/d/') && urlStr.includes('/edit')) return { success: false, message: 'EDITOR URL (/edit) not /exec. Fix: Deploy → Manage deployments → copy /exec URL.', urlPreview }
    if (!urlStr.includes('/exec')) return { success: false, message: `Should end with /exec. Current: ${maskUrl(urlStr)}`, urlPreview }
    if (!urlStr.startsWith('https://script.google.com/macros/s/')) return { success: false, message: `Format wrong, should start with https://script.google.com/macros/s/ Current: ${maskUrl(urlStr)}`, urlPreview }
    const res = await callAppsScript({ action: 'test' })
    if (res.success) return { success: true, message: `SmartComputers Connected! Google Sheets sync OK! Version: ${res.version || '2.9'}`, urlPreview }
    return { success: false, message: res.error || 'Connection failed', urlPreview }
  } catch (e: any) {
    const raw = getRawEnvUrl()
    return { success: false, message: e?.message || 'Connection failed', urlPreview: raw ? maskUrl(raw) : undefined }
  }
}
export function getConfiguredUrlPreview(): { configured: boolean; urlPreview: string | null; endsWithExec: boolean; sanitizedPreview?: string } {
  const raw = getRawEnvUrl()
  if (!raw || !raw.trim()) return { configured: false, urlPreview: null, endsWithExec: false }
  const sanitized = getSanitizedUrl()
  return { configured: isConfigured(), urlPreview: maskUrl(raw), sanitizedPreview: raw !== sanitized ? maskUrl(sanitized) : undefined, endsWithExec: sanitized.includes('/exec') && sanitized.endsWith('/exec') }
}
export async function seedData(): Promise<any> {
  const res = await callAppsScript({ action: 'seed' })
  if (!res.success) throw new Error(res.error || 'Failed to seed')
  invalidateCache()
  return res.results
}
export function getAppsScriptUrlForDebug(): string | null {
  try { return getSanitizedUrl() || null } catch { return null }
}
