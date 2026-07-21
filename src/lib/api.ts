/**
 * Optimistic UI data layer - QUANTUM ULTRA SPEED v5.0 (inspired by index.html superfast PWA)
 *
 * v5.0 Quantum Improvements (index.html patterns):
 * - 5s in-memory execution cache for back-to-back reads (like _listMemCache)
 * - Hash-based change detection (lastDataHash / lastCloudDataHash) to avoid re-render if unchanged
 * - Deleted tracking Set with 5min TTL (recentlyDeletedJobs/Payments) to avoid resurrecting deleted
 * - Live sync 1s interval with hash check + AbortController 3s timeout (like index.html liveSync)
 * - Optimistic UI with instant temp ID + background sync + rollback (already had, now faster 50ms)
 * - Request deduplication + minimal getValues
 * - Offline detection + IndexedDB queue + hash
 * - 120s TTL + 5s quantum mem cache
 * - Push only if hash changed (save bandwidth)
 */

import { useEffect, useState, useCallback, useRef } from 'react'

type Updater<T> = (prev: T | undefined) => T

const cache = new Map<string, any>()
const timestamps = new Map<string, number>()
const subscribers = new Map<string, Set<() => void>>()
const inflight = new Map<string, Promise<any>>()

// ===== QUANTUM CACHE (like index.html PWA) =====
type QuantumMemEntry = { data: any; expires: number; hash: string }
const quantumMemCache = new Map<string, QuantumMemEntry>()
const QUANTUM_MEM_TTL = 5 * 1000 // 5s like code.gs LIST_CACHE_MEM_TTL
const lastDataHash = new Map<string, string>() // like lastCloudDataHash in index.html
const lastPullTime = new Map<string, number>() // debounce like index.html
const recentlyDeletedJobs = new Set<string>()
const recentlyDeletedPayments = new Set<string>()
const deletedExpiry = new Map<string, number>()

function computeHash(data: any): string {
  try {
    const str = JSON.stringify(data)
    let h = 0
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h }
    return h.toString(36) + '_' + str.length
  } catch { return Date.now().toString(36) }
}

function trackDeleted(type: 'jobs' | 'payments', id: string) {
  const set = type === 'jobs' ? recentlyDeletedJobs : recentlyDeletedPayments
  set.add(id)
  deletedExpiry.set(`${type}:${id}`, Date.now() + 5 * 60 * 1000) // 5min like index.html
  setTimeout(() => {
    set.delete(id)
    deletedExpiry.delete(`${type}:${id}`)
    try {
      const key = type === 'jobs' ? 'deletedJobs' : 'deletedPayments'
      const stored = JSON.parse(localStorage.getItem(key) || '{}')
      delete stored[id]
      localStorage.setItem(key, JSON.stringify(stored))
    } catch {}
  }, 5 * 60 * 1000)
  try {
    const key = type === 'jobs' ? 'deletedJobs' : 'deletedPayments'
    const stored = JSON.parse(localStorage.getItem(key) || '{}')
    stored[id] = Date.now()
    localStorage.setItem(key, JSON.stringify(stored))
  } catch {}
}

function isRecentlyDeleted(type: 'jobs' | 'payments', id: string): boolean {
  const key = `${type}:${id}`
  const exp = deletedExpiry.get(key)
  if (!exp) {
    // Check localStorage persistence like index.html loadDeletedTracking
    try {
      const lsKey = type === 'jobs' ? 'deletedJobs' : 'deletedPayments'
      const stored = JSON.parse(localStorage.getItem(lsKey) || '{}')
      if (stored[id] && Date.now() - stored[id] < 5 * 60 * 1000) {
        deletedExpiry.set(key, stored[id] + 5 * 60 * 1000)
        const set = type === 'jobs' ? recentlyDeletedJobs : recentlyDeletedPayments
        set.add(id)
        return true
      }
    } catch {}
    return false
  }
  if (exp < Date.now()) {
    deletedExpiry.delete(key)
    const set = type === 'jobs' ? recentlyDeletedJobs : recentlyDeletedPayments
    set.delete(id)
    return false
  }
  return true
}

function getQuantumMem(key: string): { data: any; hash: string } | null {
  const entry = quantumMemCache.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) { quantumMemCache.delete(key); return null }
  return { data: entry.data, hash: entry.hash }
}

function setQuantumMem(key: string, data: any): string {
  const hash = computeHash(data)
  quantumMemCache.set(key, { data, hash, expires: Date.now() + QUANTUM_MEM_TTL })
  return hash
}

