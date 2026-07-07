import { useEffect, useState, useCallback } from 'react'

export function useFetch<T>(url: string | null, options?: RequestInit) {
  const [state, setState] = useState<{
    data: T | null
    loading: boolean
    error: string | null
  }>({
    data: null,
    loading: !!url,
    error: null,
  })

  const bodyKey = options?.body ? JSON.stringify(options.body) : ''

  const doFetch = useCallback(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    fetch(url, options)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setState({ data: d, loading: false, error: null })
      })
      .catch((e) => {
        setState({ data: null, loading: false, error: e.message || 'Failed' })
      })
  }, [url, bodyKey])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  const refetch = useCallback(() => {
    doFetch()
  }, [doFetch])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}

export async function apiPost(url: string, body: any) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Failed')
  return data
}

export async function apiPut(url: string, body: any) {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Failed')
  return data
}

export async function apiDelete(url: string) {
  const r = await fetch(url, { method: 'DELETE' })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Failed')
  return data
}
