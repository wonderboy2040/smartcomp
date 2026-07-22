'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DocumentHtmlViewer } from '@/components/DocumentHtmlViewer'

interface PreviewApi {
  /** Open the in-app fast HTML preview panel with the given URL or doc parameters. */
  openPreview: (url: string, title?: string, data?: any) => void
  /** Fully close the preview panel. */
  closePreview: () => void
  /** Collapse / expand the preview panel. */
  toggleCollapse: () => void
}

const PreviewContext = createContext<PreviewApi | null>(null)

const NOOP: PreviewApi = {
  openPreview: () => {},
  closePreview: () => {},
  toggleCollapse: () => {},
}

export function usePdfPreview(): PreviewApi {
  return useContext(PreviewContext) ?? NOOP
}

export function PdfPreviewProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null)
  const [title, setTitle] = useState<string>('Document Preview')
  const [docData, setDocData] = useState<any | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const openPreview = useCallback((u: string, t = 'Document Preview', d?: any) => {
    setUrl(u)
    setTitle(t)
    setDocData(d || null)
    setCollapsed(false)
  }, [])

  const closePreview = useCallback(() => {
    setUrl(null)
    setDocData(null)
    setCollapsed(false)
  }, [])

  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), [])

  // Parse docId and docType from url
  const { docId, docType } = React.useMemo(() => {
    if (!url) return { docId: null, docType: 'invoice' }
    try {
      const parsedUrl = new URL(url, 'http://localhost')
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean)
      const id = pathSegments[pathSegments.length - 1] || null
      const type = parsedUrl.searchParams.get('type') || (parsedUrl.pathname.includes('service') ? 'service' : 'invoice')
      return { docId: id, docType: type as 'invoice' | 'quotation' | 'service' }
    } catch {
      return { docId: null, docType: 'invoice' as const }
    }
  }, [url])

  // Close on Escape key
  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url, closePreview])

  const panel =
    mounted && url && docId
      ? createPortal(
          !collapsed ? (
            // Full Overlay Drawer / Modal
            <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="flex-1 w-full max-w-5xl mx-auto my-0 sm:my-4 bg-white shadow-2xl rounded-none sm:rounded-xl overflow-hidden flex flex-col border border-slate-700">
                <DocumentHtmlViewer
                  docId={docId}
                  docType={docType}
                  data={docData}
                  onClose={closePreview}
                />
              </div>
            </div>
          ) : null,
          document.body
        )
      : null

  return (
    <PreviewContext.Provider value={{ openPreview, closePreview, toggleCollapse }}>
      {children}
      {panel}
    </PreviewContext.Provider>
  )
}
