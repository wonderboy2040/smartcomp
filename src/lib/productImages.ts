import fs from 'node:fs'
import path from 'node:path'

/**
 * Server-only helper that loads the Smart Computers product showcase
 * images (Computers, Laptops, Printers, Accessories, Flyer, Product Grid, Logo) from /public
 * and returns them as base64 data URLs for embedding into the PDF/HTML.
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

export function loadProductImages(): ProductImageSet {
  if (CACHE) return CACHE

  const files: Record<'computers' | 'laptop' | 'printers' | 'accessories', string> = {
    computers: 'computers.png',
    laptop: 'laptop.png',
    printers: 'printers.png',
    accessories: 'accessories.png',
  }

  const result = {} as ProductImageSet
  const baseDir = path.join(process.cwd(), 'public', 'ads')

  for (const key of Object.keys(files) as ('computers' | 'laptop' | 'printers' | 'accessories')[]) {
    try {
      const buf = fs.readFileSync(path.join(baseDir, files[key]))
      result[key] = `data:image/png;base64,${buf.toString('base64')}`
    } catch {
      result[key] = ''
    }
  }

  try {
    const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'))
    result.logo = `data:image/png;base64,${logoBuf.toString('base64')}`
  } catch {
    result.logo = ''
  }

  try {
    const flyerBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'posters', 'smartcomputers-a4-flyer-landscape.png'))
    result.flyer = `data:image/png;base64,${flyerBuf.toString('base64')}`
  } catch {
    result.flyer = ''
  }

  try {
    const pgBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'posters', 'smartcomputers-product-grid.png'))
    result.productgrid = `data:image/png;base64,${pgBuf.toString('base64')}`
  } catch {
    result.productgrid = ''
  }

  CACHE = result
  return result
}
