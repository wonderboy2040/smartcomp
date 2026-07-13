/**
 * Optimistic UI data layer with a shared client-side cache.
 *
 * PERFORMANCE:
 *   - useFetch() returns cached data INSTANTLY on re-mount / re-render.
 *   - After apiPost / apiPut / apiDelete, the relevant cache entries are
 *     updated optimistically so the UI reflects changes without waiting for
 *     a full refetch round-trip to Google Apps Script.
 *   - DELETE is truly optimistic: the item disappears from the UI before the
 *     server even responds. If the server fails, the change is rolled back.
 *
 * This keeps the same function signatures (useFetch / apiPost / apiPut /
 * apiDelete / refetch) so every existing panel works unchanged but feels
 * dramatically faster.
 */

import { useEffect, useState, useCallback, useRef } from 'react'

// ===== GLOBAL CACHE + SUBSCRIBERS =====
type Updater<T> = (prev: T | undefined) => T

const cache = new Map<string, any>()
const timestamps = new Map<string, number>()
const subscribers = new Map<string, Set<() => void>>()
const inflight = new Map<string, Promise<any>>()

const STALE_MS = 20 * 1000 // data is considered fresh for 20s; older data triggers background refetch.
// This works with the server-side 30s cache: the client won't even ask for
// new data for 20s, and the server caches for 30s. Combined, this means
// Apps Script is only hit every ~30s instead of on every render.

function notify(key: string) {
  const subs = subscribers.get(key)
  if (subs) {
    // Iterate over a copy so unsubscribing during iteration doesn't skip entries.
    const list = Array.from(subs)
    for (const fn of list) {
      try { fn() } catch {}
    }
  }
}

function notifyPattern(prefix: string) {
  // Notify all subscribers whose key starts with prefix (handles query-string variants)
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

/** Invalidate (force refetch on next mount) all cache entries matching a prefix.
 *  Also immediately triggers background refetch for any mounted component
 *  subscribed to the affected keys, so the UI updates without requiring a
 *  tab switch or manual refresh. */
export function invalidate(prefix: string) {
  const affectedKeys: string[] = []
  for (const key of Array.from(cache.keys())) {
    if (key === prefix || key.startsWith(prefix + '?') || key.startsWith(prefix + '#') || prefix === '*') {
      timestamps.set(key, 0) // mark stale
      affectedKeys.push(key)
    }
  }
  // Notify subscribers (causes re-render) AND trigger background refetch
  // for each affected key so fresh data is fetched immediately.
  for (const key of affectedKeys) {
    notify(key)
    // Only refetch if a component is actually subscribed (otherwise it's
    // pointless — it'll refetch on next mount anyway)
    const subs = subscribers.get(key)
    if (subs && subs.size > 0) {
      doFetch(key)
    }
  }
  notifyPattern(prefix)
}

/** Derive the list URL from a detail URL.  /api/items/123  ->  /api/items */
function listUrlOf(detailUrl: string): string {
  const clean = detailUrl.split('?')[0].split('#')[0]
  const parts = clean.split('/')
  // drop the last segment if it looks like an id (non-empty, no equals sign)
  if (parts.length > 2) {
    return parts.slice(0, -1).join('/')
  }
  return clean
}

/** Extract the id from a detail URL.  /api/items/123  ->  123 */
function idOf(detailUrl: string): string | null {
  const clean = detailUrl.split('?')[0].split('#')[0]
  const parts = clean.split('/')
  return parts[parts.length - 1] || null
}

// ===== useFetch =====
export function useFetch<T>(url: string | null, options?: RequestInit) {
  // Only depend on URL + method + body for refetch decisions — not on the
  // whole options object (which changes every render if the caller creates
  // a fresh object inline, causing an infinite refetch loop).
  const method = options?.method || 'GET'
  const bodyKey = options?.body ? JSON.stringify(options.body) : ''
  const optsRef = useRef(options)
  optsRef.current = options

  const [, setTick] = useState(0)
  const forceRender = useCallback(() => setTick((t) => (t + 1) & 0x7fffffff), [])

  // Subscribe to cache changes for this url
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
        // Free the set if no subscribers remain — prevents memory leak
        // when many distinct URLs are visited and unmounted over time.
        if (s.size === 0) {
          subscribers.delete(key)
        }
      }
    }
  }, [url, forceRender])

  // Trigger fetch on mount / url change
  useEffect(() => {
    if (!url) return
    const cached = cache.get(url)
    const ts = timestamps.get(url) || 0
    const isStale = Date.now() - ts > STALE_MS

    if (!cached || isStale) {
      // Background fetch (don't clear existing cached data while loading)
      doFetch(url, optsRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, bodyKey])

  const refetch = useCallback(() => {
    if (!url) return
    // Force a fresh fetch bypassing cache
    timestamps.set(url, 0)
    doFetch(url, optsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, bodyKey])

  const data: T | null = url ? (cache.get(url) ?? null) : null
  const hasEverLoaded = url ? timestamps.has(url) : false
  const loading = !!url && !hasEverLoaded
  const error = url ? (cache.get(`__error:${url}`) ?? null) : null

  return { data, loading, error, refetch }
}

function doFetch(url: string, options?: RequestInit) {
  const existing = inflight.get(url)
  if (existing) return existing
  const p = fetch(url, options)
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setCache(url, d)
      cache.delete(`__error:${url}`)
      return d
    })
    .catch((e) => {
      // Don't overwrite existing cached data on error — keep stale data visible
      cache.set(`__error:${url}`, e?.message || 'Failed')
      notify(url)
      throw e
    })
    .finally(() => {
      inflight.delete(url)
    })
  inflight.set(url, p)
  return p
}

