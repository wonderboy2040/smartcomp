/**
 * WhatsApp QR Login — Shared Session Store
 *
 * Single source of truth for QR login sessions. All QR routes import from
 * this file, so they share the same in-memory Map regardless of how
 * Next.js bundles/reloads modules.
 *
 * In Next.js dev mode, route handlers can be re-evaluated on hot reload,
 * which breaks `globalThis` sharing if each route file re-declares its own
 * store. By centralising here with a single `globalThis` key set ONCE,
 * all routes see the same sessions Map.
 */

export interface QrSession {
  sessionId: string
  qrToken: string
  qrPayload: string
  status: 'pending' | 'connected' | 'expired' | 'error'
  phoneNumber?: string
  createdAt: number
  expiresAt: number
  connectedAt?: number
}

const STORE_KEY = '__smartcomp_wa_qr_sessions__'

function getStore(): Map<string, QrSession> {
  // Server-side only — this module is imported by API routes which run on server
  if (typeof globalThis === 'undefined') {
    return new Map<string, QrSession>()
  }
  const g = globalThis as any
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map<string, QrSession>()
  }
  return g[STORE_KEY] as Map<string, QrSession>
}

export const qrSessions = {
  get(sessionId: string): QrSession | undefined {
    return getStore().get(sessionId)
  },
  set(session: QrSession): void {
    getStore().set(session.sessionId, session)
  },
  delete(sessionId: string): boolean {
    return getStore().delete(sessionId)
  },
  has(sessionId: string): boolean {
    return getStore().has(sessionId)
  },
  size(): number {
    return getStore().size
  },
  /** Remove expired sessions to keep memory bounded */
  cleanup(): void {
    const store = getStore()
    const now = Date.now()
    for (const [id, s] of store.entries()) {
      if (s.expiresAt < now) store.delete(id)
    }
  },
  /** Get all sessions (for debugging) */
  all(): QrSession[] {
    return Array.from(getStore().values())
  },
}

export const QR_SESSION_TTL = 5 * 60 * 1000 // 5 min to scan

export function genToken(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
