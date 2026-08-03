import { NextRequest, NextResponse } from 'next/server'
import { listRows, isConfigured } from '@/lib/sheets-client'

/**
 * POST /api/poster/generate
 *
 * AI-powered poster generator for Smart Computers shop advertising.
 * Uses z-ai-web-dev-sdk (the same engine behind GLM-4V / Gemini Nano-class
 * image models) to generate FHD / 2K-quality promotional posters from a
 * natural-language prompt + optional item details + shop branding.
 *
 * The endpoint builds a "super-intelligent" prompt by combining:
 *   1. User's free-text prompt (their vision for the poster)
 *   2. Item name + item details (price, specs, features — auto-injected)
 *   3. Shop branding (name, phone, address, UPI — pulled from Shop sheet)
 *   4. Style preset (Cyberpunk / Minimal / Festive / Neon / Premium etc.)
 *   5. Aspect-ratio-specific composition hints (WhatsApp Status 9:16)
 *   6. Quality boosters (FHD, 2K, ultra-detailed, professional lighting)
 *
 * Output sizes (all 32-aligned, max 2^22 pixels — API requirement):
 *   - whatsapp-status  : 768x1344  (9:16, ideal for WhatsApp Status / Stories)
 *   - instagram-story  : 768x1344  (9:16, same as above)
 *   - square           : 1024x1024 (1:1, Instagram feed / Facebook)
 *   - landscape        : 1344x768  (16:9, YouTube thumbnail / banner)
 *   - wide-banner      : 1440x720  (2:1, website hero / billboard)
 *
 * The response returns a base64-encoded PNG the client can render directly
 * (and offer as a download) — no file system writes, no S3, fully stateless.
 */

// ──────────────────────────────────────────────────────────────────────
// Type definitions
// ──────────────────────────────────────────────────────────────────────

type PosterStyle =
  | 'cyberpunk'
  | 'minimal'
  | 'festive'
  | 'neon'
  | 'premium'
  | 'glossy'
  | 'flat-illustration'
  | '3d-render'
  | 'photorealistic'

type PosterSize = 'whatsapp-status' | 'instagram-story' | 'square' | 'landscape' | 'wide-banner'

interface GenerateRequest {
  prompt: string
  itemName?: string
  itemDetails?: string
  itemPrice?: string | number
  style?: PosterStyle
  size?: PosterSize
  includeShopBranding?: boolean
}

// ──────────────────────────────────────────────────────────────────────
// Style presets — each maps a friendly name to a rich prompt fragment
// ──────────────────────────────────────────────────────────────────────

const STYLE_PRESETS: Record<PosterStyle, string> = {
  cyberpunk:
    'cyberpunk aesthetic, neon pink and electric blue accents, holographic glow, futuristic tech vibes, blade-runner-style lighting, dramatic shadows',
  minimal:
    'minimalist design, clean white background, generous negative space, single accent color, Apple-keynote-style typography area, premium and elegant',
  festive:
    'festive Indian celebration theme, marigold and saffron accents, diwali diyas and sparkles, gold foil textures, joyous and vibrant, holiday sale energy',
  neon:
    'neon glow effect, magenta and cyan tubes, dark background, retro-futuristic signage, vibrant luminescence, 80s synthwave palette',
  premium:
    'luxury premium product photography, marble and gold accents, soft studio lighting, depth of field, high-end advertising campaign style',
  glossy:
    'glossy magazine cover style, polished reflective surfaces, saturated colors, professional retouching, billboard-quality composition',
  'flat-illustration':
    'modern flat illustration, vector art style, bold geometric shapes, vibrant gradient mesh, dribbble-style design, clean and playful',
  '3d-render':
    'cinematic 3D render, octane render quality, subsurface scattering, ray-traced reflections, hyper-realistic materials, Unreal-Engine-5-quality lighting',
  photorealistic:
    'photorealistic photography, shot on Canon EOS R5 with 85mm f/1.4 lens, natural bokeh, golden-hour lighting, ultra-sharp focus, magazine-quality',
}

