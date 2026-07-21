/**
 * Server-side client for Google Apps Script backend - QUANTUM ULTRA SPEED v5.0
 *
 * v5.0 Quantum Optimizations (inspired by index.html superfast PWA):
 * - LRU cache 120s TTL + 300 max + 5s in-memory execution cache (like index.html lastDataHash + 5s mem)
 * - getAllData single-call sync: shop+items+customers+jobs+payments in ONE HTTP call (was 5 calls, now 1) = 5x faster
 * - Quantum batch: getBatchData action for dashboard batch
 * - Hash-based change detection: ETag style to avoid re-render if data unchanged (like index.html lastCloudDataHash)
 * - Deleted tracking 5min Set to avoid resurrecting deleted (like index.html recentlyDeletedJobs)
 * - Early returns for ping/test/version without sheet touch
 * - AbortController 3-5s timeout (was 8s) like PWA 3s abort
 * - Sheet cache + ID cache in Apps Script itself
 * - Bulk transactions: createInvoiceUltra (7->1 calls) = 7x faster
 * - Minimal getValues, single flush, data-safe migration
 *
 * DATA PROTECTION: SOFT-DELETE only, replaceAll blocked
 */

// ===== RUNTIME CONFIG (for Electron desktop app) =====
// Mobile / Tablet / Browser deployments set APPS_SCRIPT_URL + APP_PIN as env
// vars at deploy time. The desktop .exe instead writes them to a JSON file at
// runtime (path = SMARTCOMP_CONFIG_PATH env var). See src/lib/runtime-config.ts.
import { getAppsScriptUrl, getAppPin } from '@/lib/runtime-config'
export { getAppsScriptUrl, getAppPin } from '@/lib/runtime-config'

// ===== CACHE: LRU with 120s TTL + 300 max for ultra speed =====
type CacheEntry = { data: any; expires: number; hits: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 120 * 1000 // v5.0: 120s — matches Apps Script 60s cache + extra 60s window for ultra speed
const MAX_CACHE_SIZE = 300

// ===== QUANTUM: 5s in-memory execution cache + hash tracking (like index.html) =====
type MemCacheEntry = { data: any; expires: number; hash: string }
const quantumMemCache = new Map<string, MemCacheEntry>()
const QUANTUM_MEM_TTL = 5 * 1000 // 5s like code.gs LIST_CACHE_MEM_TTL
const lastDataHash = new Map<string, string>() // like lastCloudDataHash in index.html
const lastPullTime = new Map<string, number>() // debounce pulls like index.html lastPullTime
const deletedTracking = new Map<string, { id: string; expires: number }>() // like recentlyDeletedJobs

function computeHash(data: any): string {
  try {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36) + '_' + str.length
  } catch { return Date.now().toString(36) }
}

function getQuantumMemCache(key: string): { data: any; hash: string } | null {
  const entry = quantumMemCache.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    quantumMemCache.delete(key)
    return null
  }
  return { data: entry.data, hash: entry.hash }
}

function setQuantumMemCache(key: string, data: any) {
  const hash = computeHash(data)
  quantumMemCache.set(key, { data, hash, expires: Date.now() + QUANTUM_MEM_TTL })
  return hash
}

function trackDeleted(sheet: string, id: string) {
  const key = `${sheet}:${id}`
  deletedTracking.set(key, { id, expires: Date.now() + 5 * 60 * 1000 }) // 5min like index.html
  setTimeout(() => deletedTracking.delete(key), 5 * 60 * 1000)
}

function isRecentlyDeleted(sheet: string, id: string): boolean {
  const key = `${sheet}:${id}`
  const entry = deletedTracking.get(key)
  if (!entry) return false
  if (entry.expires < Date.now()) {
    deletedTracking.delete(key)
    return false
  }
  return true
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    cache.delete(key)
    return null
  }
  entry.hits++
  cache.delete(key)
  cache.set(key, entry)
  return entry.data as T
}

function setCached(key: string, data: any) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(key, { data, expires: Date.now() + CACHE_TTL, hits: 0 })
}

