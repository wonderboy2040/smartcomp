/**
 * Server-side client for Google Apps Script backend
 * All data operations go through this client.
 * APPS_SCRIPT_URL must be set in environment variables.
 */

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL

// Simple in-memory cache (5 minute TTL)
const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
  if (sheet) {
    // Invalidate specific sheet caches
    for (const key of cache.keys()) {
      if (key.includes(`:${sheet}:`) || key.includes(`:dashboard:`)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
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
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`Apps Script HTTP ${res.status}`)
  }
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid response from Apps Script: ' + text.slice(0, 200))
  }
}

async function getFromAppsScript(params: Record<string, string>): Promise<any> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL not configured')
  }
  const url = new URL(APPS_SCRIPT_URL)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`Apps Script HTTP ${res.status}`)
  }
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid response from Apps Script: ' + text.slice(0, 200))
  }
}

// ===== LIST =====
export async function listRows<T = any>(
  sheet: string,
  options: { filter?: string; search?: string; useCache?: boolean } = {}
): Promise<T[]> {
  const useCache = options.useCache !== false
  const cacheKey = `list:${sheet}:${options.filter || ''}:${options.search || ''}`
  
  if (useCache) {
    const cached = getCached<T[]>(cacheKey)
    if (cached) return cached
  }

  const params: Record<string, string> = { action: 'list', sheet }
  if (options.filter) params.filter = options.filter
  if (options.search) params.search = options.search

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

// ===== DELETE =====
export async function deleteRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'delete', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to delete')
  invalidateCache(sheet)
  return true
}

// ===== BULK CREATE =====
export async function bulkCreate(sheet: string, data: any[]): Promise<number> {
  const res = await callAppsScript({ action: 'bulkCreate', sheet, data })
  if (!res.success) throw new Error(res.error || 'Failed to bulk create')
  invalidateCache(sheet)
  return res.count
}

// ===== REPLACE ALL =====
export async function replaceAll(sheet: string, data: any[]): Promise<number> {
  const res = await callAppsScript({ action: 'replace', sheet, data })
  if (!res.success) throw new Error(res.error || 'Failed to replace')
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
      ? { success: true, message: 'Connected to Google Sheets successfully!' }
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
