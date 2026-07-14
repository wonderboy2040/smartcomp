/**
 * Server-side client for Google Apps Script backend (PROTECTED EDITION)
 *
 * DATA PROTECTION:
 *   - deleteRow() performs a SOFT-DELETE (sets deleted=true via updateRow).
 *     The row is never removed from the Google Sheet.
 *   - replaceAll() is PERMANENTLY BLOCKED — it always throws an error.
 *   - bulkCreate() still works (only appends, never deletes).
 *
 * All data operations go through this client.
 * APPS_SCRIPT_URL must be set in environment variables.
 */

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL

// Server-side in-memory cache (2 minute TTL).
// On Render free tier the server may sleep, so this mainly helps within an active session.
// 2 minutes is a good balance: avoids hammering Apps Script while still picking up
// changes reasonably quickly. Mutations always invalidate the cache immediately.
const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 30 * 1000 // 30 seconds — fast mutation visibility while still reducing Apps Script calls

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) {
    return entry.data as T
  }
  if (entry) cache.delete(key)
  return null
}

function setCached(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

function invalidateCache(sheet?: string) {
  // Always clear everything on any mutation — we have 9 sheets and the dashboard
  // aggregates all of them. Selective invalidation was leaving stale data.
  // The 30s TTL is short enough that clearing everything is cheap.
  cache.clear()
}

export function isConfigured(): boolean {
  return !!APPS_SCRIPT_URL
}

export function getConfigError(): string | null {
  if (!APPS_SCRIPT_URL) {
    return 'APPS_SCRIPT_URL environment variable is not set. Please set it in your deployment environment variables.'
  }
  return null
}

/**
 * Mask a URL for display — shows first 40 and last 30 chars so the user
 * can verify the format without exposing the full token.
 */
function maskUrl(url: string): string {
  if (!url) return '(empty)'
  if (url.length <= 70) return url
  return url.slice(0, 40) + '...' + url.slice(-30)
}

/**
 * Detect when Apps Script returns an HTML page instead of JSON.
 * Returns a detailed, actionable error message that INCLUDES the actual
 * HTML snippet so the user can see exactly what Google is returning.
 */
function diagnoseHtmlResponse(text: string): string | null {
  if (!text || text.length < 20) return null
  const lower = text.toLowerCase()
  const snippet = text.slice(0, 300).replace(/\s+/g, ' ').trim()

  // Google login page — most common cause of this error
  if (lower.includes('sign in - google accounts') || lower.includes('accounts.google.com/servicelogin') || lower.includes('service login')) {
    return `Google is showing a LOGIN page instead of running the script. This means the Web App access is restricted.

FIX: Open your Apps Script → Deploy → Manage deployments → Edit the deployment → set "Who has access" to "Anyone" (not "Only myself" or "Anyone with Google account") → Save → try again.

Response preview: ${snippet}`
  }

  // Apps Script "not found" / "deleted deployment" page
  if (lower.includes('not found') && lower.includes('script')) {
    return `Apps Script deployment not found. The deployment may have been deleted or the URL is stale.

FIX: Open Apps Script → Deploy → Manage deployments → create a new deployment → copy the new /exec URL → update your APPS_SCRIPT_URL env var.

Response preview: ${snippet}`
  }

  // Apps Script editor page (wrong URL — /edit instead of /exec)
  if (lower.includes('<title>apps script</title>') || (lower.includes('script.google.com') && lower.includes('editor'))) {
    return `This looks like the Apps Script EDITOR page, not a deployed Web App. You probably copied the /edit URL instead of the /exec URL.

FIX: In Apps Script editor → click "Deploy" → "New deployment" → type "Web app" → set "Who has access: Anyone" → Deploy → copy the URL ending with /exec.

Response preview: ${snippet}`
  }

  // Google consent / authorization page
  if (lower.includes('authorize') || lower.includes('would like to') || lower.includes('grant permission')) {
    return `Google is asking for authorization. This means the script hasn't been authorized yet.

FIX: Open the Apps Script URL directly in your browser → sign in with your Google account → click "Allow" → then try Test Connection again.

Response preview: ${snippet}`
  }

  // Generic HTML (any other HTML page)
  if (lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('<head')) {
    return `Apps Script returned an HTML page instead of JSON. The most common causes are:

1. WRONG URL FORMAT — The URL must end with /exec (deployment URL), NOT /edit (editor URL).
   Correct format: https://script.google.com/macros/s/AKfycbx.../exec
   Wrong format:   https://script.google.com/macros/d/.../edit

2. ACCESS RESTRICTED — In Apps Script → Deploy → Manage deployments → edit your deployment → set "Who has access" to "Anyone" (not "Only myself").

3. SCRIPT NOT DEPLOYED — The script exists but hasn't been deployed as a Web App. Deploy → New deployment → Web app.

4. SCRIPT ERRORS — The script has a syntax error. Open Apps Script → Run → check the execution log.

Response preview (first 300 chars):
${snippet}`
  }
  return null
}

async function callAppsScript(payload: any): Promise<any> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL not configured')
  }
  // Retry logic — Apps Script Web Apps sometimes 404 on cold start or
  // return timeouts. Up to 3 attempts with exponential backoff.
  let lastErr: any
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: AbortSignal.timeout(25000), // 25s — fail faster, retry faster
      })
      if (res.status === 404) {
        // Apps Script deployment issue — retry after backoff
        throw new Error(`Apps Script HTTP 404 (attempt ${attempt}/3). The Apps Script Web App may need redeployment.`)
      }
      if (!res.ok) {
        throw new Error(`Apps Script HTTP ${res.status}`)
      }
      const text = await res.text()
      try {
        return JSON.parse(text)
      } catch {
        // HTML response — diagnose the most likely cause
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('Invalid response from Apps Script: ' + text.slice(0, 200))
      }
    } catch (e: any) {
      lastErr = e
      // If it's a timeout or 404, retry with backoff. HTML/login errors are NOT retryable.
      const isRetryable = (e?.message?.includes('404') ||
                          e?.message?.includes('timeout') ||
                          e?.message?.includes('aborted') ||
                          e?.name === 'TimeoutError' ||
                          e?.name === 'AbortError') &&
                         !e?.message?.includes('HTML page')
      if (!isRetryable || attempt === 3) throw e
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  throw lastErr || new Error('Apps Script call failed after retries')
}

