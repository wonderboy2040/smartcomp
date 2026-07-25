import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Server-only helper that loads the Smart Computers product showcase
 * images (Computers, Laptops, Printers, Accessories, Flyer, Product Grid, Logo) from /public
 * and compresses them to lightweight JPEG format (~30 KB) so PDF output is accurately 100-150 KB.
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
            // Compress image with sharp to JPEG format for ultra-light PDF size (~30 KB)
            const compressed = await sharp(buf)
              .resize({ width: maxWidth, withoutEnlargement: true })
              .jpeg({ quality, progressive: true })
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
  const adsDir = path.join(publicDir, 'ads')
  const postersDir = path.join(publicDir, 'posters')
  const searchDirs = [postersDir, adsDir, publicDir]

  const result: ProductImageSet = {
    computers: await readAndCompressImage(searchDirs, 'computers', 400, 65) || await readAndCompressImage(searchDirs, 'gaming-pc', 400, 65),
    laptop: await readAndCompressImage(searchDirs, 'laptop', 400, 65) || await readAndCompressImage(searchDirs, 'laptop-sale', 400, 65),
    printers: await readAndCompressImage(searchDirs, 'printers', 400, 65) || await readAndCompressImage(searchDirs, 'printer-offer', 400, 65),
    accessories: await readAndCompressImage(searchDirs, 'accessories', 400, 65),
    flyer: await readAndCompressImage(searchDirs, 'smartcomputers-a4-flyer-landscape', 1000, 70) || await readAndCompressImage(searchDirs, 'smartcomputers-a4-flyer', 1000, 70),
    productgrid: await readAndCompressImage(searchDirs, 'smartcomputers-product-grid', 1000, 70),
    logo: await readAndCompressImage([publicDir], 'logo', 300, 75),
  }

  CACHE = result
  return result
}
