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

/**
 * cyrb53 over the full string — see the matching helper in src/lib/api.ts.
 * Must stay content-complete: getAllDataQuantum() returns the CACHED payload
 * when the hash is unchanged, so any blind spot here silently serves stale data.
 */
function cyrb53(str: string): string {
  const len = str.length
  let h1 = 0xdeadbeef ^ len
  let h2 = 0x41c6ce57 ^ len
  for (let i = 0; i < len; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(36)}_${(h1 >>> 0).toString(36)}_${len}`
}

function computeHash(data: any): string {
  if (!data) return 'null'
  try {
    if (Array.isArray(data)) {
      if (data.length === 0) return 'empty_0'
      // Previously sampled only the first/mid/last row IDs, so an edit to any
      // other row — or to a non-id field of those three — hashed identically
      // and the stale cached payload was returned instead of the fresh one.
      return `arr_${data.length}_${cyrb53(JSON.stringify(data))}`
    }
    const str = typeof data === 'string' ? data : JSON.stringify(data)
    if (str.length === 0) return 'str_0'
    return `h_${cyrb53(str)}`
  } catch {
    return Date.now().toString(36)
  }
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
  if (!sheet) {
    // Wildcard invalidation — only happens on shop save / seed. Acceptable.
    cache.clear()
    quantumMemCache.clear()
    lastPullTime.clear()
    return
  }
  // Sheet-scoped invalidation: drop only the entries that belong to this sheet.
  // This keeps invoices cached when, say, a job is completed, and vice versa —
  // a major speedup for the multi-tab workflow.
  const prefix = `list:${sheet}:`
  const getPrefix = `get:${sheet}:`
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix) || key.startsWith(getPrefix) || key.startsWith('dashboard:') || key.startsWith('quantum:')) {
      cache.delete(key)
    }
  }
  for (const key of Array.from(quantumMemCache.keys())) {
    if (key.startsWith(prefix) || key.startsWith(getPrefix) || key.startsWith('dashboard:') || key.startsWith('quantum:')) {
      quantumMemCache.delete(key)
    }
  }
  for (const key of Array.from(lastPullTime.keys())) {
    if (key.startsWith(prefix) || key.startsWith(getPrefix) || key.startsWith('dashboard:') || key.startsWith('quantum:')) {
      lastPullTime.delete(key)
    }
  }
}

// ===== WRITE-THROUGH CACHE v11 — ULTRA FAST CRUD =====
// Instead of wiping the whole sheet cache after every create/update/delete
// (which forces the next GET back to the network), we patch the cached rows
// IN PLACE. The next listRows()/getRow() for that sheet is served from memory
// in <1ms with zero Apps Script round-trip. Only aggregate caches
// (dashboard, quantum getAllData) are dropped — they rebuild in one call.
//
// Cache key format: list:<sheet>:<filter>:<search>:<includeDeleted>
//                    get:<sheet>:<id>
// Filter format: "field=value" (exact match). Search: substring across fields.

function parseListCacheKey(key: string): { sheet: string; filter?: string; search?: string; includeDeleted: boolean } | null {
  if (!key.startsWith('list:')) return null
  const rest = key.slice('list:'.length)
  const firstColon = rest.indexOf(':')
  if (firstColon === -1) return null
  const sheet = rest.slice(0, firstColon)
  // Format: <sheet>:<filter>:<search>:<incDel>. Search may itself contain
  // colons ("RAM: 8GB"), so parse from the END: strip the trailing ':0'/'1'
  // marker, then split filter (never contains ':') from search at the first
  // remaining colon.
  const remainder = rest.slice(firstColon + 1)
  const includeDeleted = remainder.endsWith(':1')
  const body = remainder.slice(0, remainder.length - 2) // strip ':0' or ':1'
  const fColon = body.indexOf(':')
  const filter = fColon === -1 ? body : body.slice(0, fColon)
  const search = fColon === -1 ? undefined : body.slice(fColon + 1)
  return {
    sheet,
    filter: filter || undefined,
    search: search || undefined,
    includeDeleted,
  }
}

function rowMatchesFilter(row: any, filter?: string): boolean {
  if (!filter) return true
  const eq = filter.indexOf('=')
  if (eq === -1) return true
  const field = filter.slice(0, eq)
  const value = filter.slice(eq + 1)
  if (!field || value === undefined) return true
  return String((row || {})[field] ?? '') === String(value)
}

function rowMatchesSearch(row: any, search?: string): boolean {
  if (!search) return true
  const q = search.toLowerCase()
  const rowObj = row || {}
  for (const v of Object.values(rowObj)) {
    if (String(v ?? '').toLowerCase().includes(q)) return true
  }
  return false
}

function isDeletedRow(row: any): boolean {
  if (!row) return false
  return row.deleted === true || row.deleted === 'true' || String(row.deleted).toLowerCase() === 'true'
}

function patchListCache(sheet: string, row: any, kind: 'create' | 'update' | 'delete' | 'restore') {
  const id = row?.id
  for (const key of Array.from(cache.keys())) {
    if (!key.startsWith(`list:${sheet}:`)) continue
    const meta = parseListCacheKey(key)
    if (!meta) continue
    // NOTE: use getCached(), NOT cache.get() — the raw map holds entry
    // wrappers ({data, expires, hits}), only getCached() unwraps .data.
    const list = getCached<any[]>(key)
    if (!Array.isArray(list)) continue
    const idx = list.findIndex((x: any) => String(x?.id) === String(id))
    const matches = rowMatchesFilter(row, meta.filter) && rowMatchesSearch(row, meta.search)

    if (kind === 'create') {
      if (idx === -1 && matches) list.unshift(row) // new row goes to the top
    } else if (kind === 'update') {
      if (idx !== -1) {
        if (matches && !isDeletedRow(row)) list[idx] = row
        else list.splice(idx, 1) // no longer matches filter/search, or soft-deleted
      } else if (matches && !isDeletedRow(row)) {
        list.unshift(row)
      }
    } else if (kind === 'delete') {
      if (idx !== -1) {
        if (meta.includeDeleted) list[idx] = { ...(list[idx] || {}), deleted: true }
        else list.splice(idx, 1)
      }
    } else if (kind === 'restore') {
      if (idx !== -1) {
        if (matches) list[idx] = row
        else list.splice(idx, 1)
      } else if (matches) {
        list.unshift(row)
      }
    }
    setCached(key, list)
  }
  // Patch detail cache
  const getKey = `get:${sheet}:${id}`
  if (kind === 'delete') cache.delete(getKey)
  else if (row) setCached(getKey, row)
}

// Defensive merge: if a server response only contains CHANGED fields (older
// Apps Script deployments), merge it over the previously cached full row so
// the write-through cache never stores a partial entity.
function mergeWithCached(sheet: string, id: string, row: any): any {
  if (!row || typeof row !== 'object') return row
  const getKey = `get:${sheet}:${id}`
  const direct = getCached<any>(getKey)
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return { ...direct, ...row }
  }
  for (const key of Array.from(cache.keys())) {
    if (!key.startsWith(`list:${sheet}:`)) continue
    const list = getCached<any[]>(key)
    if (!Array.isArray(list)) continue
    const found = list.find((x: any) => String(x?.id) === String(id))
    if (found && typeof found === 'object') {
      return { ...found, ...row }
    }
  }
  return row
}

// Debounced background reconcile: after a burst of writes, refresh the sheet's
// base list once in the background so the cache also picks up changes made by
// OTHER devices/clients (PWA, WhatsApp sync). Fire-and-forget — never blocks.
const reconcileTimers = new Map<string, ReturnType<typeof setTimeout>>()
// Delay is configurable via env (tests use a long value so the background
// refresh never fires mid-assertion).
function reconcileDelayMs(): number {
  const v = Number(process.env.SMARTCOMP_RECONCILE_DELAY_MS)
  return Number.isFinite(v) && v > 0 ? v : 1200
}
function scheduleReconcile(sheet: string) {
  const existing = reconcileTimers.get(sheet)
  if (existing) clearTimeout(existing)
  reconcileTimers.set(
    sheet,
    setTimeout(() => {
      reconcileTimers.delete(sheet)
      listRows(sheet, { useCache: false }).catch(() => {})
    }, reconcileDelayMs())
  )
}

function invalidateAggregates() {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith('dashboard:') || key.startsWith('quantum:')) cache.delete(key)
  }
  for (const key of Array.from(quantumMemCache.keys())) {
    if (key.startsWith('dashboard:') || key.startsWith('quantum:')) quantumMemCache.delete(key)
  }
  for (const key of Array.from(lastPullTime.keys())) {
    if (key.startsWith('dashboard:') || key.startsWith('quantum:')) lastPullTime.delete(key)
  }
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

/**
 * Detect a JSON-formatted auth error from the Apps Script and return a
 * human-readable explanation. This catches the common case where the user's
 * deployed Apps Script has its own auth check (different from the one in
 * this repo's code.gs) and returns a body like:
 *   {"ok":false,"error":"unauthorized"}        ← custom/older Apps Script
 *   {"success":false,"error":"Unauthorized — PIN required","code":"PIN_REQUIRED"}  ← our v9.0.2 code
 *
 * Without this diagnosis, the user just sees a generic "unauthorized" error
 * and has no idea they need to redeploy the Apps Script.
 */
function diagnoseJsonAuthError(text: string): string | null {
  if (!text || text.length > 500) return null
  const lower = text.toLowerCase().trim()
  if (!lower.startsWith('{')) return null
  try {
    const parsed = JSON.parse(text)
    if (!parsed) return null
    // Pattern 1: our v9.0.2 _unauthorized() — PIN_REQUIRED code
    if (parsed.code === 'PIN_REQUIRED' || (parsed.error && String(parsed.error).includes('PIN required'))) {
      return `Apps Script requires PIN authentication but the supplied PIN doesn't match.\nFIX: Either (a) redeploy Apps Script with the latest code from /api/apps-script-code, OR (b) make sure APP_PIN env var matches the PIN stored in the Settings sheet's adminPinHash row.\nBody: ${text.slice(0, 200)}`
    }
    // Pattern 2: custom/older Apps Script returning {"ok":false,"error":"unauthorized"}
    if (parsed.ok === false && parsed.error && String(parsed.error).toLowerCase() === 'unauthorized') {
      return `Apps Script has its OWN auth check that rejects this request.\nThis usually means the deployed Apps Script is an OLDER or CUSTOM version that doesn't match the code in this repo.\nFIX: Open your Apps Script project at script.google.com → delete all code → paste the latest code from /api/apps-script-code endpoint → Deploy → New deployment → Web app → "Anyone" access → copy new /exec URL → update APPS_SCRIPT_URL env var on Render → redeploy.\nBody: ${text.slice(0, 200)}`
    }
    // Pattern 3: any "unauthorized" error in JSON
    if (parsed.error && String(parsed.error).toLowerCase() === 'unauthorized') {
      return `Apps Script returned "unauthorized". This is likely an auth mismatch — the deployed Apps Script doesn't recognize the PIN being sent.\nFIX: Redeploy Apps Script with the latest code from /api/apps-script-code.\nBody: ${text.slice(0, 200)}`
    }
  } catch {
    // not JSON, fall through
  }
  return null
}

