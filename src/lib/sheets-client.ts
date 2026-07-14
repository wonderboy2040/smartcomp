/**
 * Server-side client for Google Apps Script backend (PROTECTED EDITION) - FIXED v2.4
 *
 * FIXES in this version:
 * - APPS_SCRIPT_URL is now sanitized (trims spaces + removes surrounding quotes that users often copy from .env.example)
 * - isConfigured() uses sanitized URL, prevents empty-string / whitespace-only misconfig
 * - getAppsScriptUrl() helper centralizes URL access - all functions use it
 * - Timeout increased to 30s (Apps Script cold start can be 10-15s)
 * - Retry logic now also retries 500/502/503/504 (Google intermittent errors)
 * - diagnoseHtmlResponse expanded to catch Arabic "فشل" / Hindi error pages and Cloudflare-like wrappers
 * - maskUrl handles short URLs
 * - testConnection & getConfiguredUrlPreview use sanitized URL consistently
 *
 * DATA PROTECTION:
 *   - deleteRow() performs SOFT-DELETE (deleted=true)
 *   - replaceAll() permanently BLOCKED
 */

function getRawEnvUrl(): string {
  return process.env.APPS_SCRIPT_URL || ''
}

/**
 * Sanitize user-provided URL:
 * - trim whitespace
 * - remove surrounding single or double quotes (common mistake when copying from .env.example)
 * - remove surrounding backticks
 * - collapse internal whitespace newline
 */
export function getSanitizedUrl(): string {
  let url = getRawEnvUrl().trim()
  // Remove surrounding quotes if present: "https://..." or 'https://...' or `https://...`
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'")) || (url.startsWith('`') && url.endsWith('`'))) {
    url = url.slice(1, -1).trim()
  }
  // Remove any trailing / at end? No, keep /exec needed
  // Remove any whitespace/newline characters inside (should not be there)
  url = url.replace(/\s+/g, '')
  return url
}

function getAppsScriptUrlOrThrow(): string {
  const url = getSanitizedUrl()
  if (!url) throw new Error('APPS_SCRIPT_URL not configured')
  return url
}

const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 30 * 1000 // 30s

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) return entry.data as T
  if (entry) cache.delete(key)
  return null
}
function setCached(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}
function invalidateCache() {
  cache.clear()
}

export function isConfigured(): boolean {
  const url = getSanitizedUrl()
  return !!url && url.length > 10 && url.includes('script.google.com')
}

export function getConfigError(): string | null {
  if (!isConfigured()) {
    const raw = getRawEnvUrl()
    if (!raw || !raw.trim()) return 'APPS_SCRIPT_URL environment variable is not set. Please set it in your deployment (Render/Vercel) environment variables.'
    const sanitized = getSanitizedUrl()
    if (!sanitized.includes('script.google.com')) {
      return `APPS_SCRIPT_URL looks invalid: "${maskUrl(raw)}". It should start with https://script.google.com/macros/s/.../exec`
    }
    return 'APPS_SCRIPT_URL is set but appears invalid or incomplete. Check Settings → Sync tab.'
  }
  return null
}

function maskUrl(url: string): string {
  if (!url) return '(empty)'
  const s = url.trim()
  if (s.length <= 80) return s
  return s.slice(0, 45) + '...' + s.slice(-25)
}