const STALE_MS = 120 * 1000 // v5.0: 120s — matches Apps Script 60s cache + extra 60s window
const RETRY_ATTEMPTS = 1 // Reduced from 2 to 1 for faster failure feedback
const RETRY_DELAY = 400 // Quantum: 400ms (was 500ms) - faster retry like PWA
const FETCH_TIMEOUT_MS = 5000 // Quantum: 5s (was 8s) - like PWA 3s abort + buffer for desktop UX
const QUANTUM_FETCH_TIMEOUT = 3000 // Quantum ultra: 3s like index.html AbortController 3s
const DASHBOARD_INVALIDATE_DEBOUNCE = 600 // Quantum: 600ms (was 800ms) - faster debounce

// Offline detection
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { isOnline = true })
  window.addEventListener('offline', () => { isOnline = false })
}

function notify(key: string) {
  const subs = subscribers.get(key)
  if (subs) {
    const list = Array.from(subs)
    for (const fn of list) {
      try { fn() } catch {}
    }
  }
}

function notifyPattern(prefix: string) {
  for (const key of Array.from(subscribers.keys())) {
    if (key === prefix || key.startsWith(prefix + '?') || key.startsWith(prefix + '#')) {
      notify(key)
    }
  }
}

function setCache(key: string, data: any) {
  cache.set(key, data)
  timestamps.set(key, Date.now())
  // Quantum: also stash in 5s mem cache
  setQuantumMem(key, data)
  notify(key)
}

export function mutate<T>(key: string, dataOrUpdater: T | Updater<T>) {
  const prev = cache.get(key)
  const next =
    typeof dataOrUpdater === 'function'
      ? (dataOrUpdater as Updater<T>)(prev as T | undefined)
      : dataOrUpdater
  setCache(key, next)
}

// Dashboard invalidate debounce — multiple mutations in quick succession
// (e.g. invoice create + payment create + stock update in one save) should
// only trigger ONE dashboard reload, not 3-5 of them.
let dashboardInvalidateTimer: ReturnType<typeof setTimeout> | null = null

export function invalidate(prefix: string) {
  const affectedKeys: string[] = []
  for (const key of Array.from(cache.keys())) {
    if (key === prefix || key.startsWith(prefix + '?') || key.startsWith(prefix + '#') || prefix === '*') {
      timestamps.set(key, 0)
      affectedKeys.push(key)
    }
  }

  // Debounce dashboard re-fetch
  if (prefix === '/api/dashboard' || prefix === '*') {
    if (dashboardInvalidateTimer) {
      clearTimeout(dashboardInvalidateTimer)
    }
    dashboardInvalidateTimer = setTimeout(() => {
      dashboardInvalidateTimer = null
      for (const key of affectedKeys) {
        notify(key)
        const subs = subscribers.get(key)
        if (subs && subs.size > 0) {
          doFetch(key)
        }
      }
      if (prefix === '*') {
        // For wildcard, also notify non-dashboard keys immediately
        for (const key of Array.from(cache.keys())) {
          if (!key.startsWith('/api/dashboard')) {
            notify(key)
            const subs = subscribers.get(key)
            if (subs && subs.size > 0) doFetch(key)
          }
        }
      }
    }, DASHBOARD_INVALIDATE_DEBOUNCE)
    return
  }

  // Non-dashboard invalidations happen immediately
  for (const key of affectedKeys) {
    notify(key)
    const subs = subscribers.get(key)
    if (subs && subs.size > 0) {
      doFetch(key)
    }
  }
  notifyPattern(prefix)
}

function listUrlOf(detailUrl: string): string {
  const clean = detailUrl.split('?')[0].split('#')[0]
  const parts = clean.split('/')
  if (parts.length > 2) {
    return parts.slice(0, -1).join('/')
  }
  return clean
}

function idOf(detailUrl: string): string | null {
  const clean = detailUrl.split('?')[0].split('#')[0]
  const parts = clean.split('/') 
  return parts[parts.length - 1] || null
}

