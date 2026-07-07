import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely coerce any value to a string. Handles null/undefined/numbers/booleans.
 * Use this before calling .toLowerCase(), .includes(), .replace(), etc. on
 * data that comes from Google Sheets (which can return numbers, booleans, or
 * empty cells for fields that the UI expects to be strings).
 */
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

/**
 * Safely access a nested string field. Usage: strPath(obj, "customer", "name")
 * Returns "" if any level is null/undefined.
 */
export function strPath(obj: any, ...keys: string[]): string {
  let cur = obj
  for (const k of keys) {
    if (cur === null || cur === undefined) return ""
    cur = cur[k]
  }
  return str(cur)
}

/**
 * Safe toLowerCase that never throws.
 */
export function lower(v: unknown): string {
  return str(v).toLowerCase()
}

/**
 * Safe number coercion.
 */
export function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback
  const n = typeof v === "number" ? v : Number(v)
  return isNaN(n) ? fallback : n
}