async function getFromAppsScript(params: Record<string, string>): Promise<any> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL not configured')
  }
  const url = new URL(APPS_SCRIPT_URL)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  // Retry logic for GET as well
  let lastErr: any
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
      })
      if (res.status === 404) {
        throw new Error(`Apps Script HTTP 404 (attempt ${attempt}/3). Web App may need redeployment.`)
      }
      if (!res.ok) {
        throw new Error(`Apps Script HTTP ${res.status}`)
      }
      const text = await res.text()
      try {
        return JSON.parse(text)
      } catch {
        // HTML response — diagnose the most likely cause
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('Invalid response from Apps Script: ' + text.slice(0, 200))
      }
    } catch (e: any) {
      lastErr = e
      const isRetryable = (e?.message?.includes('404') ||
                          e?.message?.includes('timeout') ||
                          e?.message?.includes('aborted') ||
                          e?.name === 'TimeoutError' ||
                          e?.name === 'AbortError') &&
                         !e?.message?.includes('HTML page')
      if (!isRetryable || attempt === 3) throw e
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  throw lastErr || new Error('Apps Script GET failed after retries')
}

// ===== LIST =====
export async function listRows<T = any>(
  sheet: string,
  options: { filter?: string; search?: string; useCache?: boolean; includeDeleted?: boolean } = {}
): Promise<T[]> {
  // PERFORMANCE + UX: When APPS_SCRIPT_URL is not configured, return an empty
  // array instead of throwing. This lets every API route that calls listRows()
  // on mount (Dashboard, Jobs, Invoices, …) gracefully return `[]` instead of
  // a 500 error, so the UI shows empty states and the SetupWizard can appear
  // instead of crash-looping.
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
  if (!res.success) throw new Error(res.error || 'Failed to list')

  if (useCache) setCached(cacheKey, res.data)
  return res.data as T[]
}

// ===== GET =====
export async function getRow<T = any>(sheet: string, id: string): Promise<T | null> {
  if (!isConfigured()) return null
  const res = await getFromAppsScript({ action: 'get', sheet, id })
  if (!res.success) return null
  return res.data as T
}

// ===== CREATE =====
export async function createRow<T = any>(sheet: string, data: any): Promise<T> {
  const res = await callAppsScript({ action: 'create', sheet, data })
  if (!res.success) throw new Error(res.error || 'Failed to create')
  invalidateCache(sheet)
  return res.data as T
}

// ===== UPDATE =====
export async function updateRow<T = any>(sheet: string, id: string, data: any): Promise<T> {
  const res = await callAppsScript({ action: 'update', sheet, id, data })
  if (!res.success) throw new Error(res.error || 'Failed to update')
  invalidateCache(sheet)
  return res.data as T
}

// ===== DELETE (SOFT-DELETE ONLY) =====
// This performs a SOFT DELETE: marks the row as deleted=true but NEVER removes
// it from the Google Sheet. The data is permanently safe.
export async function deleteRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'delete', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to delete')
  invalidateCache(sheet)
  return true
}

// ===== RESTORE (un-soft-delete) =====
export async function restoreRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'restore', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to restore')
  invalidateCache(sheet)
  return true
}

// ===== BULK CREATE (append only — safe) =====
export async function bulkCreate(sheet: string, data: any[]): Promise<number> {
  const res = await callAppsScript({ action: 'bulkCreate', sheet, data })
  if (!res.success) throw new Error(res.error || 'Failed to bulk create')
  invalidateCache(sheet)
  return res.count
}

