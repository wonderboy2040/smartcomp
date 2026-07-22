import { NextRequest, NextResponse } from 'next/server'
import { getRow, listRows, isConfigured } from '@/lib/sheets-client'
import { generateInvoiceHtml } from '@/lib/doc-html'
import { computeInvoice, type LineItem } from '@/lib/calc'
import { safeJsonParse } from '@/lib/utils'

// HTML preview is nodejs runtime (uses qrcode lib)
export const runtime = 'nodejs'

// In-memory LRU cache — HTML is fully deterministic per (id, type, template, banner)
// so we can cache the rendered string for 10 minutes and serve instantly.
type HtmlCacheEntry = { html: string; expires: number }
const HTML_CACHE = new Map<string, HtmlCacheEntry>()
const HTML_CACHE_TTL = 10 * 60 * 1000 // 10 min
const HTML_CACHE_MAX = 80

function getCachedHtml(key: string): string | null {
  const e = HTML_CACHE.get(key)
  if (!e) return null
  if (e.expires < Date.now()) {
    HTML_CACHE.delete(key)
    return null
  }
  // Move to end (LRU)
  HTML_CACHE.delete(key)
  HTML_CACHE.set(key, e)
  return e.html
}

function setCachedHtml(key: string, html: string) {
  if (HTML_CACHE.size >= HTML_CACHE_MAX) {
    const firstKey = HTML_CACHE.keys().next().value
    if (firstKey) HTML_CACHE.delete(firstKey)
  }
  HTML_CACHE.set(key, { html, expires: Date.now() + HTML_CACHE_TTL })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isConfigured()) {
      return NextResponse.json(
        { error: 'APPS_SCRIPT_URL not configured' },
        { status: 503 },
      )
    }

    const { id } = await params
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'invoice'
    const templateId =
      url.searchParams.get('template') ||
      'tally-classic'
    const bannerVariant =
      url.searchParams.get('banner') || 'grid'

    // Cache key — if we've rendered this exact combo in the last 10 min, return it
    const cacheKey = `${id}:${type}:${templateId}:${bannerVariant}`
    const cached = getCachedHtml(cacheKey)
    if (cached) {
      return new NextResponse(cached, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control':
            'private, max-age=300, stale-while-revalidate=600',
        },
      })
    }

    // Shop info
    const shopRows = await listRows<any>('Shop')
    const shop = shopRows[0] || {
      name: 'Smart Computers',
      termsInvoice: '',
      termsQuotation: '',
    }

    if (type === 'invoice') {
      const invoice = await getRow<any>('Invoices', id)
      if (!invoice) {
        return NextResponse.json(
          { error: 'Not found' },
          { status: 404 },
        )
      }

      const items = safeJsonParse<any[]>(invoice.itemsJson, []) as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(invoice.courierCharges) || 0,
        otherCharges: Number(invoice.otherCharges) || 0,
        discount: Number(invoice.discount) || 0,
      })

      const html = await generateInvoiceHtml(
        {
          number: String(invoice.number || ''),
          date: new Date(invoice.date || invoice.createdAt || Date.now()),
          shop: {
            name: String(shop.name || 'Smart Computers'),
            owner: String(shop.owner || ''),
            phone: String(shop.phone || ''),
            email: String(shop.email || ''),
            address: String(shop.address || ''),
            gstNumber: String(shop.gstNumber || ''),
            state: String(shop.state || ''),
            upiId: String(shop.upiId || ''),
            bankName: String(shop.bankName || ''),
            bankAccount: String(shop.bankAccount || ''),
            bankIfsc: String(shop.bankIfsc || ''),
            bankBranch: String(shop.bankBranch || ''),
          },
          customer: {
            name: String(invoice.customerName || ''),
            phone: String(invoice.customerPhone || ''),
            address: '',
            gstNumber: String(invoice.customerGstin || ''),
            state: '',
          },
          calc,
          notes: String(invoice.notes || ''),
          terms: String(shop.termsInvoice || ''),
          amountPaid: Number(invoice.amountPaid) || 0,
          amountDue: Number(invoice.amountDue) || 0,
          paymentType: String(invoice.paymentType || ''),
          paymentStatus: String(invoice.paymentStatus || ''),
          docType: 'invoice',
          templateId,
          adBannerVariant: bannerVariant,
        },
        id,
      )

      setCachedHtml(cacheKey, html)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control':
            'private, max-age=300, stale-while-revalidate=600',
        },
      })
    }

    if (type === 'quotation') {
      const q = await getRow<any>('Quotations', id)
      if (!q) {
        return NextResponse.json(
          { error: 'Not found' },
          { status: 404 },
        )
      }

      const items = safeJsonParse<any[]>(q.itemsJson, []) as LineItem[]
      const calc = computeInvoice(items, {
        courierCharges: Number(q.courierCharges) || 0,
        otherCharges: Number(q.otherCharges) || 0,
        discount: Number(q.discount) || 0,
      })

      const html = await generateInvoiceHtml(
        {
          number: String(q.number || ''),
          date: new Date(q.date || q.createdAt || Date.now()),
          validTill: q.validTill ? new Date(q.validTill) : undefined,
          shop: {
            name: String(shop.name || 'Smart Computers'),
            owner: String(shop.owner || ''),
            phone: String(shop.phone || ''),
            email: String(shop.email || ''),
            address: String(shop.address || ''),
            gstNumber: String(shop.gstNumber || ''),
            state: String(shop.state || ''),
            upiId: String(shop.upiId || ''),
            bankName: String(shop.bankName || ''),
            bankAccount: String(shop.bankAccount || ''),
            bankIfsc: String(shop.bankIfsc || ''),
            bankBranch: String(shop.bankBranch || ''),
          },
          customer: {
            name: String(q.customerName || ''),
            phone: String(q.customerPhone || ''),
            address: '',
            gstNumber: String(q.customerGstin || ''),
            state: '',
          },
          calc,
          notes: String(q.notes || ''),
          terms: String(shop.termsQuotation || ''),
          docType: 'quotation',
          templateId,
          adBannerVariant: bannerVariant,
        },
        id,
      )

      setCachedHtml(cacheKey, html)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control':
            'private, max-age=300, stale-while-revalidate=600',
        },
      })
    }

    if (type === 'service') {
      const job = await getRow<any>('Jobs', id)
      if (!job) {
        return NextResponse.json(
          { error: 'Service Job not found' },
          { status: 404 },
        )
      }

      const partsUsed = safeJsonParse<any[]>(job.partsUsedJson || job.partsUsed || '[]', [])
      const lineItems: LineItem[] = [
        ...partsUsed.map((p: any) => ({
          name: String(p.name || 'Spare Part'),
          sku: String(p.sku || ''),
          hsnCode: String(p.hsnCode || ''),
          quantity: Number(p.qty || 1),
          rate: Number(p.sellPrice || p.price || p.costPrice || 0),
          gstApplicable: false,
          gstRate: 0,
          costPrice: Number(p.costPrice || 0),
        })),
        {
          name: `Service & Repair Charge - ${job.deviceType || 'Device'} ${job.brandModel ? `(${job.brandModel})` : ''}`,
          sku: 'SERVICE',
          hsnCode: '9983',
          quantity: 1,
          rate: Number(job.serviceCharge) || Number(job.finalAmount) || 0,
          gstApplicable: false,
          gstRate: 0,
          costPrice: 0,
        },
      ]

      const finalLineItems = partsUsed.length > 0 ? lineItems : [lineItems[lineItems.length - 1]]
      const calc = computeInvoice(finalLineItems, {
        courierCharges: 0,
        otherCharges: 0,
        discount: 0,
      })

      const jobTotal = Number(job.finalAmount) || Number(job.estimatedAmount) || calc.grandTotal
      const paid = (Number(job.paidAmount) || 0) + (Number(job.advanceAmount) || 0)

      const html = await generateInvoiceHtml(
        {
          number: `INV-${String(job.jobId || id)}`,
          date: new Date(job.createdAt || job.date || Date.now()),
          shop: {
            name: String(shop.name || 'Smart Computers'),
            owner: String(shop.owner || ''),
            phone: String(shop.phone || ''),
            email: String(shop.email || ''),
            address: String(shop.address || ''),
            gstNumber: String(shop.gstNumber || ''),
            state: String(shop.state || ''),
            upiId: String(shop.upiId || ''),
            bankName: String(shop.bankName || ''),
            bankAccount: String(shop.bankAccount || ''),
            bankIfsc: String(shop.bankIfsc || ''),
            bankBranch: String(shop.bankBranch || ''),
          },
          customer: {
            name: String(job.customerName || 'Walk-in Customer'),
            phone: String(job.customerMobile || ''),
            address: String(job.customerAddress || ''),
            gstNumber: '',
            state: '',
          },
          calc: {
            ...calc,
            grandTotal: jobTotal,
          },
          notes: String(job.diagnosisNotes || job.notes || `Service completed for ${job.deviceType || 'device'}. Problem: ${job.problemDesc || ''}. ${job.accessories ? `Accessories: ${job.accessories}` : ''}`),
          terms: String(shop.termsInvoice || `${Number(job.warrantyDays) || 30} days service warranty. Parts warranty as per manufacturer. Please collect device within 30 days.`),
          amountPaid: paid,
          amountDue: Math.max(0, jobTotal - paid),
          paymentType: String(job.paymentMode || 'cash'),
          paymentStatus: paid >= jobTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
          docType: 'service',
          templateId,
          adBannerVariant: bannerVariant,
          ...(job as any),
        },
        id,
      )

      setCachedHtml(cacheKey, html)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control':
            'private, max-age=300, stale-while-revalidate=600',
        },
      })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e: any) {
    console.error('HTML doc generation error:', e)
    return NextResponse.json(
      { error: e?.message || 'Failed' },
      { status: 500 },
    )
  }
}