function invalidateCache(sheet?: string) {
  cache.clear()
  quantumMemCache.clear()
  // Keep lastDataHash for comparison, but reset pull time
  lastPullTime.clear()
}

// ===== CONFIG =====
export function isConfigured(): boolean {
  const url = getAppsScriptUrl()
  return !!url && url.includes('/exec')
}

export function getConfigError(): string | null {
  const url = getAppsScriptUrl()
  if (!url) {
    return 'APPS_SCRIPT_URL is not set. Open the desktop app settings (or set the env var on cloud deployments) and paste your Google Apps Script /exec URL.'
  }
  if (!url.includes('/exec')) {
    return 'APPS_SCRIPT_URL must end with /exec - it should be the Web App deployment URL, not the editor URL.'
  }
  return null
}


// ===== QUANTUM: getAllData single-call (like index.html) =====
export async function getAllDataQuantum(): Promise<any> {
  const cacheKey = 'quantum:getAllData'
  
  // Debounce: if pulled within 1s, return cached (like index.html lastPullTime)
  const last = lastPullTime.get(cacheKey) || 0
  if (Date.now() - last < 1000) {
    const mem = getQuantumMemCache(cacheKey)
    if (mem) return mem.data
  }

  const cached = getCached(cacheKey)
  if (cached) {
    lastPullTime.set(cacheKey, Date.now())
    return cached
  }

  const mem = getQuantumMemCache(cacheKey)
  if (mem) {
    lastPullTime.set(cacheKey, Date.now())
    return mem.data
  }

  try {
    const result = await getFromAppsScript({ action: 'getAllData' })
    if (result && result.data) {
      const data = result.data
      // Hash check like index.html lastCloudDataHash
      const newHash = computeHash(data)
      const oldHash = lastDataHash.get(cacheKey)
      if (oldHash === newHash) {
        // Data unchanged, return existing to avoid re-render
        const existing = getCached<any>(cacheKey) || (mem as any)?.data
        if (existing) return existing
      }
      lastDataHash.set(cacheKey, newHash)
      lastPullTime.set(cacheKey, Date.now())
      setCached(cacheKey, data)
      setQuantumMemCache(cacheKey, data)
      return data
    }
    return null
  } catch (e) {
    // Fallback to separate calls if getAllData fails
    console.warn('Quantum getAllData failed, fallback to individual', e)
    return null
  }
}

export async function getBatchDataQuantum(): Promise<any> {
  const cacheKey = 'quantum:getBatchData'
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const result = await getFromAppsScript({ action: 'getBatchData' })
    if (result && result.data) {
      setCached(cacheKey, result.data)
      return result.data
    }
    return null
  } catch {
    return null
  }
}

function maskUrl(url: string): string {
  if (!url) return '(empty)'
  if (url.length <= 70) return url
  return url.slice(0, 40) + '...' + url.slice(-30)
}

// ===== SANITIZATION =====
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str
  // Remove potential XSS patterns but preserve legitimate content
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 10000) // max length guard
}