function diagnoseHtmlResponse(text: string): string | null {
  if (!text || text.length < 15) return null
  const lower = text.toLowerCase()
  const snippet = text.slice(0, 500).replace(/\s+/g, ' ').trim()
  const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  // Arabic failure page title "فشل" that was previously reported
  if (title.includes('فشل') || title.toLowerCase().includes('fail') || lower.includes('فشل')) {
    return `Apps Script returned an error page titled "${title || 'فشل/Error'}". This usually means OLD code.gs is deployed.\n\nFIX (3 steps):\n1. Open your Google Sheet → Extensions → Apps Script\n2. Delete OLD code, paste ENTIRE new apps-script/code.gs from this repo (v2.4+ has test action that does NOT touch sheets)\n3. Deploy → Manage deployments → pencil icon → Version: New version → Deploy → copy /exec URL → update APPS_SCRIPT_URL env var → redeploy site\n\nResponse preview: ${snippet}`
  }

  if (lower.includes('sign in - google accounts') || lower.includes('accounts.google.com/servicelogin') || lower.includes('service login') || lower.includes('accounts.google.com/signin')) {
    return `Google LOGIN page returned instead of JSON. Web App access is restricted.\n\nFIX: Open Apps Script → Deploy → Manage deployments → Edit deployment → set "Who has access" to "Anyone" (not "Only myself") → Save → Redeploy → try Test Connection again.\n\nHint: The deployment URL must end with /exec and be accessible without login.\n\nResponse preview: ${snippet}`
  }

  if (lower.includes('not found') && lower.includes('script')) {
    return `Apps Script deployment NOT FOUND (404). The deployment was deleted or URL is stale.\n\nFIX: Open Apps Script → Deploy → Manage deployments → New deployment → Web app → Who has access: Anyone → Deploy → copy NEW /exec URL → set as APPS_SCRIPT_URL env var in Render/Vercel → redeploy.\n\nResponse preview: ${snippet}`
  }

  if (lower.includes('<title>apps script</title>') || (lower.includes('script.google.com') && lower.includes('editor'))) {
    return `This is the Apps Script EDITOR (/edit) URL, not the Web App (/exec) URL.\n\nFIX: In Apps Script → Deploy → New deployment → Type: Web app → Who has access: Anyone → Deploy → copy URL ending with /exec (format: https://script.google.com/macros/s/AKfyc.../exec)\n\nResponse preview: ${snippet}`
  }

  if (lower.includes('authorize') || lower.includes('would like to') || lower.includes('authorization required') || lower.includes('needs permission')) {
    return `Google asking for AUTHORIZATION. Script not yet authorized.\n\nFIX: Open the APPS_SCRIPT_URL directly in browser (paste it). Sign in with Google account that owns the Sheet → Allow → then Test Connection again. If still fails, redeploy Apps Script.\n\nResponse preview: ${snippet}`
  }

  if (lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('<head')) {
    const t = title || snippet.slice(0, 80)
    return `Apps Script returned HTML page (title: "${t}") instead of JSON. Common causes:\n\n1. WRONG URL: Must end with /exec, not /edit. Correct: .../macros/s/.../exec\n2. ACCESS RESTRICTED: Deploy → Manage deployments → Who has access = Anyone\n3. NOT DEPLOYED: Need to deploy as Web App\n4. SCRIPT ERROR: Open Apps Script → Executions → check logs for errors\n5. OLD CODE: Paste latest apps-script/code.gs (v2.4+) and redeploy as New version\n\nResponse preview (500 chars):\n${snippet}`
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
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
        // @ts-ignore - Bun/Node fetch supports timeout via AbortSignal
        signal: AbortSignal.timeout(30000),
      })
      if (res.status === 404 || res.status === 410) {
        throw new Error(`Apps Script HTTP ${res.status} (attempt ${attempt}/3). Deployment may be deleted or URL stale. Redeploy Apps Script as New version and update APPS_SCRIPT_URL.`)
      }
      if (res.status >= 500 && res.status <= 599) {
        throw new Error(`Apps Script HTTP ${res.status} (attempt ${attempt}/3) – Google temporary error. Retrying...`)
      }
      if (!res.ok) {
        throw new Error(`Apps Script HTTP ${res.status}: ${res.statusText}`)
      }
      const text = await res.text()
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Apps Script. Check Apps Script Executions log for errors.')
      }
      try {
        return JSON.parse(text)
      } catch {
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('Invalid JSON from Apps Script (first 300 chars): ' + text.slice(0, 300))
      }
    } catch (e: any) {
      lastErr = e
      const msg = e?.message || ''
      const name = e?.name || ''
      const isRetryable = (msg.includes('404') || msg.includes('410') || msg.includes('HTTP 5') || msg.includes('timeout') || msg.includes('aborted') || name === 'TimeoutError' || name === 'AbortError') && !msg.includes('HTML page') && !msg.includes('LOGIN page') && !msg.includes('EDITOR')
      if (!isRetryable || attempt === 3) throw e
      await new Promise((r) => setTimeout(r, 1200 * attempt))
    }
  }
  throw lastErr || new Error('Apps Script POST failed after retries')
}

