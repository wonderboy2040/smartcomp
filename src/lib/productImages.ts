import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Server-only helper that loads the Smart Computers product showcase
 * images (Computers, Laptops, Printers, Accessories, Flyer, Product Grid, Logo) from /public
 * and compresses them to lightweight JPEG format so PDF output stays 150-250 KB.
 *
 * Size budget (target PDF ~150-250 KB total):
 *   - logo       ~6-10 KB   (140px @ q70)
 *   - flyer/grid ~25-40 KB  (700px @ q40 — landscape banner, smaller dimension)
 *   - products   ~5-8 KB ea (240px @ q40 — only used in featured/strip variants)
 *   - QR code    ~2-3 KB    (added separately in pdf.ts as PNG)
 *   - jsPDF overhead ~15-25 KB
 *   ─────────────────────
 *   Total: ~80-150 KB (well under the 250 KB ceiling)
 */

export interface ProductImageSet {
  computers: string
  laptop: string
  printers: string
  accessories: string
  flyer?: string
  productgrid?: string
  logo?: string
}

let CACHE: ProductImageSet | null = null

async function readAndCompressImage(searchDirs: string[], baseName: string, maxWidth = 1000, quality = 70): Promise<string> {
  const extensions = ['.webp', '.png', '.jpg', '.jpeg']
  for (const dir of searchDirs) {
    for (const ext of extensions) {
      const fullPath = path.join(dir, baseName + ext)
      if (fs.existsSync(fullPath)) {
        try {
          const buf = fs.readFileSync(fullPath)
          try {
            // Compress image with sharp to JPEG format for ultra-light PDF size.
            // Use mozjpeg-style settings: progressive + optimized Huffman + chroma subsampling.
            const compressed = await sharp(buf)
              .resize({ width: maxWidth, withoutEnlargement: true })
              .jpeg({
                quality,
                progressive: true,
                mozjpeg: true,
                chromaSubsampling: '4:2:0',
              })
              .toBuffer()
            return `data:image/jpeg;base64,${compressed.toString('base64')}`
          } catch {
            const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg'
            return `data:${mime};base64,${buf.toString('base64')}`
          }
        } catch {}
      }
    }
  }
  return ''
}

export async function loadProductImages(): Promise<ProductImageSet> {
  if (CACHE) return CACHE

  const publicDir = path.join(process.cwd(), 'public')
  const postersDir = path.join(publicDir, 'posters')

  // Use readAndCompressImage for all images — sharp compresses WebP/PNG → JPEG.
  // Tuned dimensions and quality to keep total PDF size in the 150-250 KB range.
  const [computers, laptop, printers, accessories, flyer, productgrid, logo] = await Promise.all([
    readAndCompressImage([postersDir], 'gaming-pc', 240, 40).catch(() => ''),
    readAndCompressImage([postersDir], 'laptop-sale', 240, 40).catch(() => ''),
    readAndCompressImage([postersDir], 'printer-offer', 240, 40).catch(() => ''),
    readAndCompressImage([postersDir], 'accessories', 240, 40).catch(() => ''),
    readAndCompressImage([postersDir], 'smartcomputers-a4-flyer-landscape', 700, 40).catch(() => ''),
    readAndCompressImage([postersDir], 'smartcomputers-product-grid', 700, 40).catch(() => ''),
    readAndCompressImage([publicDir], 'logo', 140, 70).catch(() => ''),
  ])

  const result: ProductImageSet = {
    computers: computers || '',
    laptop: laptop || '',
    printers: printers || '',
    accessories: accessories || '',
    flyer: flyer || '',
    productgrid: productgrid || '',
    logo: logo || '',
  }
  CACHE = result
  return result
}