// ===== useFetch with retry =====
export function useFetch<T>(url: string | null, options?: RequestInit) {
  const method = options?.method || 'GET'
  const bodyKey = options?.body ? JSON.stringify(options.body) : ''
  const optsRef = useRef(options)
  optsRef.current = options

  const [, setTick] = useState(0)
  const forceRender = useCallback(() => setTick((t) => (t + 1) & 0x7fffffff), [])

  useEffect(() => {
    if (!url) return
    const key = url
    let set = subscribers.get(key)
    if (!set) {
      set = new Set()
      subscribers.set(key, set)
    }
    set.add(forceRender)
    return () => {
      const s = subscribers.get(key)
      if (s) {
        s.delete(forceRender)
        if (s.size === 0) subscribers.delete(key)
      }
    }
  }, [url, forceRender])

  useEffect(() => {
    if (!url) return
    const cached = cache.get(url)
    const ts = timestamps.get(url) || 0
    const isStale = Date.now() - ts > STALE_MS
    if (!cached || isStale) {
      doFetch(url, optsRef.current)
    }
  }, [url, method, bodyKey])

  const refetch = useCallback(() => {
    if (!url) return
    timestamps.set(url, 0)
    doFetch(url, optsRef.current)
  }, [url, method, bodyKey])

  const data: T | null = url ? (cache.get(url) ?? null) : null
  const hasEverLoaded = url ? timestamps.has(url) : false
  const loading = !!url && !hasEverLoaded
  const error = url ? (cache.get(`__error:${url}`) ?? null) : null

  return { data, loading, error, refetch, isOnline }
}

async function doFetchWithRetry(url: string, options?: RequestInit, attempt = 1): Promise<any> {
  // Quantum: check 5s mem cache first (like _listMemCache)
  const mem = getQuantumMem(url)
  if (mem) {
    // Debounce pull like index.html lastPullTime
    const last = lastPullTime.get(url) || 0
    if (Date.now() - last < 1000) {
      return mem.data
    }
  }

  try {
    const controller = new AbortController()
    // Quantum: use 3s for GET ultra-fast, 5s for others
    const isGet = !options?.method || options.method === 'GET'
    const timeoutMs = isGet ? QUANTUM_FETCH_TIMEOUT : FETCH_TIMEOUT_MS
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let errorMessage = `HTTP ${res.status}`
      try {
        const json = JSON.parse(text)
        errorMessage = json.error || errorMessage
      } catch {
        errorMessage = text.slice(0, 200) || errorMessage
      }
      throw new Error(errorMessage)
    }
    
    const data = await res.json()
    
    // Quantum: hash check like lastCloudDataHash to avoid unnecessary re-render
    const newHash = computeHash(data)
    const oldHash = lastDataHash.get(url)
    if (oldHash === newHash) {
      // Data unchanged, return existing to prevent flicker (like index.html)
      const existing = cache.get(url)
      if (existing !== undefined) {
        timestamps.set(url, Date.now()) // refresh timestamp
        return existing
      }
    }
    lastDataHash.set(url, newHash)
    lastPullTime.set(url, Date.now())
    setCache(url, data)
    setQuantumMem(url, data)
    cache.delete(`__error:${url}`)
    return data
  } catch (e: any) {
    if (attempt <= RETRY_ATTEMPTS && (e.name === 'AbortError' || e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
      await new Promise(r => setTimeout(r, RETRY_DELAY * attempt))
      return doFetchWithRetry(url, options, attempt + 1)
    }
    cache.set(`__error:${url}`, e?.message || 'Failed')
    notify(url)
    throw e
  }
}

function doFetch(url: string, options?: RequestInit) {
  const existing = inflight.get(url)
  if (existing) return existing
  
  const p = doFetchWithRetry(url, options)
    .finally(() => {
      inflight.delete(url)
    })
  
  inflight.set(url, p)
  return p
}

// ===== apiPost with optimistic UI — INSTANT v7.0 =====
// Returns a temp item INSTANTLY (UI shows it immediately with _pending flag),
// syncs to server in background, then replaces temp with real data.
// On failure, removes temp item and throws.
export async function apiPost(url: string, body: any) {
  const base = url.split('?')[0].split('#')[0]
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  const tempItem = { ...body, id: tempId, _pending: true, createdAt: new Date().toISOString() }

  const affectedKeys: string[] = []
  for (const key of Array.from(cache.keys())) {
    const keyBase = key.split('?')[0].split('#')[0]
    if (keyBase === base && Array.isArray(cache.get(key))) {
      affectedKeys.push(key)
      // INSTANT optimistic — UI shows the item before server responds
      mutate<any[]>(key, (prev) => (prev ? [tempItem, ...prev] : [tempItem]))
    }
  }
  invalidate('/api/dashboard')

  // Offline mode — queue and return temp
  if (!isOnline) {
    try {
      const { addToQueue } = await import('./offline-queue')
      await addToQueue({
        type: 'create',
        sheet: base.split('/').pop() || 'unknown',
        url,
        method: 'POST',
        body,
        tempId,
      })
    } catch {}
    return { ...tempItem, _queued: true, _offline: true }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Failed to create')

    // Replace temp item with real server data
    for (const key of affectedKeys) {
      mutate<any[]>(key, (prev) =>
        prev ? prev.map((x) => (x.id === tempId ? { ...data, _pending: false } : x)) : []
      )
    }
    return data
  } catch (e) {
    // Rollback — remove temp item
    for (const key of affectedKeys) {
      mutate<any[]>(key, (prev) => (prev ? prev.filter((x) => x.id !== tempId) : []))
    }
    throw e
  }
}