// ===== REQUEST WITH RETRY + CIRCUIT BREAKER =====
let circuitBrokenUntil = 0
let consecutiveFailures = 0
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_COOLDOWN = 30 * 1000

// v11: in-flight GET dedupe map (see getFromAppsScript)
const inflightGets = new Map<string, Promise<any>>()

// v11: actions that CREATE rows server-side. These must never be retried on
// timeout/abort — a retry could duplicate the row if the first attempt
// actually landed. They are protected by a clientRef idempotency key instead
// (see _clientRef below + code.gs _withDedupe).
const CREATE_ACTIONS = new Set([
  'create', 'createFast', 'bulkCreate',
  'createInvoiceFull', 'createInvoiceUltra',
  'createQuotationFull', 'createQuotationUltra',
  'completeJobFull', 'saveShop', 'savePin', 'seed',
])

function nextClientRef(): string | undefined {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function callAppsScript(payload: any): Promise<any> {
  const APPS_SCRIPT_URL = getAppsScriptUrl()
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL not configured. Open the desktop app settings and paste your Google Apps Script /exec URL.')

  // Circuit breaker check
  if (Date.now() < circuitBrokenUntil) {
    throw new Error(`Circuit breaker active - too many failures. Try again in ${Math.ceil((circuitBrokenUntil - Date.now())/1000)}s`)
  }

  // Forward the server-side PIN to Apps Script so the backend can auth the
  // request. The PIN travels over the same HTTPS connection the Next.js
  // server already uses to talk to script.google.com; it is never exposed
  // to the browser. Apps Script hashes it with the same salt we use here
  // and compares to the stored hash (see apps-script/code.gs).
  const pin = getAppPin()
  const bodyWithPin: any = pin ? { ...payload, pin } : { ...payload }
  // Idempotency key: lets Apps Script return the ORIGINAL result if a retry
  // (or double-click) fires the same create twice — no duplicate rows.
  if (CREATE_ACTIONS.has(payload.action)) {
    bodyWithPin._clientRef = nextClientRef()
  }

  let lastErr: any
  for (let attempt = 1; attempt <= 2; attempt++) { // Reduced from 3 to 2 for ultra speed
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(sanitizeRowData(bodyWithPin)),
        redirect: 'follow',
        signal: AbortSignal.timeout(10000) // 10s — Apps Script cold start can take 6-8s on first hit
      })
      if (res.status === 404) {
        throw new Error(`Apps Script 404 (attempt ${attempt}/2). Redeploy needed.`)
      }
      if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`)

      const text = await res.text()
      try {
        const parsed = JSON.parse(text)
        // Detect Apps Script auth errors and throw with a helpful message
        // (otherwise the user just sees "unauthorized" with no context)
        const authHint = diagnoseJsonAuthError(text)
        if (authHint) throw new Error(authHint)
        consecutiveFailures = 0 // success resets circuit breaker
        return parsed
      } catch (parseErr: any) {
        // If diagnoseJsonAuthError threw, propagate that error (it has the helpful message)
        if (parseErr?.message && parseErr.message.includes('Apps Script')) throw parseErr
        const hint = diagnoseHtmlResponse(text)
        if (hint) throw new Error(hint)
        throw new Error('Invalid JSON from Apps Script: ' + text.slice(0, 200))
      }
    } catch (e: any) {
      lastErr = e
      const isCreate = CREATE_ACTIONS.has(payload.action)
      // v11 safety: NEVER retry create-type actions on timeout/abort — a
      // duplicate row would be created if the first attempt landed. Creates
      // are made idempotent with _clientRef instead. Reads and idempotent
      // writes (update/delete/restore/bulkUpdate) still retry once.
      const isRetryable =
        !isCreate &&
        (e?.message?.includes('404') || e?.message?.includes('timeout') || e?.message?.includes('aborted') || e?.name === 'TimeoutError' || e?.name === 'AbortError') &&
        !e?.message?.includes('HTML') && !e?.message?.includes('Apps Script has its OWN auth')
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
  // Forward server-side PIN to Apps Script for backend auth (see callAppsScript).
  const pin = getAppPin()
  if (pin) url.searchParams.set('pin', pin)

  // v11: request deduplication — if 3 panels ask for the same list at the
  // same instant, they share ONE Apps Script call instead of 3.
  const urlStr = url.toString()
  const inflight = inflightGets.get(urlStr)
  if (inflight) return inflight

  const promise = (async () => {
    let lastErr: any
    for (let attempt = 1; attempt <= 2; attempt++) { // Ultra fast: 2 attempts max
      try {
        const res = await fetch(urlStr, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(8000) // 8s — was 4s. Apps Script cold start can take 6-8s.
        })
        if (res.status === 404) throw new Error(`Apps Script 404 (attempt ${attempt}/2)`)
        if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`)

        const text = await res.text()
        try {
          const parsed = JSON.parse(text)
          // Detect Apps Script auth errors and throw with a helpful message
          const authHint = diagnoseJsonAuthError(text)
          if (authHint) throw new Error(authHint)
          consecutiveFailures = 0
          return parsed
        } catch (parseErr: any) {
          if (parseErr?.message && parseErr.message.includes('Apps Script')) throw parseErr
          const hint = diagnoseHtmlResponse(text)
          if (hint) throw new Error(hint)
          throw new Error('Invalid JSON from Apps Script: ' + text.slice(0, 200))
        }
      } catch (e: any) {
        lastErr = e
        const isRetryable = (e?.message?.includes('404') || e?.message?.includes('timeout') || e?.message?.includes('aborted') || e?.name === 'TimeoutError' || e?.name === 'AbortError') && !e?.message?.includes('HTML') && !e?.message?.includes('Apps Script has its OWN auth')
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
  })().finally(() => {
    inflightGets.delete(urlStr)
  })

  inflightGets.set(urlStr, promise)
  return promise
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
  // Guard against resurrection: a list request that was already in flight when
  // a delete landed can come back still containing the deleted row. deleteRow()
  // records the id in deletedTracking for 5 min, so drop it here. Mirrors
  // applyDeletedFilter() on the client (src/lib/api.ts).
  let data = res.data as T[]
  if (!options.includeDeleted && Array.isArray(data) && deletedTracking.size > 0) {
    data = data.filter((row: any) => {
      const id = row?.id
      return !id || !isRecentlyDeleted(sheet, String(id))
    })
  }
  if (useCache) setCached(cacheKey, data)
  return data
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
  // v11 write-through: patch caches in place — next GET is instant, no refetch.
  if (res.data) {
    patchListCache(sheet, res.data, 'create')
    invalidateAggregates()
    scheduleReconcile(sheet)
  }
  return res.data as T
}

