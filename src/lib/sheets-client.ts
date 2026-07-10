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
        throw new Error('Invalid response from Apps Script: ' + text.slice(0, 200))
      }
    } catch (e: any) {
      lastErr = e
      // If it's a timeout or 404, retry with backoff. Otherwise throw immediately.
      const isRetryable = e?.message?.includes('404') ||
                          e?.message?.includes('timeout') ||
                          e?.message?.includes('aborted') ||
                          e?.name === 'TimeoutError' ||
                          e?.name === 'AbortError'
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
        throw new Error('Invalid response from Apps Script: ' + text.slice(0, 200))
      }
    } catch (e: any) {
      lastErr = e
      const isRetryable = e?.message?.includes('404') ||
                          e?.message?.includes('timeout') ||
                          e?.message?.includes('aborted') ||
                          e?.name === 'TimeoutError' ||
                          e?.name === 'AbortError'
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
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    if (!APPS_SCRIPT_URL) {
      return { success: false, message: 'APPS_SCRIPT_URL not set in environment' }
    }
    const res = await callAppsScript({ action: 'test' })
    return res.success
      ? { success: true, message: 'Connected to Google Sheets successfully! (Protected Edition)' }
      : { success: false, message: res.error || 'Connection failed' }
  } catch (e: any) {
    return { success: false, message: e?.message || 'Connection failed' }
  }
}

// ===== SEED DATA =====
export async function seedData(): Promise<any> {
  const res = await callAppsScript({ action: 'seed' })
  if (!res.success) throw new Error(res.error || 'Failed to seed')
  invalidateCache()
  return res.results
}
