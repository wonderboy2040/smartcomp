'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, Eye, Download, ExternalLink } from 'lucide-react'

interface PreviewApi {
  /** Open the in-app side preview panel with the given URL (e.g. /api/doc-html/...). */
  openPreview: (url: string, title?: string) => void
  /** Fully close the preview panel. */
  closePreview: () => void
  /** Collapse / expand the side panel (hide without losing the document). */
  toggleCollapse: () => void
}

const PreviewContext = createContext<PreviewApi | null>(null)

/**
 * Safe no-op fallback so any component can call the hooks even if, for some
 * reason, it is rendered outside the provider (prevents runtime crashes).
 */
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
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const openPreview = useCallback((u: string, t = 'Document Preview') => {
    setUrl(u)
    setTitle(t)
    setCollapsed(false)
  }, [])

  const closePreview = useCallback(() => {
    setUrl(null)
    setCollapsed(false)
  }, [])

  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), [])

  // Close on Escape for convenience.
  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url, closePreview])

  const panel =
    mounted && url
      ? createPortal(
          url && !collapsed ? (
            // ===== Full side panel (right drawer) =====
            <div
              className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[560px] flex-col border-l border-border bg-card shadow-2xl"
              style={{ height: '100dvh' }}
            >
              <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3">
                <Eye className="h-4 w-4 text-primary" />
                <span className="flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  aria-label="Open in new tab"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={url}
                  download
                  title="Download"
                  aria-label="Download document"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={toggleCollapse}
                  title="Hide panel"
                  aria-label="Hide preview panel"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={closePreview}
                  title="Close"
                  aria-label="Close preview"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe
                src={url}
                title={title}
                className="w-full flex-1 border-0 bg-white"
              />
            </div>
          ) : (
            // ===== Collapsed tab (click to re-open) =====
            <button
              onClick={toggleCollapse}
              title="Show preview"
              aria-label="Show preview"
              className="fixed right-0 top-1/2 z-[70] flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl bg-primary px-2 py-4 text-primary-foreground shadow-xl"
              style={{ writingMode: 'vertical-rl' }}
            >
              <Eye className="h-4 w-4" />
              <span className="text-[10px] font-semibold">Preview</span>
            </button>
          ),
          document.body,
        )
      : null

  return (
    <PreviewContext.Provider value={{ openPreview, closePreview, toggleCollapse }}>
      {children}
      {panel}
    </PreviewContext.Provider>
  )
}
