import { NextRequest, NextResponse } from 'next/server'
import { listRows, isConfigured } from '@/lib/sheets-client'
import { generateImage, listProviders } from '@/lib/image-gen'

/**
 * POST /api/poster/generate
 *
 * AI-powered poster generator for Smart Computers shop advertising.
 *
 * ──────────────────────────────────────────────────────────────────────
 * PROVIDER UPGRADE (v10.1 — 2026-08-03):
 *
 *   OLD: z-ai-web-dev-sdk (GLM-4V-class image gen via Z.AI internal API).
 *        On Render free-tier this reliably failed with "fetch failed" after
 *        10s of cold-start latency, with no fallback. Tried 3 times = 30s
 *        wasted and an angry user.
 *
 *   NEW: Multi-provider fallback chain via /lib/image-gen.ts:
 *        1. Pollinations.ai GET  (free, no API key, returns JPEG bytes)
 *        2. Pollinations.ai POST (same provider, different transport)
 *        3. SVG placeholder      (always works — branded gradient + prompt text)
 *
 *   The user NEVER sees a "Network error" anymore. If both Pollinations
 *   endpoints are down, they get a usable branded placeholder instead of
 *   a red error toast. The `provider` field in the response tells them
 *   which one produced the image.
 * ──────────────────────────────────────────────────────────────────────
 *
 * The endpoint still builds a "super-intelligent" prompt by combining:
 *   1. User's free-text prompt (their vision for the poster)
 *   2. Item name + item details (price, specs, features — auto-injected)
 *   3. Shop branding (name, phone, address, UPI — pulled from Shop sheet)
 *   4. Style preset (Cyberpunk / Minimal / Festive / Neon / Premium etc.)
 *   5. Aspect-ratio-specific composition hints (WhatsApp Status 9:16)
 *   6. Quality boosters (FHD, 2K, ultra-detailed, professional lighting)
 *
 * Output sizes (caller asks for these, Pollinations may auto-downscale):
 *   - whatsapp-status  : 768x1344  (9:16, ideal for WhatsApp Status / Stories)
 *   - instagram-story  : 768x1344  (9:16, same as above)
 *   - square           : 1024x1024 (1:1, Instagram feed / Facebook)
 *   - landscape        : 1344x768  (16:9, YouTube thumbnail / banner)
 *   - wide-banner      : 1440x720  (2:1, website hero / billboard)
 *
 * The response returns a base64-encoded image the client can render directly
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
  /** Optional seed for reproducibility. If omitted, random. */
  seed?: number
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
// Size presets — caller asks for these; Pollinations may auto-downscale.
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
    w: 1440,
    h: 720,
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
// POST handler — uses the multi-provider image-gen library
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
      seed,
    } = body

    if (!prompt?.trim() && !itemName?.trim()) {
      return NextResponse.json(
        { error: 'Either a prompt or an item name is required.' },
        { status: 400 },
      )
    }

    // Load shop branding in parallel (best-effort) — don't need ZAI config anymore!
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
    const w = sizePreset.w
    const h = sizePreset.h

    // Generate the image via the multi-provider fallback chain.
    // Per-attempt timeout is 75s — Pollinations can take 20-40s on slow days.
    const result = await generateImage(
      {
        prompt: superPrompt,
        width: w,
        height: h,
        seed,
        noLogo: true,
        referrer: 'smartcomp.app',
      },
      {
        perAttemptTimeoutMs: 75_000,
        noPlaceholder: false, // Always have a fallback — user never sees a 500
      },
    )

    const elapsedMs = Date.now() - startTime

    // Build the data URL the frontend can render directly
    const dataUrl = result.mime === 'image/svg+xml'
      ? `data:image/svg+xml;base64,${result.base64}`
      : `data:${result.mime};base64,${result.base64}`

    return NextResponse.json({
      success: true,
      image: dataUrl,
      prompt: superPrompt,
      style,
      size,
      // The ACTUAL pixel dimensions of the returned image (Pollinations may
      // auto-downscale, so we report the real dims rather than the requested ones).
      width: result.width || w,
      height: result.height || h,
      requestedWidth: w,
      requestedHeight: h,
      elapsedMs,
      provider: result.provider,
      providerElapsedMs: result.elapsedMs,
      shopBrandingUsed: !!shop && includeShopBranding,
      model: result.provider.startsWith('pollinations')
        ? 'Pollinations.ai (sana, free, no API key)'
        : result.provider.startsWith('svg')
          ? 'SVG Placeholder (all providers failed — using branded fallback)'
          : result.provider,
      isPlaceholder: result.provider.includes('placeholder'),
    })
  } catch (e: any) {
    console.error('[/api/poster/generate] final error:', e?.message)
    return NextResponse.json(
      {
        error: e?.message || 'Failed to generate poster.',
        hint: 'If this persists, the SVG placeholder should have kicked in. If you see this error, all providers failed AND the placeholder generator threw — please report this.',
      },
      { status: 500 },
    )
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET — quick metadata endpoint (lists styles + sizes + providers for the UI)
// ──────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    styles: Object.keys(STYLE_PRESETS),
    sizes: Object.keys(SIZE_PRESETS).map((k) => ({
      id: k,
      ...SIZE_PRESETS[k as PosterSize],
    })),
    providers: listProviders(),
    model: 'Pollinations.ai (sana) — free, no API key, no rate limits',
    fallback: 'SVG placeholder (always works even if all providers fail)',
  })
}
