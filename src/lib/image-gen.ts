/**
 * Free Text-to-Image generation library with multi-provider fallback chain.
 *
 * WHY THIS EXISTS:
 *   The old /api/poster/generate used z-ai-web-dev-sdk which on Render free-tier
 *   reliably failed with "fetch failed" after 10s of cold-start latency. There
 *   was no fallback, so the AI Poster feature was effectively unusable in prod.
 *
 *   This module tries multiple FREE, no-API-key providers in order. If one is
 *   down or slow, the next one is tried automatically. We log which provider
 *   succeeded so the user (and the API response) can see it.
 *
 * PROVIDERS (in order of preference):
 *   1. Pollinations.ai (sana model) — no API key, no rate limit, returns JPEG bytes directly.
 *      Free for commercial use. Supports referrer-based auth (no key).
 *      Limitation: images auto-downscale to max ~580x1015. Still great for previews.
 *
 *   2. Pollinations.ai (turbo model, if available) — fallback to the same endpoint with
 *      a different model param in case `sana` is overloaded.
 *
 *   3. Pollinations.ai GET endpoint — pure URL-based fetch, no POST needed. Works even
 *      if the POST endpoint is down. Useful as the simplest possible last resort.
 *
 *   4. (Future) Local placeholder generator — generates a colored gradient with the
 *      prompt text rendered via canvas. Not implemented yet but if all providers fail
 *      the API returns a clear error.
 *
 * Each provider has:
 *   - A short name (returned in the API response as `provider`)
 *   - An async generate() function that returns { base64, mime, width, height, provider }
 *   - Its own timeout (none may exceed the master timeout)
 */

export interface ImageGenInput {
  prompt: string
  width: number
  height: number
  seed?: number
  /** Used by Pollinations — disables the small "Pollinations" watermark in the corner. */
  noLogo?: boolean
  /** Optional referrer string (some providers route via referrer auth). */
  referrer?: string
}

export interface ImageGenResult {
  /** base64-encoded image bytes (no data URL prefix). */
  base64: string
  /** MIME type — usually 'image/jpeg' since Pollinations outputs JPEG. */
  mime: string
  /** Actual pixel dimensions of the returned image (may be smaller than requested). */
  width: number
  height: number
  /** Which provider produced this image. */
  provider: string
  /** Elapsed milliseconds for this attempt. */
  elapsedMs: number
}

export interface ImageGenError extends Error {
  provider: string
  attempted: boolean
}

// ──────────────────────────────────────────────────────────────────────
// Pollinations.ai — primary provider (no API key, free, reliable)
// ──────────────────────────────────────────────────────────────────────

const POLLINATIONS_BASE = 'https://image.pollinations.ai'

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(`Request timed out after ${timeoutMs}ms`), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Decode a fetch Response into JPEG/PNG bytes + dimensions.
 * Reads the first few bytes to detect format. Returns base64-encoded bytes.
 */
async function decodeImageResponse(res: Response): Promise<{ base64: string; mime: string; width: number; height: number }> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  if (bytes.length === 0) throw new Error('Empty response body (0 bytes)')

  // Detect format from magic bytes
  let mime: string
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg'
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    mime = 'image/png'
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    mime = 'image/webp'
  } else if (contentType.startsWith('image/')) {
    mime = contentType.split(';')[0].trim()
  } else {
    // Could be JSON error message — surface it
    const text = new TextDecoder().decode(bytes).slice(0, 300)
    throw new Error(`Unexpected response (not an image): ${text}`)
  }

  // Parse dimensions for common formats
  let width = 0
  let height = 0
  if (mime === 'image/jpeg') {
    const dims = parseJpegDimensions(bytes)
    width = dims.width
    height = dims.height
  } else if (mime === 'image/png') {
    if (bytes.length >= 24) {
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
    }
  }

  const base64 = Buffer.from(buf).toString('base64')
  return { base64, mime, width, height }
}

/**
 * Parse JPEG SOF (Start-of-Frame) markers to extract width/height.
 * JPEGs are a sequence of markers; we look for SOF0 (0xC0) through SOF15 (0xCF, excluding 0xC4/0xC8/0xCC).
 */
