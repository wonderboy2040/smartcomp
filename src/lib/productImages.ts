import fs from 'node:fs'
import path from 'node:path'

/**
 * Server-only helper that loads the Smart Computers product showcase
 * images (Computers, Laptops, Printers, Accessories, Flyer, Product Grid, Logo) from /public
 * and returns them as base64 data URLs for embedding into the PDF/HTML.
 * Supports both .webp and .png formats with automatic fallback.
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

function readImageAsDataUrl(searchDirs: string[], baseName: string): string {
  const extensions = ['.webp', '.png', '.jpg', '.jpeg']
  for (const dir of searchDirs) {
    for (const ext of extensions) {
      const fullPath = path.join(dir, baseName + ext)
      if (fs.existsSync(fullPath)) {
        try {
          const buf = fs.readFileSync(fullPath)
          const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg'
          return `data:${mime};base64,${buf.toString('base64')}`
        } catch {}
      }
    }
  }
  return ''
}

export function loadProductImages(): ProductImageSet {
  if (CACHE) return CACHE

  const publicDir = path.join(process.cwd(), 'public')
  const adsDir = path.join(publicDir, 'ads')
  const postersDir = path.join(publicDir, 'posters')
  const searchDirs = [postersDir, adsDir, publicDir]

  const result: ProductImageSet = {
    computers: readImageAsDataUrl(searchDirs, 'computers') || readImageAsDataUrl(searchDirs, 'gaming-pc'),
    laptop: readImageAsDataUrl(searchDirs, 'laptop') || readImageAsDataUrl(searchDirs, 'laptop-sale'),
    printers: readImageAsDataUrl(searchDirs, 'printers') || readImageAsDataUrl(searchDirs, 'printer-offer'),
    accessories: readImageAsDataUrl(searchDirs, 'accessories'),
    flyer: readImageAsDataUrl(searchDirs, 'smartcomputers-a4-flyer-landscape') || readImageAsDataUrl(searchDirs, 'smartcomputers-a4-flyer'),
    productgrid: readImageAsDataUrl(searchDirs, 'smartcomputers-product-grid'),
    logo: readImageAsDataUrl([publicDir], 'logo'),
  }

  CACHE = result
  return result
}