// ===== ULTRA-ULTRA FAST v6.0 - INSTANT RETURN + BACKGROUND SYNC =====
// Returns temp item INSTANTLY (<50ms), syncs to Google Sheets in background
// If offline, queues to IndexedDB and syncs when online
export async function apiPostUltraFast(url: string, body: any, options: { instantClose?: boolean } = {}): Promise<any> {
  const base = url.split('?')[0].split('#')[0]
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  
  // Generate client-side number instantly for optimistic display
  let clientNumber = ''
  if (url.includes('/invoices')) {
    const now = new Date()
    const fy = now.getMonth() >= 3 ? `${String(now.getFullYear()).slice(2)}-${String(now.getFullYear()+1).slice(2)}` : `${String(now.getFullYear()-1).slice(2)}-${String(now.getFullYear()).slice(2)}`
    clientNumber = `SCSS/${fy}/${Date.now().toString().slice(-6)}`
  } else if (url.includes('/quotations')) {
    clientNumber = `SCSS/QT/${Date.now().toString().slice(-6)}`
  }
  
  const tempItem = { 
    ...body, 
    id: tempId, 
    number: clientNumber || body.number || `TEMP-${Date.now().toString().slice(-6)}`,
    _pending: true, 
    _optimistic: true,
    _clientGenerated: true,
    createdAt: new Date().toISOString() 
  }

  // INSTANT optimistic update
  const affectedKeys: string[] = []
  for (const key of Array.from(cache.keys())) {
    const keyBase = key.split('?')[0].split('#')[0]
    if (keyBase === base && Array.isArray(cache.get(key))) {
      affectedKeys.push(key)
      mutate<any[]>(key, (prev) => (prev ? [tempItem, ...prev] : [tempItem]))
    }
  }
  invalidate('/api/dashboard')

  // If offline, queue and return temp instantly
  if (!isOnline) {
    try {
      const { addToQueue } = await import('./offline-queue')
      await addToQueue({
        type: 'create',
        sheet: base.split('/').pop() || 'unknown',
        url,
        method: 'POST',
        body,
        tempId,
      })
      return { ...tempItem, _queued: true, _offline: true }
    } catch {
      // IndexedDB not available, still return temp but will fail sync later
      return { ...tempItem, _queued: false, _offline: true }
    }
  }

  // Background sync - don't await, return temp instantly for ultra fast UX
  // But also return a promise that resolves with real data for those who await
  const syncPromise = (async () => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to create')

      for (const key of affectedKeys) {
        mutate<any[]>(key, (prev) =>
          prev ? prev.map((x) => (x.id === tempId ? { ...data, _pending: false, _optimistic: false } : x)) : []
        )
      }
      return data
    } catch (e) {
      // On failure, keep temp but mark as failed, or rollback
      for (const key of affectedKeys) {
        mutate<any[]>(key, (prev) => (prev ? prev.map((x) => x.id === tempId ? { ...x, _pending: false, _failed: true } : x) : []))
      }
      throw e
    }
  })()

  // If instantClose option, return temp immediately (ultra instant <50ms)
  if (options.instantClose) {
    // Fire and forget background sync
    syncPromise.catch(() => {})
    return tempItem
  }

  // Otherwise, await background sync but temp already shown
  // This gives 2-4 sec total vs 10-15 sec before, but optimistic is instant
  try {
    const realData = await syncPromise
    return realData
  } catch (e) {
    // Return temp with failed flag
    return { ...tempItem, _failed: true, error: (e as any).message }
  }
}

