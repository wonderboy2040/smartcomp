import fs from 'node:fs'
import path from 'node:path'

/**
 * Server-only helper that loads the Smart Computers product showcase
 * images (Computers, Laptops, Printers, Accessories) from /public/ads
 * and returns them as base64 data URLs for embedding into the PDF.
 *
 * This module must ONLY be imported from server-side code (API routes),
 * never from a client component, because it uses the Node `fs` module.
 */

export interface ProductImageSet {
  computers: string
  laptop: string
  printers: string
  accessories: string
  flyer?: string
  productgrid?: string
}

let CACHE: ProductImageSet | null = null

export function loadProductImages(): ProductImageSet {
  if (CACHE) return CACHE

  const files: Record<keyof ProductImageSet, string> = {
    computers: 'computers.png',
    laptop: 'laptop.png',
    printers: 'printers.png',
    accessories: 'accessories.png',
  }

  const result = {} as ProductImageSet
  const baseDir = path.join(process.cwd(), 'public', 'ads')

  for (const key of Object.keys(files) as (keyof ProductImageSet)[]) {
    try {
      const buf = fs.readFileSync(path.join(baseDir, files[key]))
      result[key] = `data:image/png;base64,${buf.toString('base64')}`
    } catch {
      // If an image is missing, fall back to an empty string so the
      // banner still renders (with labels only, no image).
      result[key] = ''
    }
  }

  // Premium A4 (landscape) flyer — used by the 'flyer' ad-banner variant.
  // Falls back to an empty string if the file is missing so the banner still renders.
  try {
    const flyerBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'posters', 'smartcomputers-a4-flyer-landscape.png'))
    result.flyer = `data:image/png;base64,${flyerBuf.toString('base64')}`
  } catch {
    result.flyer = ''
  }

  // Premium 4x4 product-grid flyer — used by the 'grid' ad-banner variant.
  try {
    const pgBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'posters', 'smartcomputers-product-grid.png'))
    result.productgrid = `data:image/png;base64,${pgBuf.toString('base64')}`
  } catch {
    result.productgrid = ''
  }

  CACHE = result
  return result
}
