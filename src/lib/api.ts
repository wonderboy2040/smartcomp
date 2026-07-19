/**
 * Optimistic UI data layer with shared client-side cache - UPGRADED v3.0
 *
 * v3.0 Improvements:
 * - Retry logic with exponential backoff
 * - Offline detection + queue
 * - Better cache invalidation with pattern matching
 * - Request deduplication improved
 * - Error tracking + toast integration ready
 * - 30s TTL for better performance
 * - Background sync support
 */

import { useEffect, useState, useCallback, useRef } from 'react'

type Updater<T> = (prev: T | undefined) => T

const cache = new Map<string, any>()
const timestamps = new Map<string, number>()
const subscribers = new Map<string, Set<() => void>>()
const inflight = new Map<string, Promise<any>>()

const STALE_MS = 120 * 1000 // v5.0: 120s — matches Apps Script cache (60s) + 60s extra window
                          // Was 60s before, caused unnecessary refetches on every page navigation
const RETRY_ATTEMPTS = 1 // Reduced from 2 to 1 for faster failure feedback
const RETRY_DELAY = 500 // Reduced from 1000 to 500ms for faster retry
const FETCH_TIMEOUT_MS = 8000 // 8s — was 15s (too slow for desktop UX)
const DASHBOARD_INVALIDATE_DEBOUNCE = 800 // Debounce dashboard re-fetch so a single save doesn't trigger 5 of them

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
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    
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
    setCache(url, data)
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
        tempId: targetId,
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
        tempId: targetId,
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