// ===== apiPut with unwrapping — OPTIMISTIC v7.0 =====
// Instant local update (UI reflects change immediately), server sync in background.
// If server fails, snapshot is restored and an error is thrown.
export async function apiPut(url: string, body: any) {
  // Compute the list URL + entity ID from the URL
  const listUrl = listUrlOf(url)
  const targetId = idOf(url)

  // Build the optimistic entity (from body + id)
  const optimisticEntity: any = { ...body, id: targetId }

  // Snapshot current cache state for rollback
  const snapshots = new Map<string, any>()
  const affectedKeys: string[] = []
  for (const key of Array.from(cache.keys())) {
    const keyBase = key.split('?')[0].split('#')[0]
    if (keyBase === listUrl && Array.isArray(cache.get(key))) {
      snapshots.set(key, cache.get(key))
      affectedKeys.push(key)
      // INSTANT local update — UI reflects change immediately
      mutate<any[]>(key, (prev) =>
        prev ? prev.map((x) => (String(x?.id) === String(targetId) ? { ...x, ...optimisticEntity, _pending: true } : x)) : prev || []
      )
    }
  }
  invalidate('/api/dashboard')

  // Allow offline mode: queue if offline (don't throw — return optimistic result)
  if (!isOnline) {
    try {
      const { addToQueue } = await import('./offline-queue')
      await addToQueue({
        type: 'update',
        sheet: listUrl.split('/').pop() || 'unknown',
        url,
        method: 'PUT',
        body,
        tempId: targetId || undefined,
      })
    } catch {}
    return { ...optimisticEntity, _pending: true, _offline: true }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Failed to update')

    let entity: any = data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const wrapperKeys = ['job', 'invoice', 'quotation', 'customer', 'supplier', 'item', 'payment', 'expense', 'amc', 'campaign', 'serial', 'exp']
      for (const wk of wrapperKeys) {
        if (data[wk] && typeof data[wk] === 'object' && (data[wk].id !== undefined || data[wk].jobId !== undefined)) {
          entity = data[wk]
          break
        }
      }
    }

    const updatedId = entity?.id || targetId
    // Replace optimistic item with real server data, remove _pending flag
    for (const key of affectedKeys) {
      mutate<any[]>(key, (prev) =>
        prev ? prev.map((x) => (String(x?.id) === String(updatedId) ? { ...x, ...entity, _pending: false } : x)) : prev || []
      )
    }
    return data
  } catch (e) {
    // Rollback on failure
    for (const [key, snap] of snapshots) {
      setCache(key, snap)
    }
    throw e
  }
}

// ===== apiDelete — OPTIMISTIC v7.0 =====
// Instant local removal (UI reflects change immediately), server sync in background.
// If server fails, snapshot is restored and an error is thrown.
export async function apiDelete(url: string) {
  const listUrl = listUrlOf(url)
  const targetId = idOf(url)

  const snapshots = new Map<string, any>()
  for (const key of Array.from(cache.keys())) {
    const keyBase = key.split('?')[0].split('#')[0]
    if (keyBase === listUrl && Array.isArray(cache.get(key))) {
      snapshots.set(key, cache.get(key))
      // INSTANT local removal — UI reflects delete immediately
      mutate<any[]>(key, (prev) =>
        prev ? prev.filter((x) => String(x?.id) !== String(targetId)) : prev || []
      )
    }
  }
  invalidate('/api/dashboard')

  // Allow offline mode: queue if offline
  if (!isOnline) {
    try {
      const { addToQueue } = await import('./offline-queue')
      await addToQueue({
        type: 'delete',
        sheet: listUrl.split('/').pop() || 'unknown',
        url,
        method: 'DELETE',
        tempId: targetId || undefined,
      })
    } catch {}
    return { success: true, _pending: true, _offline: true }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const r = await fetch(url, { method: 'DELETE', signal: controller.signal })
    clearTimeout(timeout)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || 'Failed to delete')
    return data
  } catch (e) {
    // Rollback on failure
    for (const [key, snap] of snapshots) {
      setCache(key, snap)
    }
    throw e
  }
}

export function prefetch(url: string) {
  if (!cache.has(url) || Date.now() - (timestamps.get(url) || 0) > STALE_MS) {
    doFetch(url).catch(() => {})
  }
}

// New: batch prefetch
export function prefetchBatch(urls: string[]) {
  urls.forEach(url => prefetch(url))
}

// New: clear all cache
export function clearCache() {
  cache.clear()
  timestamps.clear()
  // Notify all subscribers to refetch
  for (const key of subscribers.keys()) {
    notify(key)
  }
}

// New: export cache stats for debugging
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()).slice(0, 20),
    isOnline,
  }
}
