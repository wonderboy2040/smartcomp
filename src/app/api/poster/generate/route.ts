import { NextRequest, NextResponse } from 'next/server'
import { listRows, isConfigured } from '@/lib/sheets-client'

/**
 * POST /api/poster/generate
 *
 * AI-powered poster generator for Smart Computers shop advertising.
 *
 * ──────────────────────────────────────────────────────────────────────
 * MULTI-PROVIDER IMAGE GENERATION (v9.1.4)
 * ──────────────────────────────────────────────────────────────────────
 * Tries each free, no-auth (or token-based) image generation provider in
 * order until one succeeds:
 *
 *   1. Pollinations.ai / FLUX        — free, no-auth, public IPs (PRIMARY)
 *   2. Pollinations.ai / OpenAI      — same host, "openai" alias
 *   3. Pollinations.ai / SANA        — always works, default model
 *   4. Pollinations.ai / Turbo       — faster fallback
 *   5. Hugging Face / FLUX.1-schnell — free with HF_TOKEN env var
 *
 * ─── Why NOT Gemini / ChatGPT / DALL-E 3? ───
 *
 *   • Google Gemini image gen (Imagen): NO free public API. Requires
 *     Google Cloud project + billing + API key. Even the "free tier"
 *     asks for a credit card.
 *
 *   • OpenAI DALL-E 3: ~$0.04 per image. Pre-paid credits required.
 *
 *   • OpenAI GPT-Image-1 (gpt-4o image gen): ~$0.07 per image.
 *     Pre-paid credits required.
 *
 *   • Midjourney: NO public API at all. Discord-only.
 *
 *   • Stability AI (SDXL) via their own API: Has free tier but
 *     requires account + API key + email verification.
 *
 *   • Adobe Firefly: Paid only.
 *
 *   • z-ai-web-dev-sdk (GLM-class image gen): FREE and works locally,
 *     BUT calls `internal-api.z.ai` which resolves to PRIVATE IP
 *     addresses (172.25.x.x). Render/Vercel/AWS cannot reach private
 *     IPs → "Connect Timeout Error". Only works from inside Z.ai corp
 *     network.
 *
 *   • Groq: Groq is a TEXT-ONLY inference platform (Llama, Mixtral).
 *     It does NOT have an image generation model. Their API is great
 *     for chat/embeddings but cannot generate images.
 *
 * Pollinations.ai is the only free, no-auth, public-IP image gen API
 * that works from any server.
 *
 * ──────────────────────────────────────────────────────────────────────
 * OPTIONAL: Hugging Face FLUX.1-schnell (free, requires free token)
 *
 *   1. Create free account at https://huggingface.co/join
 *   2. Generate a "Read" token at https://huggingface.co/settings/tokens
 *   3. Set HF_TOKEN env var on Render
 *
 * Once set, provider #5 becomes active and you get the highest-quality
 * FLUX.1-schnell images (1024x1024 native, no downscaling).
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
// Size presets — Pollinations preserves aspect ratio
// ──────────────────────────────────────────────────────────────────────

const SIZE_PRESETS: Record<PosterSize, { w: number; h: number; composition: string }> = {
  'whatsapp-status': {
    w: 768,
    h: 1344,
    composition:
      'vertical 9:16 composition, subject centered, large bold headline at top, product hero shot in middle, shop logo and contact info at bottom, leave space for text overlay',
  },
  'instagram-story': {
    w: 768,
    h: 1344,
    composition:
      'vertical 9:16 composition, full-bleed product hero, gradient overlay at bottom for text, swipe-up arrow indicator, story-friendly layout',
  },
  square: {
    w: 1024,
    h: 1024,
    composition:
      'square 1:1 composition, central product focus, balanced negative space, symmetrical layout, feed-optimized',
  },
  landscape: {
    w: 1344,
    h: 768,
    composition:
      'horizontal 16:9 composition, product on left third, headline text on right third, cinematic wide aspect, YouTube thumbnail energy',
  },
  'wide-banner': {
    w: 1920,
    h: 1080,
    composition:
      'ultra-wide 16:9 banner composition, panoramic product display, hero text centered, billboard-scale visual impact',
  },
}

// ──────────────────────────────────────────────────────────────────────
// Shop branding loader
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

  if (userPrompt?.trim()) parts.push(userPrompt.trim())

  if (itemName?.trim()) {
    parts.push(
      `featuring ${itemName.trim()} as the hero product, prominently displayed and well-lit, product shot takes up 40-60% of the frame`,
    )
  }
  if (itemDetails?.trim()) {
    parts.push(`product context: ${itemDetails.trim().slice(0, 300)}`)
  }
  if (itemPrice !== undefined && itemPrice !== '' && Number(itemPrice) > 0) {
    parts.push(`with a visible price tag area showing "Rs. ${itemPrice}" in bold typography`)
  }

  parts.push(stylePreset)
  parts.push(sizePreset.composition)

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

  parts.push(
    'ultra high quality, FHD 1080p clarity, 2K resolution detail, sharp focus, professional commercial advertising poster, vibrant colors, high dynamic range, photorealistic textures, no watermark, no blurry artifacts',
  )

  return parts.join(', ')
}

// ──────────────────────────────────────────────────────────────────────
// Provider implementations
// ──────────────────────────────────────────────────────────────────────

interface ImageGenResult {
  base64: string
  contentType: string
  actualWidth: number
  actualHeight: number
  provider: string
  model: string
}

async function tryPollinations(opts: {
  superPrompt: string
  width: number
  height: number
  model: string
  providerLabel: string
}): Promise<ImageGenResult | null> {
  const { superPrompt, width, height, model, providerLabel } = opts
  const seed = Math.floor(Math.random() * 1000000)
  const encodedPrompt = encodeURIComponent(superPrompt.slice(0, 1500))
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true&seed=${seed}&enhance=true`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), 120000)

  try {
    console.log(`[/api/poster/generate] ${providerLabel} → GET ${url.slice(0, 100)}…`)
    const startMs = Date.now()
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'image/jpeg, image/png, image/*' },
    })
    clearTimeout(timeout)
    const elapsedMs = Date.now() - startMs
    console.log(`[/api/poster/generate] ${providerLabel} response: ${response.status} in ${elapsedMs}ms`)

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<no body>')
      console.warn(`[/api/poster/generate] ${providerLabel} failed: HTTP ${response.status} — ${errorBody.slice(0, 150)}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      console.warn(`[/api/poster/generate] ${providerLabel} returned non-image content-type: ${contentType}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength < 1000) {
      console.warn(`[/api/poster/generate] ${providerLabel} returned suspiciously small image: ${arrayBuffer.byteLength} bytes`)
      return null
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return {
      base64,
      contentType,
      actualWidth: width,
      actualHeight: height,
      provider: 'pollinations.ai',
      model: providerLabel,
    }
  } catch (e: any) {
    clearTimeout(timeout)
    console.warn(`[/api/poster/generate] ${providerLabel} error: ${e?.name} — ${e?.message}`)
    return null
  }
}

async function tryHuggingFace(opts: {
  superPrompt: string
  width: number
  height: number
}): Promise<ImageGenResult | null> {
  const { superPrompt, width, height } = opts
  const token = process.env.HF_TOKEN
  if (!token) return null // HF requires auth

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), 120000)

  try {
    console.log(`[/api/poster/generate] HuggingFace FLUX.1-schnell → POST`)
    const response = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: superPrompt.slice(0, 1000),
        parameters: { width, height },
      }),
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<no body>')
      console.warn(`[/api/poster/generate] HuggingFace failed: HTTP ${response.status} — ${errorBody.slice(0, 150)}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    if (!contentType.startsWith('image/')) return null

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength < 1000) return null

    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return {
      base64,
      contentType,
      actualWidth: width,
      actualHeight: height,
      provider: 'huggingface.co',
      model: 'FLUX.1-schnell',
    }
  } catch (e: any) {
    clearTimeout(timeout)
    console.warn(`[/api/poster/generate] HuggingFace error: ${e?.name} — ${e?.message}`)
    return null
  }
}

async function generateImage(opts: {
  superPrompt: string
  width: number
  height: number
}): Promise<ImageGenResult> {
  const { superPrompt, width, height } = opts

  // Try each provider in order. Each returns null on failure (no throw),
  // so we can fall through to the next one.
  const providers: Array<() => Promise<ImageGenResult | null>> = [
    // 1. Pollinations with FLUX (best quality if available)
    () => tryPollinations({ superPrompt, width, height, model: 'flux', providerLabel: 'Pollinations/flux' }),
    // 2. Pollinations with OpenAI alias (DALL-E 3 equivalent)
    () => tryPollinations({ superPrompt, width, height, model: 'openai', providerLabel: 'Pollinations/openai' }),
    // 3. Pollinations with Turbo (faster)
    () => tryPollinations({ superPrompt, width, height, model: 'turbo', providerLabel: 'Pollinations/turbo' }),
    // 4. Pollinations with default SANA model (always works)
    () => tryPollinations({ superPrompt, width, height, model: 'sana', providerLabel: 'Pollinations/sana' }),
    // 5. Hugging Face FLUX schnell (if HF_TOKEN env var is set)
    () => tryHuggingFace({ superPrompt, width, height }),
  ]

  for (let i = 0; i < providers.length; i++) {
    const result = await providers[i]()
    if (result) {
      console.log(`[/api/poster/generate] ✓ Success with provider ${i + 1}: ${result.provider}/${result.model}`)
      return result
    }
  }

  throw new Error('All image generation providers failed. This is usually a transient network issue — wait 1 minute and try again.')
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

    // Load shop branding (best-effort)
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

    // Generate the image via multi-provider fallback chain
    const result = await generateImage({
      superPrompt,
      width: sizePreset.w,
      height: sizePreset.h,
    })

    const elapsedMs = Date.now() - startTime
    const mimePrefix = result.contentType.includes('png') ? 'data:image/png;base64,' : 'data:image/jpeg;base64,'

    return NextResponse.json({
      success: true,
      image: `${mimePrefix}${result.base64}`,
      prompt: superPrompt,
      style,
      size,
      width: result.actualWidth,
      height: result.actualHeight,
      elapsedMs,
      shopBrandingUsed: !!shop && includeShopBranding,
      model: result.model,
      provider: result.provider,
    })
  } catch (e: any) {
    console.error('[/api/poster/generate] final error:', e?.message)
    return NextResponse.json(
      {
        error: e?.message || 'Failed to generate poster.',
        hint: e?.message?.includes('timed out')
          ? 'The AI model is busy. Wait 1 minute and try again.'
          : e?.message?.includes('Network error')
            ? 'Transient network issue. Wait 30s and retry.'
            : undefined,
      },
      { status: 500 },
    )
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET — quick metadata endpoint (lists styles + sizes + providers for UI)
// ──────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    styles: Object.keys(STYLE_PRESETS),
    sizes: Object.keys(SIZE_PRESETS).map((k) => ({
      id: k,
      ...SIZE_PRESETS[k as PosterSize],
    })),
    providers: [
      { id: 'pollinations-flux', label: 'Pollinations / FLUX (free, no-auth)', default: true },
      { id: 'pollinations-openai', label: 'Pollinations / OpenAI alias (free, no-auth)' },
      { id: 'pollinations-turbo', label: 'Pollinations / Turbo (free, no-auth)' },
      { id: 'pollinations-sana', label: 'Pollinations / SANA (free, no-auth)' },
      { id: 'huggingface-flux', label: 'Hugging Face / FLUX.1-schnell (requires HF_TOKEN env var)' },
    ],
    note: 'Gemini / ChatGPT (DALL-E 3 / GPT-Image-1) are NOT free — they require paid API keys. This endpoint uses Pollinations.ai (free) + optional Hugging Face (free with token) for fallback.',
  })
}
