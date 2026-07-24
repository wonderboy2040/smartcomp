/**
 * Runtime config — single source of truth for APPS_SCRIPT_URL and APP_PIN
 *
 * Why this exists:
 *   Cloud deployments (Vercel / Render / Onrender) set APPS_SCRIPT_URL and
 *   APP_PIN as environment variables at build/deploy time.
 *
 *   The Electron desktop .exe CANNOT bake these in at build time (each user
 *   has their own Google Sheet). So at runtime, Electron writes a small JSON
 *   file to %APPDATA%/smartcomp/config.json and points SMARTCOMP_CONFIG_PATH
 *   at it. This module reads that file (with a 5s TTL) so the Next.js server
 *   picks up changes made via the desktop app's settings panel without a
 *   restart.
 *
 *   Env vars (when present) ALWAYS win — this preserves existing cloud
 *   behaviour and lets the same code run on web + desktop unchanged.
 */

interface RuntimeConfig {
  appsScriptUrl?: string
  appPin?: string
}

let cache: RuntimeConfig | null = null
let loadedAt = 0
const TTL = 5 * 1000 // re-read every 5s

function read(): RuntimeConfig {
  const now = Date.now()
  if (cache && now - loadedAt < TTL) return cache

  const path = process.env.SMARTCOMP_CONFIG_PATH
  if (!path) {
    cache = {}
  } else {
    try {
      const fs = require('fs')
      if (fs.existsSync(path)) {
        const raw = fs.readFileSync(path, 'utf-8')
        const parsed = JSON.parse(raw) as RuntimeConfig
        cache = {
          appsScriptUrl: parsed.appsScriptUrl?.trim() || undefined,
          appPin: parsed.appPin?.trim() || undefined,
        }
      } else {
        cache = {}
      }
    } catch {
      cache = {}
    }
  }
  loadedAt = now
  return cache
}

export function getAppsScriptUrl(): string | undefined {
  if (process.env.APPS_SCRIPT_URL) return process.env.APPS_SCRIPT_URL
  return read().appsScriptUrl
}

export function getAppPin(): string | undefined {
  if (process.env.APP_PIN) return process.env.APP_PIN
  return read().appPin
}

export function clearRuntimeConfigCache(): void {
  cache = null
  loadedAt = 0
}