export async function updateRow<T = any>(sheet: string, id: string, data: any): Promise<T> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'update', sheet, id, data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to update')
  if (res.data) {
    patchListCache(sheet, mergeWithCached(sheet, id, res.data), 'update')
    invalidateAggregates()
    scheduleReconcile(sheet)
  }
  return res.data as T
}

// SOFT-DELETE ONLY
export async function deleteRow(sheet: string, id: string): Promise<boolean> {
  trackDeleted(sheet, id)
  const res = await callAppsScript({ action: 'delete', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to delete')
  // v11 write-through: mark the row deleted in every cached list instantly.
  patchListCache(sheet, { id, deleted: true }, 'delete')
  invalidateAggregates()
  scheduleReconcile(sheet)
  return true
}

export async function restoreRow(sheet: string, id: string): Promise<boolean> {
  const res = await callAppsScript({ action: 'restore', sheet, id })
  if (!res.success) throw new Error(res.error || 'Failed to restore')
  if (res.data) {
    patchListCache(sheet, mergeWithCached(sheet, id, res.data), 'restore')
    invalidateAggregates()
    scheduleReconcile(sheet)
  }
  return true
}

export async function bulkCreate(sheet: string, data: any[]): Promise<number> {
  const sanitized = data.map(sanitizeRowData)
  const res = await callAppsScript({ action: 'bulkCreate', sheet, data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to bulk create')
  if (Array.isArray(res.rows)) {
    for (const row of res.rows) patchListCache(sheet, row, 'create')
  }
  invalidateAggregates()
  scheduleReconcile(sheet)
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
  if (Array.isArray(res.rows)) {
    for (const row of res.rows) {
      patchListCache(sheet, mergeWithCached(sheet, String(row.id), row), 'update')
    }
  }
  invalidateAggregates()
  scheduleReconcile(sheet)
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
  // v11: patch instead of full wipe — invoice + payment appear instantly.
  if (res.data) patchListCache('Invoices', res.data, 'create')
  if (res.payment) patchListCache('Payments', res.payment, 'create')
  // Stock + customer credit changed server-side — drop just those sheet caches.
  invalidateCache('Items')
  invalidateCache('Customers')
  invalidateCache('ItemSerials')
  invalidateAggregates()
  scheduleReconcile('Invoices')
  scheduleReconcile('Payments')
  return res
}

export async function createQuotationFull(data: any): Promise<any> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'createQuotationFull', data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to create quotation')
  if (res.data) patchListCache('Quotations', res.data, 'create')
  invalidateAggregates()
  scheduleReconcile('Quotations')
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
  if (res.data) {
    patchListCache('Jobs', mergeWithCached('Jobs', String(res.data.id), { ...res.data, status: res.data.status || 'Completed' }), 'update')
  }
  if (res.payment) patchListCache('ServicePayments', res.payment, 'create')
  // Stock deduction happened server-side — sheet-scoped invalidation only.
  invalidateCache('Items')
  invalidateCache('ItemSerials')
  invalidateAggregates()
  scheduleReconcile('Jobs')
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
  // v11: patch instead of full wipe.
  if (res.data) patchListCache('Invoices', res.data, 'create')
  if (res.payment) patchListCache('Payments', res.payment, 'create')
  invalidateCache('Items')
  invalidateCache('Customers')
  invalidateCache('ItemSerials')
  invalidateAggregates()
  scheduleReconcile('Invoices')
  scheduleReconcile('Payments')
  return res
}

export async function createQuotationUltra(data: any): Promise<any> {
  const sanitized = sanitizeRowData(data)
  const res = await callAppsScript({ action: 'createQuotationUltra', data: sanitized })
  if (!res.success) throw new Error(res.error || 'Failed to create quotation ultra')
  if (res.data) patchListCache('Quotations', res.data, 'create')
  invalidateAggregates()
  scheduleReconcile('Quotations')
  return res
}
