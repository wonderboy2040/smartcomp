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

  CACHE = result
  return result
}