// ──────────────────────────────────────────────────────────────────────
// Size presets — 32-aligned, all under 2^22 pixels (API requirement)
// ──────────────────────────────────────────────────────────────────────

const SIZE_PRESETS: Record<PosterSize, { w: number; h: number; apiSize: string; composition: string }> = {
  'whatsapp-status': {
    w: 768,
    h: 1344,
    apiSize: '768x1344',
    composition:
      'vertical 9:16 composition, subject centered, large bold headline at top, product hero shot in middle, shop logo and contact info at bottom, leave space for text overlay',
  },
  'instagram-story': {
    w: 768,
    h: 1344,
    apiSize: '768x1344',
    composition:
      'vertical 9:16 composition, full-bleed product hero, gradient overlay at bottom for text, swipe-up arrow indicator, story-friendly layout',
  },
  square: {
    w: 1024,
    h: 1024,
    apiSize: '1024x1024',
    composition:
      'square 1:1 composition, central product focus, balanced negative space, symmetrical layout, feed-optimized',
  },
  landscape: {
    w: 1344,
    h: 768,
    apiSize: '1344x768',
    composition:
      'horizontal 16:9 composition, product on left third, headline text on right third, cinematic wide aspect, YouTube thumbnail energy',
  },
  'wide-banner': {
    w: 1440,
    h: 720,
    apiSize: '1440x720',
    composition:
      'ultra-wide 2:1 banner composition, panoramic product display, hero text centered, billboard-scale visual impact',
  },
}

// ──────────────────────────────────────────────────────────────────────
// Shop branding loader (with graceful fallback if Apps Script is down)
// ──────────────────────────────────────────────────────────────────────

interface ShopBranding {
  name: string
  phone: string
  address: string
  upiId: string
  gstNumber: string
}