// ===== REPLACE ALL — PERMANENTLY BLOCKED =====
// This function exists for backward compatibility but ALWAYS throws.
// It will never delete or overwrite any data.
export async function replaceAll(_sheet: string, _data: any[]): Promise<number> {
  throw new Error(
    'replaceAll() is permanently disabled for data protection. ' +
    'Google Sheets data can never be bulk-overwritten. Use createRow() or updateRow() instead.'
  )
}

// ===== BULK UPDATE (batch multiple row updates in one call) =====
// This sends all updates to Apps Script in a single HTTP request,
// avoiding N separate round-trips for operations like stock deduction.
export async function bulkUpdate(sheet: string, updates: { id: string; data: any }[]): Promise<number> {
  if (updates.length === 0) return 0
  const res = await callAppsScript({ action: 'bulkUpdate', sheet, updates })
  if (!res.success) throw new Error(res.error || 'Failed to bulk update')
  invalidateCache(sheet)
  return res.count
}

// ===== SHOP =====
export async function getShop(): Promise<any | null> {
  if (!isConfigured()) return null
  const cacheKey = 'shop:single'
  const cached = getCached<any>(cacheKey)
  if (cached !== null) return cached

  const res = await getFromAppsScript({ action: 'shop' })
  if (!res.success) return null
  const shop = res.data
  setCached(cacheKey, shop)
  return shop
}

export async function saveShop(data: any): Promise<any> {
  const res = await callAppsScript({ action: 'saveShop', data })
  if (!res.success) throw new Error(res.error || 'Failed to save shop')
  invalidateCache()
  return res.data
}

// ===== DASHBOARD =====
export async function getDashboardStats(): Promise<any> {
  const cacheKey = 'dashboard:stats'
  const cached = getCached<any>(cacheKey)
  if (cached) return cached

  const res = await getFromAppsScript({ action: 'dashboard' })
  if (!res.success) throw new Error(res.error || 'Failed to get dashboard')
  setCached(cacheKey, res.data)
  return res.data
}

// ===== TEST CONNECTION =====
export async function testConnection(): Promise<{ success: boolean; message: string; urlPreview?: string }> {
  try {
    if (!APPS_SCRIPT_URL) {
      return { success: false, message: 'APPS_SCRIPT_URL not set in environment' }
    }
    // Pre-flight URL validation — catch the most common mistake before
    // even hitting the network. The Apps Script Web App URL must end with /exec.
    const urlStr = String(APPS_SCRIPT_URL).trim()
    const urlPreview = maskUrl(urlStr)

    if (urlStr.includes('/macros/d/') && urlStr.includes('/edit')) {
      return {
        success: false,
        message: 'This looks like the Apps Script EDITOR URL, not the Web App URL.\n\nFIX: In Apps Script → click "Deploy" → "Manage deployments" → copy the URL that ends with /exec (NOT /edit).',
        urlPreview,
      }
    }
    if (urlStr.includes('/home/projects/') && urlStr.includes('/edit')) {
      return {
        success: false,
        message: 'This looks like the Apps Script editor URL, not a deployed Web App URL.\n\nFIX: In Apps Script → click "Deploy" → "New deployment" → type "Web app" → set "Who has access: Anyone" → Deploy → copy the /exec URL.',
        urlPreview,
      }
    }
    if (!urlStr.includes('/exec')) {
      return {
        success: false,
        message: 'The Apps Script URL should end with "/exec".\n\nCorrect format: https://script.google.com/macros/s/AKfycbx.../exec\n\nFIX: Open Apps Script → Deploy → New deployment → Web app → copy the /exec URL.',
        urlPreview,
      }
    }
    const res = await callAppsScript({ action: 'test' })
    return res.success
      ? { success: true, message: 'Connected to Google Sheets successfully!', urlPreview }
      : { success: false, message: res.error || 'Connection failed', urlPreview }
  } catch (e: any) {
    return { success: false, message: e?.message || 'Connection failed', urlPreview: APPS_SCRIPT_URL ? maskUrl(APPS_SCRIPT_URL) : undefined }
  }
}

// ===== GET CONFIGURED URL (masked) — for Settings UI display =====
export function getConfiguredUrlPreview(): { configured: boolean; urlPreview: string | null; endsWithExec: boolean } {
  if (!APPS_SCRIPT_URL) {
    return { configured: false, urlPreview: null, endsWithExec: false }
  }
  const urlStr = String(APPS_SCRIPT_URL).trim()
  return {
    configured: true,
    urlPreview: maskUrl(urlStr),
    endsWithExec: urlStr.includes('/exec'),
  }
}

// ===== SEED DATA =====
export async function seedData(): Promise<any> {
  const res = await callAppsScript({ action: 'seed' })
  if (!res.success) throw new Error(res.error || 'Failed to seed')
  invalidateCache()
  return res.results
}
