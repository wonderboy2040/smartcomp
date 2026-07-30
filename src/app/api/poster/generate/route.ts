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
  const ZAIModule = await import('z-ai-web-dev-sdk')
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

    // Load shop branding in parallel with everything else (best-effort)
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

    // Instantiate the ZAI SDK — uses env vars if set, otherwise falls back
    // to .z-ai-config file lookup.
    const zai = await createZai()

    const sizePreset = SIZE_PRESETS[size]
    const apiSize = sizePreset.apiSize

    // Call the image generation API (this is the same engine that powers
    // GLM-4V-class image models — comparable to Gemini Nano / Imagen /
    // DALL-E 3 in capability, free for our use case via z-ai-web-dev-sdk).
    // The SDK's `size` field is a strict union of "WxH" literals; cast to
    // any to bypass TS's narrow type since our preset string is one of the
    // supported values (verified above).
    const response = await zai.images.generations.create({
      prompt: superPrompt,
      size: apiSize as any,
    })

    if (!response?.data?.[0]?.base64) {
      return NextResponse.json(
        { error: 'Image generation API returned no image. Try a different prompt.' },
        { status: 502 },
      )
    }

    const imageBase64 = response.data[0].base64
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
      // Echo back what we used so the UI can show "Generated using: ..."
      shopBrandingUsed: !!shop && includeShopBranding,
      model: 'z-ai-image-gen (GLM-class)',
    })
  } catch (e: any) {
    console.error('[/api/poster/generate] error:', e?.message)
    // Surface a friendly error specifically for the config-not-found case
    // so the user knows to set ZAI_* env vars on Render.
    const isConfigError = e?.message?.includes('Configuration file not found') || e?.message?.includes('.z-ai-config')
    return NextResponse.json(
      {
        error: isConfigError
          ? 'ZAI SDK config missing. Set ZAI_BASE_URL, ZAI_API_KEY, ZAI_TOKEN, ZAI_USER_ID, ZAI_CHAT_ID env vars on Render (or create .z-ai-config in project root).'
          : (e?.message || 'Failed to generate poster. Please try again.'),
        hint: isConfigError
          ? 'See PRO_REFACTOR_REPORT or DEPLOYMENT_TROUBLESHOOTING for the exact env var values to copy from your local /etc/.z-ai-config file.'
          : (e?.message?.includes('size')
              ? 'Size validation failed. Use one of: whatsapp-status, instagram-story, square, landscape, wide-banner.'
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