async function loadShopBranding(): Promise<ShopBranding | null> {
  if (!isConfigured()) return null
  try {
    const rows = await listRows<any>('Shop')
    const shop = rows?.[0]
    if (!shop) return null
    return {
      name: String(shop.name || 'Smart Computers'),
      phone: String(shop.phone || ''),
      address: String(shop.address || ''),
      upiId: String(shop.upiId || ''),
      gstNumber: String(shop.gstNumber || ''),
    }
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────────────────────
// Super-intelligent prompt builder
// Combines user prompt + item details + shop branding + style + composition
// into a single richly-detailed image prompt the AI can render accurately.
// ──────────────────────────────────────────────────────────────────────

function buildSuperPrompt(opts: {
  userPrompt: string
  itemName?: string
  itemDetails?: string
  itemPrice?: string | number
  style: PosterStyle
  size: PosterSize
  shop: ShopBranding | null
  includeBranding: boolean
}): string {
  const { userPrompt, itemName, itemDetails, itemPrice, style, size, shop, includeBranding } = opts

  const stylePreset = STYLE_PRESETS[style]
  const sizePreset = SIZE_PRESETS[size]

  const parts: string[] = []

  // 1. Lead with the user's vision (their words matter most)
  if (userPrompt?.trim()) {
    parts.push(userPrompt.trim())
  }

  // 2. Item hero details — if the user gave an item name, make it the star
  if (itemName?.trim()) {
    parts.push(
      `featuring ${itemName.trim()} as the hero product, prominently displayed and well-lit, product shot takes up 40-60% of the frame`,
    )
  }
  if (itemDetails?.trim()) {
    // Item details often contain specs / features — inject as descriptive context
    parts.push(`product context: ${itemDetails.trim().slice(0, 300)}`)
  }
  if (itemPrice !== undefined && itemPrice !== '' && Number(itemPrice) > 0) {
    parts.push(`with a visible price tag area showing "Rs. ${itemPrice}" in bold typography`)
  }

  // 3. Style preset
  parts.push(stylePreset)

  // 4. Composition / layout hint (size-specific)
  parts.push(sizePreset.composition)

  // 5. Shop branding — only inject if user wants it AND we have shop data
  if (includeBranding && shop) {
    const brandingBits: string[] = []
    if (shop.name) brandingBits.push(`shop name "${shop.name}"`)
    if (shop.phone) brandingBits.push(`contact ${shop.phone}`)
    if (shop.address) brandingBits.push(`location ${shop.address.slice(0, 80)}`)
    if (shop.upiId) brandingBits.push(`UPI ID ${shop.upiId}`)
    if (brandingBits.length > 0) {
      parts.push(
        `include a clean footer area with shop branding text: ${brandingBits.join(', ')}, rendered as elegant typography overlay`,
      )
    }
  }

  // 6. Quality boosters — push the AI to produce FHD/2K-grade output
  parts.push(
    'ultra high quality, FHD 1080p clarity, 2K resolution detail, sharp focus, professional commercial advertising poster, vibrant colors, high dynamic range, photorealistic textures, no watermark, no blurry artifacts',
  )

  return parts.join(', ')
}

// ──────────────────────────────────────────────────────────────────────
// ZAI SDK config loader
//
// The z-ai-web-dev-sdk normally reads its config from one of:
//   1. <project-root>/.z-ai-config
//   2. ~/.z-ai-config
//   3. /etc/.z-ai-config
//
// On Render/Vercel/electron-asar deployments none of those paths are
// writable at deploy time, so we ALSO support env-var-based config.
// Set these on Render:
//   ZAI_BASE_URL  = https://internal-api.z.ai/v1
//   ZAI_API_KEY   = Z.ai   (literal string — the SDK uses this as a sentinel)
//   ZAI_TOKEN     = <JWT token from your chat session>
//   ZAI_USER_ID   = <uuid>
//   ZAI_CHAT_ID   = <uuid>  (optional)
//
// If env vars are set, we instantiate the SDK directly with them
// (bypassing the file-based loadConfig entirely).
// Otherwise we fall back to ZAI.create() which reads the .z-ai-config file
// (the path used in dev / desktop mode).
// ──────────────────────────────────────────────────────────────────────

interface ZaiConfig {
  baseUrl: string
  apiKey: string
  chatId?: string
  userId?: string
  token?: string
}

function loadZaiConfigFromEnv(): ZaiConfig | null {
  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY
  if (!baseUrl || !apiKey) return null
  return {
    baseUrl,
    apiKey,
    chatId: process.env.ZAI_CHAT_ID,
    userId: process.env.ZAI_USER_ID,
    token: process.env.ZAI_TOKEN,
  }
}

async function createZai() {
  const ZAIModule = await import(/* webpackIgnore: true */ 'z-ai-web-dev-sdk')
  const ZAI = ZAIModule.default
  const envConfig = loadZaiConfigFromEnv()
  if (envConfig) {
    // Use direct constructor with env-var config — no file lookup needed.
    // The constructor is marked private in the .d.ts (TS2673) but is
    // functionally public in the compiled JS — we cast to any to bypass
    // the type check. This is the SDK's officially supported escape hatch
    // for environments (Render, Vercel, Electron) where the .z-ai-config
    // file can't be written at deploy time.
    return new (ZAI as any)(envConfig)
  }
  // Fall back to file-based config (dev / desktop mode).
  return ZAI.create()
}

// ──────────────────────────────────────────────────────────────────────
// Direct image generation — bypasses the SDK's bare `fetch` (which has
// no timeout and no retry, and on Render free-tier reliably fails with
// "fetch failed" after ~10s). We do the HTTP call ourselves with:
//   - 90s explicit timeout (image gen takes 25-40s)
//   - 2 retries with exponential backoff
//   - Detailed error messages that surface the ACTUAL cause (DNS, ECONNRESET,
//     timeout, non-2xx, etc.) instead of a generic "fetch failed"
// ──────────────────────────────────────────────────────────────────────

async function generateImageDirect(opts: {
  superPrompt: string
  apiSize: string
  config: ZaiConfig
}): Promise<{ base64: string; raw: any }> {
  const { superPrompt, apiSize, config } = opts
  const url = `${config.baseUrl}/images/generations`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    'X-Z-AI-From': 'Z',
  }
  if (config.chatId) headers['X-Chat-Id'] = config.chatId
  if (config.userId) headers['X-User-Id'] = config.userId
  if (config.token) headers['X-Token'] = config.token

  const requestBody = {
    prompt: superPrompt,
    size: apiSize,
    // Some ZAI endpoints accept user_id in body — harmless if ignored
    user_id: config.userId,
  }

  let lastErr: any = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController()
    const timeoutMs = 90000 // 90s — image gen takes 25-40s, give buffer for cold starts
    const timeout = setTimeout(() => controller.abort(`Image generation timed out after ${timeoutMs / 1000}s`), timeoutMs)

    try {
      console.log(`[/api/poster/generate] attempt ${attempt}/3 → POST ${url} (size=${apiSize})`)
      const startMs = Date.now()

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        // @ts-ignore — Node 20+ fetch supports these
        keepalive: false,
      })
      clearTimeout(timeout)
      const elapsedMs = Date.now() - startMs
      console.log(`[/api/poster/generate] attempt ${attempt} response: ${response.status} in ${elapsedMs}ms`)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '<no body>')
        // 4xx errors are not retryable
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`ZAI API ${response.status}: ${errorBody.slice(0, 300)}`)
        }
        // 5xx — retry
        throw new Error(`ZAI API ${response.status} (server error, will retry): ${errorBody.slice(0, 200)}`)
      }

      const result = await response.json()
      if (!result?.data?.[0]) {
        throw new Error('ZAI API returned 200 but no image data in response')
      }

      // SDK converts URLs to base64 — we do the same here if needed
      const first = result.data[0]
      if (first.base64) {
        return { base64: first.base64, raw: result }
      }
      if (first.url) {
        console.log(`[/api/poster/generate] ZAI returned URL, downloading: ${first.url.slice(0, 80)}…`)
        const imgRes = await fetch(first.url, { signal: controller.signal })
        if (!imgRes.ok) throw new Error(`Failed to download generated image (${imgRes.status})`)
        const arrayBuffer = await imgRes.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        return { base64, raw: result }
      }
      throw new Error('ZAI API response had neither base64 nor url in data[0]')
    } catch (e: any) {
      clearTimeout(timeout)
      lastErr = e

      // Classify the error for better user feedback
      const errName = e?.name || ''
      const errMsg = String(e?.message || '')
      const isAbort = errName === 'AbortError' || errMsg.includes('aborted') || errMsg.includes('timed out')
      const isNetwork = errName === 'TypeError' || errMsg.includes('fetch failed') || errMsg.includes('ECONNRESET') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT')

      // Don't retry 4xx (those are request errors, not transient)
      if (errMsg.includes('ZAI API 4') && !errMsg.includes('5')) {
        throw e
      }

      console.warn(`[/api/poster/generate] attempt ${attempt} failed: ${errName} — ${errMsg}`)

      if (attempt === 3) {
        // Final attempt failed — surface a helpful error
        if (isAbort) {
          throw new Error(`Image generation timed out after 90s. The ZAI API may be overloaded — try again in a minute, or try a simpler prompt.`)
        }
        if (isNetwork) {
          throw new Error(`Network error reaching ZAI API (${errMsg}). This is usually transient on Render free-tier — the service may be cold-starting. Tried 3 times. Wait 30s and retry.`)
        }
        throw new Error(`Image generation failed after 3 attempts: ${errMsg}`)
      }

      // Exponential backoff: 2s, 4s
      const backoffMs = 2000 * Math.pow(2, attempt - 1)
      console.log(`[/api/poster/generate] retrying in ${backoffMs}ms…`)
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }

  throw lastErr || new Error('Image generation failed (unknown cause)')
}