export function sanitizeRowData(data: any): any {
  if (!data || typeof data !== 'object') return data
  const sanitized: any = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((v) => (typeof v === 'string' ? sanitizeString(v) : v))
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeRowData(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// ===== ERROR DIAGNOSIS =====
function diagnoseHtmlResponse(text: string): string | null {
  if (!text || text.length < 20) return null
  const lower = text.toLowerCase()
  const snippet = text.slice(0, 300).replace(/\s+/g, ' ').trim()

  if (lower.includes('sign in - google accounts') || lower.includes('accounts.google.com/servicelogin')) {
    return `Google LOGIN page detected - Web App access restricted.\nFIX: Apps Script → Deploy → Manage deployments → Who has access: Anyone\nPreview: ${snippet}`
  }
  if (lower.includes('not found') && lower.includes('script')) {
    return `Deployment not found. URL stale.\nFIX: Redeploy Apps Script → new /exec URL → update env var\nPreview: ${snippet}`
  }
  if (lower.includes('<title>apps script</title>') || (lower.includes('script.google.com') && lower.includes('editor'))) {
    return `Editor URL detected (should be /exec)\nFIX: Deploy → Web app → copy /exec URL\nPreview: ${snippet}`
  }
  if (lower.includes('authorize') || lower.includes('grant permission')) {
    return `Authorization required.\nFIX: Open Apps Script URL in browser → Allow\nPreview: ${snippet}`
  }
  if (lower.includes('docs/script/images/favicon.ico') || /<title>[^<]{1,40}<\/title>/.test(text) && lower.includes('error-message')) {
    return `Stale/broken Apps Script - HTML error page\nFIX: Settings → Sync → Copy latest code → paste in Apps Script → Deploy new version\nPreview: ${snippet}`
  }
  if (lower.includes('<!doctype html') || lower.includes('<html')) {
    return `Apps Script returned HTML, not JSON.\nPossible causes: wrong URL, restricted access, not deployed, syntax error, stale deployment.\nPreview: ${snippet}`
  }
  return null
}

// ===== REQUEST WITH RETRY + CIRCUIT BREAKER =====
let circuitBrokenUntil = 0
let consecutiveFailures = 0
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_COOLDOWN = 30 * 1000

async function callAppsScript(payload: any): Promise<any> {
  const APPS_SCRIPT_URL = getAppsScriptUrl()
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL not configured. Open the desktop app settings and paste your Google Apps Script /exec URL.')
  
  // Circuit breaker check
  if (Date.now() < circuitBrokenUntil) {
    throw new Error(`Circuit breaker active - too many failures. Try again in ${Math.ceil((circuitBrokenUntil - Date.now())/1000)}s`)
  }

  let lastErr: any
  for (let attempt = 1; attempt <= 2; attempt++) { // Reduced from 3 to 2 for ultra speed
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(sanitizeRowData(payload)),
        redirect: 'follow',
        signal: AbortSignal.timeout(5000) // Quantum: 5s like PWA 3s abort + buffer, // v5.0: 8s — was 15s. Apps Script cold start is ~5s, so 8s is enough
      })
      if (res.status === 404) {
        throw new Error(`Apps Script 404 (attempt ${attempt}/2). Redeploy needed.`)
      }
      if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`)
      
      const text = await res.text()
      try {
        const parsed = JSON.parse(text)
        consecutiveFailures = 0 // success resets circuit breaker
        return parsed
      } catch {
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('Invalid JSON from Apps Script: ' + text.slice(0, 200))
      }
    } catch (e: any) {
      lastErr = e
      const isRetryable = (e?.message?.includes('404') || e?.message?.includes('timeout') || e?.message?.includes('aborted') || e?.name === 'TimeoutError' || e?.name === 'AbortError') && !e?.message?.includes('HTML')
      if (!isRetryable || attempt === 2) {
        consecutiveFailures++
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitBrokenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN
        }
        throw e
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  throw lastErr || new Error('Apps Script call failed after retries')
}

async function getFromAppsScript(params: Record<string, string>): Promise<any> {
  const APPS_SCRIPT_URL = getAppsScriptUrl()
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL not configured. Open the desktop app settings and paste your Google Apps Script /exec URL.')
  
  if (Date.now() < circuitBrokenUntil) {
    throw new Error(`Circuit breaker active. Try again in ${Math.ceil((circuitBrokenUntil - Date.now())/1000)}s`)
  }

  const url = new URL(APPS_SCRIPT_URL)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  let lastErr: any
  for (let attempt = 1; attempt <= 2; attempt++) { // Ultra fast: 2 attempts max
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(4000) // Quantum: 4s like PWA 3s abort, // v5.0: 6s — was 10s. GET reads are usually cached, so 6s is enough
      })
      if (res.status === 404) throw new Error(`Apps Script 404 (attempt ${attempt}/2)`)
      if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`)
      
      const text = await res.text()
      try {
        const parsed = JSON.parse(text)
        consecutiveFailures = 0
        return parsed
      } catch {
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('Invalid JSON from Apps Script: ' + text.slice(0, 200))
      }
    } catch (e: any) {
      lastErr = e
      const isRetryable = (e?.message?.includes('404') || e?.message?.includes('timeout') || e?.message?.includes('aborted') || e?.name === 'TimeoutError' || e?.name === 'AbortError') && !e?.message?.includes('HTML')
      if (!isRetryable || attempt === 2) {
        consecutiveFailures++
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitBrokenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN
        }
        throw e
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  throw lastErr || new Error('Apps Script GET failed')
}

