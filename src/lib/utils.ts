import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function str(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  try {
    return String(v)
  } catch {
    return fallback
  }
}

export function strPath(obj: any, ...keys: string[]): string {
  let cur = obj
  for (const k of keys) {
    if (cur === null || cur === undefined) return ""
    cur = cur[k]
  }
  return str(cur)
}

export function lower(v: unknown): string {
  return str(v).toLowerCase()
}

export function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback
  const n = typeof v === "number" ? v : Number(v)
  return isNaN(n) ? fallback : n
}

export function safeJsonParse<T>(str: unknown, fallback: T): T {
  if (str === null || str === undefined || str === "") return fallback
  try {
    const parsed = JSON.parse(String(str))
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function formatDate(v: unknown, locale = "en-IN"): string {
  if (!v) return ""
  try {
    const d = new Date(v as any)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString(locale)
  } catch {
    return ""
  }
}

export function formatDateTime(v: unknown, locale = "en-IN"): string {
  if (!v) return ""
  try {
    const d = new Date(v as any)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleString(locale)
  } catch {
    return ""
  }
}

// ===== NEW v3.0 HELPERS =====

export function formatRelativeTime(date: string | Date): string {
  try {
    const now = new Date()
    const d = new Date(date)
    const diff = now.getTime() - d.getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return formatDate(date)
  } catch {
    return formatDate(date)
  }
}

export function truncate(str: string, len: number): string {
  if (!str) return ''
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}

export function generateId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 9)
  const time = Date.now().toString(36)
  return `${prefix}${time}${random}`.toUpperCase()
}

export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

export function toCSV(data: any[], headers?: string[]): string {
  if (!data.length) return ''
  const keys = headers || Object.keys(data[0])
  const csvHeaders = keys.join(',')
  const rows = data.map(row => 
    keys.map(key => {
      const val = row[key]
      if (val === null || val === undefined) return ''
      const str = String(val).replace(/"/g, '""')
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
    }).join(',')
  )
  return [csvHeaders, ...rows].join('\n')
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function downloadJSON(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  }
  // Fallback
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return Promise.resolve(true)
  } catch {
    return Promise.resolve(false)
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10))
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0,5)} ${cleaned.slice(5)}`
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+91 ${cleaned.slice(2,7)} ${cleaned.slice(7)}`
  return phone
}

// Group array by key
export function groupBy<T>(arr: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const groupKey = typeof key === 'function' ? key(item) : String((item as any)[key] || 'Unknown')
    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

// Sum by key
export function sumBy<T>(arr: T[], key: keyof T | ((item: T) => number)): number {
  return arr.reduce((sum, item) => {
    const val = typeof key === 'function' ? key(item) : Number((item as any)[key] || 0)
    return sum + (isNaN(val) ? 0 : val)
  }, 0)
}