// ===== apiPost (CREATE) — FIRE-AND-FORGET OPTIMISTIC =====
// UI updates INSTANTLY with a temp ID. Server call runs in background.
// If server fails, the temp item is removed and error is shown.
export async function apiPost(url: string, body: any) {
  const base = url.split('?')[0].split('#')[0]
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  const tempItem = { ...body, id: tempId, _pending: true }

  // INSTANT: prepend temp item to all cached lists
  const affectedKeys: string[] = []
  for (const key of Array.from(cache.keys())) {
    const keyBase = key.split('?')[0].split('#')[0]
    if (keyBase === base && Array.isArray(cache.get(key))) {
      affectedKeys.push(key)
      mutate<any[]>(key, (prev) => (prev ? [tempItem, ...prev] : [tempItem]))
    }
  }
  invalidate('/api/dashboard')

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Failed')

    // Replace temp item with real data in all caches
    for (const key of affectedKeys) {
      mutate<any[]>(key, (prev) =>
        prev ? prev.map((x) => (x.id === tempId ? { ...data, _pending: false } : x)) : prev
      )
    }
    return data
  } catch (e) {
    // Remove temp item on failure
    for (const key of affectedKeys) {
      mutate<any[]>(key, (prev) => prev ? prev.filter((x) => x.id !== tempId) : prev)
    }
    throw e
  }
}

// ===== apiPut (UPDATE) =====
// After a successful update, replace the matching item in every cached list.
// Handles both direct-object responses (`{ id, ...fields }`) and wrapped
// responses (`{ success: true, job: { id, ...fields } }`) used by some
// routes like /api/jobs/[id].
export async function apiPut(url: string, body: any) {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Failed')

  // Unwrap { success: true, job/invoice/...: {...} } if present.
  // Some routes (e.g. /api/jobs/[id]) wrap the updated entity in a `job`,
  // `invoice`, `quotation`, etc. field. Detect and unwrap so the cache gets
  // the entity itself, not the wrapper.
  let entity: any = data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const wrapperKeys = ['job', 'invoice', 'quotation', 'customer', 'supplier', 'item', 'payment', 'expense', 'amc', 'campaign']
    for (const wk of wrapperKeys) {
      if (data[wk] && typeof data[wk] === 'object' && (data[wk].id !== undefined || data[wk].jobId !== undefined)) {
        entity = data[wk]
        break
      }
    }
  }

  const listUrl = listUrlOf(url)
  const updatedId = entity?.id || idOf(url)
  for (const key of Array.from(cache.keys())) {
    const keyBase = key.split('?')[0].split('#')[0]
    if (keyBase === listUrl && Array.isArray(cache.get(key))) {
      mutate<any[]>(key, (prev) =>
        prev ? prev.map((x) => (String(x?.id) === String(updatedId) ? { ...x, ...entity } : x)) : prev || []
      )
    }
  }
  invalidate('/api/dashboard')
  return data
}

// ===== apiDelete (TRUE OPTIMISTIC with rollback) =====
// The item disappears from the UI INSTANTLY, before the server responds.
// If the server call fails, the item is restored.
export async function apiDelete(url: string) {
  const listUrl = listUrlOf(url)
  const targetId = idOf(url)

  // Snapshot all affected caches for potential rollback
  const snapshots = new Map<string, any>()
  for (const key of Array.from(cache.keys())) {
    const keyBase = key.split('?')[0].split('#')[0]
    if (keyBase === listUrl && Array.isArray(cache.get(key))) {
      snapshots.set(key, cache.get(key))
      mutate<any[]>(key, (prev) =>
        prev ? prev.filter((x) => String(x?.id) !== String(targetId)) : prev || []
      )
    }
  }

  try {
    const r = await fetch(url, { method: 'DELETE' })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || 'Failed')
    invalidate('/api/dashboard')
    return data
  } catch (e) {
    // Rollback: restore the snapshots
    for (const [key, snap] of snapshots) {
      setCache(key, snap)
    }
    throw e
  }
}

// ===== helper: prefetch a URL (warms the cache) =====
export function prefetch(url: string) {
  if (!cache.has(url) || Date.now() - (timestamps.get(url) || 0) > STALE_MS) {
    // Don't throw on prefetch errors — they'd surface as unhandled rejections.
    doFetch(url).catch(() => {})
  }
}