async function getFromAppsScript(params: Record<string, string>): Promise<any> {
  const appsScriptUrl = getAppsScriptUrlOrThrow()
  const url = new URL(appsScriptUrl)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  // Prevent caching issues on GET
  url.searchParams.set('_t', String(Date.now()))

  let lastErr: any
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000),
      })
      if (res.status === 404 || res.status === 410) {
        throw new Error(`Apps Script HTTP ${res.status} (attempt ${attempt}/3). Web App may need redeployment.`)
      }
      if (res.status >= 500 && res.status <= 599) {
        throw new Error(`Apps Script HTTP ${res.status} (attempt ${attempt}/3) – Google temporary error.`)
      }
      if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}: ${res.statusText}`)
      const text = await res.text()
      if (!text || text.trim().length === 0) throw new Error('Empty response from Apps Script GET')
      try {
        return JSON.parse(text)
      } catch {
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('Invalid JSON from Apps Script: ' + text.slice(0, 300))
      }
    } catch (e: any) {
      lastErr = e
      const msg = e?.message || ''
      const name = e?.name || ''
      const isRetryable = (msg.includes('404') || msg.includes('410') || msg.includes('HTTP 5') || msg.includes('timeout') || msg.includes('aborted') || name === 'TimeoutError' || name === 'AbortError') && !msg.includes('HTML page')
      if (!isRetryable || attempt === 3) throw e
      await new Promise((r) => setTimeout(r, 1200 * attempt))
    }
  }
  throw lastErr || new Error('Apps Script GET failed after retries')
}

// ===== Public API =====

export async function listRows<T = any>(sheet: string, options: { filter?: string; search?: string; useCache?: boolean; includeDeleted?: boolean } = {}): Promise<T[]> {
  if (!isConfigured()) return [] as T[]
  const useCache = options.useCache !== false
  const cacheKey = `list:${sheet}:${options.filter || ''}:${options.search || ''}:${options.includeDeleted ? '1' : '0'}`
  if (useCache) {
    const cached = getCached<T[]>(cacheKey)
    if (cached) return cached
  }
  const params: Record<string, string> = { action: 'list', sheet }
  if (options.filter) params.filter = options.filter
  if (options.search) params.search = options.search
  if (options.includeDeleted) params.includeDeleted = 'true'
  const res = await getFromAppsScript(params)
  if (!res.success) throw new Error(res.error || `Failed to list ${sheet}: ${res.error || 'unknown'}`)
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
  throw new Error('replaceAll() is permanently disabled for data protection. Use createRow() or updateRow() instead.')
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
    const urlPreview = raw ? maskUrl(raw) + (raw !== urlStr ? ` → sanitized to: ${maskUrl(urlStr)}` : '') : undefined

    if (!raw || !raw.trim()) {
      return { success: false, message: 'APPS_SCRIPT_URL not set.\n\nFIX: Go to Render dashboard → your service → Environment → add APPS_SCRIPT_URL = https://script.google.com/macros/s/.../exec → Save → Redeploy.', urlPreview }
    }
    if (!urlStr) {
      return { success: false, message: 'APPS_SCRIPT_URL is empty after sanitizing. Check for stray quotes or spaces.', urlPreview }
    }
    // Quick format checks before network call
    if (urlStr.includes('/macros/d/') && urlStr.includes('/edit')) {
      return { success: false, message: 'This is EDITOR URL (/edit), not Web App URL (/exec).\n\nFIX: Apps Script → Deploy → Manage deployments → copy URL ending with /exec.', urlPreview }
    }
    if (urlStr.includes('/home/projects/') && urlStr.includes('/edit')) {
      return { success: false, message: 'This looks like Apps Script editor URL. Need deployed Web App URL.\n\nFIX: Deploy → New deployment → Web app → Who has access: Anyone → copy /exec URL.', urlPreview }
    }
    if (!urlStr.includes('/exec')) {
      return { success: false, message: `APPS_SCRIPT_URL should end with "/exec".\nCurrent: ${maskUrl(urlStr)}\n\nCorrect format: https://script.google.com/macros/s/AKfycbx.../exec\nFIX: Deploy → New deployment → Web app → copy /exec URL.`, urlPreview }
    }
    if (!urlStr.startsWith('https://script.google.com/macros/s/')) {
      return { success: false, message: `APPS_SCRIPT_URL format looks wrong. It should start with https://script.google.com/macros/s/\nCurrent: ${maskUrl(urlStr)}`, urlPreview }
    }

    const res = await callAppsScript({ action: 'test' })
    if (res.success) {
      return { success: true, message: `Connected to Google Sheets successfully! Version: ${res.version || 'unknown'} — Data protection: ${res.dataProtection ? 'ON' : 'unknown'}`, urlPreview }
    }
    return { success: false, message: res.error || 'Connection failed - Apps Script returned success:false', urlPreview }
  } catch (e: any) {
    const raw = getRawEnvUrl()
    return { success: false, message: e?.message || 'Connection failed', urlPreview: raw ? maskUrl(raw) : undefined }
  }
}

export function getConfiguredUrlPreview(): { configured: boolean; urlPreview: string | null; endsWithExec: boolean; sanitizedPreview?: string } {
  const raw = getRawEnvUrl()
  if (!raw || !raw.trim()) return { configured: false, urlPreview: null, endsWithExec: false }
  const sanitized = getSanitizedUrl()
  return {
    configured: isConfigured(),
    urlPreview: maskUrl(raw),
    sanitizedPreview: raw !== sanitized ? maskUrl(sanitized) : undefined,
    endsWithExec: sanitized.includes('/exec') && sanitized.endsWith('/exec'),
  }
}

export async function seedData(): Promise<any> {
  const res = await callAppsScript({ action: 'seed' })
  if (!res.success) throw new Error(res.error || 'Failed to seed')
  invalidateCache()
  return res.results
}

// Expose sanitized URL getter for debug route
export function getAppsScriptUrlForDebug(): string | null {
  try {
    return getSanitizedUrl() || null
  } catch {
    return null
  }
}