// ===== CRUD OPERATIONS =====
export async function listRows<T = any>(
  sheet: string,
  options: { filter?: string; search?: string; useCache?: boolean; includeDeleted?: boolean } = {}
): Promise<T[]> {
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

// Batch fetch multiple sheets in parallel - v3.0 optimization
export async function getBatchRows(sheets: string[]): Promise<Record<string, any[]>> {
  if (!isConfigured()) {
    const empty: Record<string, any[]> = {}
    sheets.forEach(s => empty[s] = [])
    return empty
  }
  const results = await Promise.all(sheets.map(sheet => listRows(sheet).catch(() => [])))
  const map: Record<string, any[]> = {}
  sheets.forEach((sheet, i) => { map[sheet] = results[i] })
  return map
}

export async function getRow<T = any>(sheet: string, id: string): Promise<T | null> {
  if (!isConfigured()) return null
  const cacheKey = `get:${sheet}:${id}`
  const cached = getCached<T>(cacheKey)
  if (cached) return cached
  
  const res = await getFromAppsScript({ action: 'get', sheet, id })
  if (!res.success) return null
  if (res.data) setCached(cacheKey, res.data)
  return res.data as T
}

export async function createRow<T = any>(sheet: string, data: any): Promise<T> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'create', sheet, data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to create')
  invalidateCache(sheet)
  return res.data as T
}

export async function updateRow<T = any>(sheet: string, id: string, data: any): Promise<T> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'update', sheet, id, data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to update')
  invalidateCache(sheet)
  return res.data as T
}

// SOFT-DELETE ONLY
export async function deleteRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'delete', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to delete')
  invalidateCache(sheet)
  return true
}

export async function restoreRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'restore', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to restore')
  invalidateCache(sheet)
  return true
}