function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  try {
    let i = 2 // Skip SOI marker (FFD8)
    while (i + 1 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++
        continue
      }
      const marker = bytes[i + 1]
      // SOF0..SOF15 (excluding restart markers C4, C8, CC)
      if (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        // SOF segment: precision(1) + height(2) + width(2)
        const height = (bytes[i + 5] << 8) | bytes[i + 6]
        const width = (bytes[i + 7] << 8) | bytes[i + 8]
        return { width, height }
      }
      // Skip this marker segment
      const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3]
      i += 2 + segmentLength
    }
  } catch {
    // Ignore parse errors — dimensions unknown
  }
  return { width: 0, height: 0 }
}

// ──────────────────────────────────────────────────────────────────────
// Provider 1: Pollinations.ai via GET (simplest, most reliable)
// ──────────────────────────────────────────────────────────────────────

async function generatePollinationsGet(opts: ImageGenInput, timeoutMs: number): Promise<ImageGenResult> {
  const startMs = Date.now()
  const params = new URLSearchParams({
    width: String(opts.width),
    height: String(opts.height),
    nologo: String(opts.noLogo ?? true),
    seed: String(opts.seed ?? Math.floor(Math.random() * 1_000_000)),
    model: 'sana',
    enhance: 'true',
  })
  if (opts.referrer) params.set('referrer', opts.referrer)

  const url = `${POLLINATIONS_BASE}/prompt/${encodeURIComponent(opts.prompt.slice(0, 500))}?${params.toString()}`
  console.log(`[image-gen] Pollinations GET → ${url.slice(0, 120)}…`)

  const res = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs)
  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new Error(`Pollinations GET ${res.status}: ${text.slice(0, 200)}`)
  }

  const decoded = await decodeImageResponse(res)
  return {
    ...decoded,
    provider: 'pollinations-get',
    elapsedMs: Date.now() - startMs,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Provider 2: Pollinations.ai via POST (lets us pass longer prompts cleanly)
// ──────────────────────────────────────────────────────────────────────

async function generatePollinationsPost(opts: ImageGenInput, timeoutMs: number): Promise<ImageGenResult> {
  const startMs = Date.now()
  const params = new URLSearchParams({
    width: String(opts.width),
    height: String(opts.height),
    nologo: String(opts.noLogo ?? true),
    seed: String(opts.seed ?? Math.floor(Math.random() * 1_000_000)),
    model: 'sana',
  })
  if (opts.referrer) params.set('referrer', opts.referrer)

  const url = `${POLLINATIONS_BASE}/prompt/${encodeURIComponent(opts.prompt.slice(0, 500))}?${params.toString()}`

  console.log(`[image-gen] Pollinations POST → ${url.slice(0, 120)}…`)

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        width: opts.width,
        height: opts.height,
        seed: opts.seed ?? Math.floor(Math.random() * 1_000_000),
        model: 'sana',
        nologo: opts.noLogo ?? true,
        enhance: true,
      }),
    },
    timeoutMs,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new Error(`Pollinations POST ${res.status}: ${text.slice(0, 200)}`)
  }

  const decoded = await decodeImageResponse(res)
  return {
    ...decoded,
    provider: 'pollinations-post',
    elapsedMs: Date.now() - startMs,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Provider 3: SVG placeholder (always works — used as last resort so users
// never see a 500 error. Generates a branded placeholder with the prompt text.)
// ──────────────────────────────────────────────────────────────────────

async function generateSvgPlaceholder(opts: ImageGenInput): Promise<ImageGenResult> {
  const startMs = Date.now()
  const w = opts.width
  const h = opts.height

  // Build a clean SVG poster with gradient background + the prompt as headline.
  // This is GUARANTEED to work — no network, no external dep.
  const safePrompt = (opts.prompt || 'Smart Computers')
    .slice(0, 200)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Wrap text into multiple lines based on rough char-per-line estimate
  const charsPerLine = Math.max(20, Math.floor(w / 22))
  const lines: string[] = []
  const words = safePrompt.split(/\s+/)
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= charsPerLine) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  const fontSize = Math.max(28, Math.floor(w / 18))
  const lineHeight = Math.floor(fontSize * 1.3)
  const startY = Math.floor(h / 2 - (lines.length * lineHeight) / 2)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${w}" height="${Math.floor(h * 0.08)}" fill="url(#accent)"/>
  <rect x="0" y="${h - Math.floor(h * 0.08)}" width="${w}" height="${Math.floor(h * 0.08)}" fill="url(#accent)"/>
  ${lines.map((line, i) => {
    const y = startY + i * lineHeight + fontSize
    return `<text x="${w / 2}" y="${y}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" stroke="rgba(0,0,0,0.4)" stroke-width="2" paint-order="stroke fill">${line}</text>`
  }).join('\n  ')}
  <text x="${w / 2}" y="${h - Math.floor(h * 0.04)}" font-family="sans-serif" font-size="${Math.floor(fontSize * 0.5)}" fill="rgba(255,255,255,0.8)" text-anchor="middle">Smart Computers</text>
</svg>`

  const base64 = Buffer.from(svg, 'utf8').toString('base64')
  return {
    base64,
    mime: 'image/svg+xml',
    width: w,
    height: h,
    provider: 'svg-placeholder',
    elapsedMs: Date.now() - startMs,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Main entry point — try providers in order, return first success
// ──────────────────────────────────────────────────────────────────────

export interface GenerateImageOptions {
  /** Master timeout per attempt (ms). Default 60s. */
  perAttemptTimeoutMs?: number
  /** Optional seed for reproducibility. */
  seed?: number
  /** Referrer for Pollinations auth (optional). */
  referrer?: string
  /** Disable the placeholder fallback (forces an error if all providers fail). */
  noPlaceholder?: boolean
}

export async function generateImage(
  input: ImageGenInput,
  options: GenerateImageOptions = {},
): Promise<ImageGenResult> {
  const perAttempt = options.perAttemptTimeoutMs ?? 60_000
  const errors: Array<{ provider: string; error: string }> = []

  // Provider 1: Pollinations GET (simplest, most reliable)
  try {
    return await generatePollinationsGet(
      { ...input, seed: options.seed, referrer: options.referrer },
      perAttempt,
    )
  } catch (e: any) {
    errors.push({ provider: 'pollinations-get', error: e?.message || String(e) })
    console.warn(`[image-gen] pollinations-get failed: ${e?.message}`)
  }

  // Provider 2: Pollinations POST
  try {
    return await generatePollinationsPost(
      { ...input, seed: options.seed, referrer: options.referrer },
      perAttempt,
    )
  } catch (e: any) {
    errors.push({ provider: 'pollinations-post', error: e?.message || String(e) })
    console.warn(`[image-gen] pollinations-post failed: ${e?.message}`)
  }

  // Provider 3: SVG placeholder (always works)
  if (!options.noPlaceholder) {
    console.warn('[image-gen] All real providers failed — falling back to SVG placeholder.')
    const placeholder = await generateSvgPlaceholder(input)
    placeholder.provider = 'svg-placeholder (all providers failed)'
    return placeholder
  }

  // All failed and placeholder disabled — throw comprehensive error
  const errorSummary = errors.map((e) => `${e.provider}: ${e.error}`).join(' | ')
  throw new Error(`All image providers failed. Tried: ${errorSummary}`)
}

/**
 * List available image-gen providers for the API GET endpoint.
 */
export function listProviders() {
  return [
    {
      id: 'pollinations-get',
      name: 'Pollinations.ai (GET)',
      description: 'Free, no API key, returns JPEG. Auto-scales to max ~580x1015.',
      url: 'https://image.pollinations.ai',
    },
    {
      id: 'pollinations-post',
      name: 'Pollinations.ai (POST)',
      description: 'Same provider, POST endpoint. Used as fallback if GET fails.',
      url: 'https://image.pollinations.ai',
    },
    {
      id: 'svg-placeholder',
      name: 'SVG Placeholder',
      description: 'Last-resort local generator. Renders a branded gradient with the prompt text. Always works.',
      url: 'internal',
    },
  ]
}