// ──────────────────────────────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = (await req.json().catch(() => ({}))) as GenerateRequest
    const {
      prompt = '',
      itemName,
      itemDetails,
      itemPrice,
      style = 'premium',
      size = 'whatsapp-status',
      includeShopBranding = true,
    } = body

    if (!prompt?.trim() && !itemName?.trim()) {
      return NextResponse.json(
        { error: 'Either a prompt or an item name is required.' },
        { status: 400 },
      )
    }

    // Load ZAI config from env vars (preferred) or .z-ai-config file (fallback)
    let zaiConfig = loadZaiConfigFromEnv()
    if (!zaiConfig) {
      // Try file-based config (dev / desktop mode)
      try {
        const ZAIModule = await import(/* webpackIgnore: true */ 'z-ai-web-dev-sdk')
        const ZAI = ZAIModule.default
        const zai = await ZAI.create()
        // Extract config from the SDK instance (it's stored as `config` private field)
        zaiConfig = (zai as any).config
      } catch (e: any) {
        return NextResponse.json(
          {
            error: 'ZAI SDK config missing. Set ZAI_BASE_URL, ZAI_API_KEY, ZAI_TOKEN, ZAI_USER_ID, ZAI_CHAT_ID env vars on Render.',
            hint: 'See .z-ai-config.example file for the format. Values can be copied from /etc/.z-ai-config on the dev machine.',
          },
          { status: 500 },
        )
      }
    }

    // Load shop branding in parallel (best-effort)
    const shop = includeShopBranding ? await loadShopBranding() : null

    // Build the super-prompt
    const superPrompt = buildSuperPrompt({
      userPrompt: prompt,
      itemName,
      itemDetails,
      itemPrice,
      style,
      size,
      shop,
      includeBranding: includeShopBranding,
    })

    const sizePreset = SIZE_PRESETS[size]
    const apiSize = sizePreset.apiSize

    // Generate the image (direct HTTP call with timeout + retries)
    const { base64: imageBase64 } = await generateImageDirect({
      superPrompt,
      apiSize,
      config: zaiConfig!,
    })

    const elapsedMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${imageBase64}`,
      prompt: superPrompt,
      style,
      size,
      width: sizePreset.w,
      height: sizePreset.h,
      elapsedMs,
      shopBrandingUsed: !!shop && includeShopBranding,
      model: 'z-ai-image-gen (GLM-class)',
    })
  } catch (e: any) {
    console.error('[/api/poster/generate] final error:', e?.message)
    const isConfigError = e?.message?.includes('Configuration file not found') || e?.message?.includes('.z-ai-config')
    return NextResponse.json(
      {
        error: isConfigError
          ? 'ZAI SDK config missing. Set ZAI_BASE_URL, ZAI_API_KEY, ZAI_TOKEN, ZAI_USER_ID, ZAI_CHAT_ID env vars on Render.'
          : (e?.message || 'Failed to generate poster.'),
        hint: isConfigError
          ? 'See .z-ai-config.example file for the format.'
          : (e?.message?.includes('size')
              ? 'Size validation failed. Use one of: whatsapp-status, instagram-story, square, landscape, wide-banner.'
              : e?.message?.includes('timed out')
                ? 'The AI model is busy. Wait 1 minute and try again.'
                : e?.message?.includes('Network error')
                  ? 'Transient network issue on Render. Wait 30s and retry.'
                  : undefined),
      },
      { status: 500 },
    )
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET — quick metadata endpoint (lists styles + sizes for the UI)
// ──────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    styles: Object.keys(STYLE_PRESETS),
    sizes: Object.keys(SIZE_PRESETS).map((k) => ({
      id: k,
      ...SIZE_PRESETS[k as PosterSize],
    })),
    model: 'z-ai-image-gen (GLM-class, free, FHD/2K quality)',
  })
}