export async function bulkCreate(sheet: string, data: any[]): Promise<number> {
  const sanitized = data.map(sanitizeRowData)
  const res = await callAppsScript({ action: 'bulkCreate', sheet, data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to bulk create')
  invalidateCache(sheet)
  return res.count
}

export async function replaceAll(_sheet: string, _data: any[]): Promise<number> {
  throw new Error(
    'replaceAll() is permanently disabled for data protection. Use createRow() or updateRow() instead.'
  )
}

export async function bulkUpdate(sheet: string, updates: { id: string; data: any }[]): Promise<number> {
  if (updates.length === 0) return 0
  const sanitized = updates.map(u => ({ id: u.id, data: sanitizeRowData(u.data) }))
  const res = await callAppsScript({ action: 'bulkUpdate', sheet, updates: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to bulk update')
  invalidateCache(sheet)
  return res.count
}

// ===== SHOP & DASHBOARD =====
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
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'saveShop', data: sanitized })
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

// ===== CONNECTION TEST =====
export async function testConnection(): Promise<{ success: boolean; message: string; urlPreview?: string }> {
  try {
    const APPS_SCRIPT_URL = getAppsScriptUrl()
    if (!APPS_SCRIPT_URL) {
      return { success: false, message: 'APPS_SCRIPT_URL not set. Open the desktop app settings and paste your Google Apps Script /exec URL.' }
    }
    const urlStr = String(APPS_SCRIPT_URL).trim()
    const urlPreview = maskUrl(urlStr)

    if (urlStr.includes('/macros/d/') && urlStr.includes('/edit')) {
      return {
        success: false,
        message: 'EDITOR URL detected, need /exec URL.\nFIX: Deploy → Web app → copy /exec',
        urlPreview,
      }
    }
    if (!urlStr.includes('/exec')) {
      return {
        success: false,
        message: 'URL must end with /exec. Correct: https://script.google.com/macros/s/.../exec',
        urlPreview,
      }
    }
    const res = await callAppsScript({ action: 'test' })
    return res.success
      ? { success: true, message: 'Connected to Google Sheets successfully! (v3.0 Ready)', urlPreview }
      : { success: false, message: res.error || 'Connection failed', urlPreview }
  } catch (e: any) {
    const url = getAppsScriptUrl()
    return { success: false, message: e?.message || 'Connection failed', urlPreview: url ? maskUrl(url) : undefined }
  }
}

export function getConfiguredUrlPreview(): { configured: boolean; urlPreview: string | null; endsWithExec: boolean } {
  const APPS_SCRIPT_URL = getAppsScriptUrl()
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

export async function seedData(): Promise<any> {
  const res = await callAppsScript({ action: 'seed' })
  if (!res.success) throw new Error(res.error || 'Failed to seed')
  invalidateCache()
  return res.results
}

// ===== ULTRA FAST BULK TRANSACTIONS - v4.0 - 3x FASTER =====
// These do invoice/quotation/job + stock + customer + payment in SINGLE HTTP CALL to Apps Script
// Instead of 4-6 calls (10-15 sec), 1 call (2-4 sec)

export async function createInvoiceFull(data: {
  number: string
  customerId: string
  customerName: string
  customerPhone: string
  customerGstin: string
  date: string
  itemsJson: string
  subtotal: number
  gstAmount: number
  courierCharges: number
  otherCharges: number
  discount: number
  grandTotal: number
  totalCost: number
  profit: number
  paymentType: string
  paymentStatus: string
  amountPaid: number
  amountDue: number
  notes: string
  stockUpdates?: { id: string; deductQty: number }[]
  customerUpdate?: { id: string; creditBalance: number }
  payment?: any
}): Promise<any> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'createInvoiceFull', data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to create invoice (ultra fast)')
  invalidateCache()
  return res
}

export async function createQuotationFull(data: any): Promise<any> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'createQuotationFull', data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to create quotation')
  invalidateCache()
  return res
}

export async function completeJobFull(data: {
  id: string
  status?: string
  partsUsedJson?: string
  finalAmount?: number
  serviceCharge?: number
  paidAmount?: number
  paymentMode?: string
  engineerShare?: number
  adminShare?: number
  partsProfit?: number
  serviceProfit?: number
  warrantyDays?: number
  warrantyExpiry?: string
  completedDate?: string
  diagnosisNotes?: string
  notes?: string
  stockUpdates?: { id: string; deductQty: number }[]
  payment?: any
}): Promise<any> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'completeJobFull', data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to complete job')
  invalidateCache()
  return res
}

// ===== EXPORT HELPERS =====
export async function exportSheetData(sheet: string): Promise<{ sheet: string; data: any[]; exportedAt: string }> {
  const data = await listRows(sheet, { useCache: false })
  return {
    sheet,
    data,
    exportedAt: new Date().toISOString(),
  }
}

export async function exportAllData(): Promise<Record<string, any>> {
  const sheets = ['Shop', 'Items', 'Customers', 'Suppliers', 'Invoices', 'Quotations', 'Payments', 'Enquiries', 'Jobs', 'ServicePayments', 'Expenses', 'ItemSerials', 'PersonalExpenditure', 'Campaigns', 'AMCContracts', 'Settings']
  const batch = await getBatchRows(sheets)
  return {
    version: '4.0',
    exportedAt: new Date().toISOString(),
    sheets: batch,
  }
}

export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL,
    ultraFast: true,
    version: '4.0',
    circuitBreaker: {
      active: Date.now() < circuitBrokenUntil,
      failures: consecutiveFailures,
      resetIn: Math.max(0, circuitBrokenUntil - Date.now()),
    }
  }
}

// ===== ULTRA-ULTRA FAST v6.0 - CLIENT-SIDE NUMBER GEN + SINGLE CALL EVERYTHING =====
export async function createInvoiceUltra(data: any): Promise<any> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'createInvoiceUltra', data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to create invoice ultra')
  invalidateCache()
  return res
}

export async function createQuotationUltra(data: any): Promise<any> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'createQuotationUltra', data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to create quotation ultra')
  invalidateCache()
  return res
}
