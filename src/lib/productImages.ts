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

  // FAST PATH (v7.0.5): Read files async without blocking sharp compression
  // This eliminates server freeze when opening invoices/service-pdf
  const publicDir = path.join(process.cwd(), 'public')
  const postersDir = path.join(publicDir, 'posters')
  const adsDir = path.join(publicDir, 'ads')

  async function readFileToBase64(filePath: string): Promise<string> {
    return new Promise((resolve) => {
      fs.readFile(filePath, (err, data) => {
        if (err) return resolve('')
        const ext = path.extname(filePath)
        const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg'
        resolve(`data:${mime};base64,${data.toString('base64')}`)
      })
    })
  }

  const [computers, laptop, printers, accessories, flyer, productgrid, logo] = await Promise.all([
    readFileToBase64(path.join(postersDir, 'gaming-pc.webp')).catch(() => ''),
    readFileToBase64(path.join(postersDir, 'laptop-sale.webp')).catch(() => ''),
    readFileToBase64(path.join(postersDir, 'printer-offer.webp')).catch(() => ''),
    readFileToBase64(path.join(postersDir, 'accessories.webp')).catch(() => ''),
    readFileToBase64(path.join(postersDir, 'smartcomputers-a4-flyer-landscape.webp')).catch(() => ''),
    readFileToBase64(path.join(postersDir, 'smartcomputers-product-grid.webp')).catch(() => ''),
    readFileToBase64(path.join(publicDir, 'logo.svg')).catch(() => ''),
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
