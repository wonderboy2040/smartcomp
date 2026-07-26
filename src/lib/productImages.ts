import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Server-only helper that loads product showcase images from /public
 * and compresses them to lightweight JPEG format (~20-30 KB) so PDF output stays 150-250 KB.
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
            const compressed = await sharp(buf)
              .resize({ width: maxWidth, withoutEnlargement: true })
              .jpeg({ quality, progressive: true, mozjpeg: true })
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

  // Optimized for 150-250 KB PDF target — smaller images, lower quality
  const [computers, laptop, printers, accessories, flyer, productgrid, logo] = await Promise.all([
    readAndCompressImage([postersDir], 'gaming-pc', 300, 35).catch(() => ''),
    readAndCompressImage([postersDir], 'laptop-sale', 300, 35).catch(() => ''),
    readAndCompressImage([postersDir], 'printer-offer', 300, 35).catch(() => ''),
    readAndCompressImage([postersDir], 'accessories', 300, 35).catch(() => ''),
    readAndCompressImage([postersDir], 'smartcomputers-a4-flyer-landscape', 600, 35).catch(() => ''),
    readAndCompressImage([postersDir], 'smartcomputers-product-grid', 600, 35).catch(() => ''),
    readAndCompressImage([publicDir], 'logo', 150, 50).catch(() => ''),
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
