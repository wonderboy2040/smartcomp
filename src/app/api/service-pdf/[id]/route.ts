import { NextRequest, NextResponse } from 'next/server'
import { getRow, listRows, isConfigured } from '@/lib/sheets-client'
import { generateInvoicePdf } from '@/lib/pdf'
import { loadProductImages } from '@/lib/productImages'

// Server-only route (uses fs to read product images for the ad banner)
export const runtime = 'nodejs'
import { computeInvoice, type LineItem } from '@/lib/calc'
import { safeJsonParse } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 503 })
    }

    const { id } = await params
    const url = new URL(req.url)
    const templateId = url.searchParams.get('template') || 'tally-classic'
    const bannerVariant = url.searchParams.get('banner') || 'grid'

    const shopRows = await listRows<any>('Shop')
    const shop = shopRows[0] || { name: 'Smart Computers', termsInvoice: '' }

    const job = await getRow<any>('Jobs', id)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // Parse parts used
    const partsUsed = safeJsonParse<any[]>(job.partsUsedJson || job.partsUsed || '[]', [])
    
    // Convert parts used to LineItems for PDF generation (same as regular invoices)
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
      // Service charge as a line item
      {
        name: `Service & Repair Charge - ${job.deviceType || 'Device'} ${job.brandModel ? `(${job.brandModel})` : ''}`,
        sku: 'SERVICE',
        hsnCode: '9983',
        quantity: 1,
        rate: Number(job.serviceCharge) || Number(job.finalAmount) || 0,
        gstApplicable: false,
        gstRate: 0,
        costPrice: 0,
      }
    ]

    // If no parts, only service charge
    const finalLineItems = partsUsed.length > 0 ? lineItems : [lineItems[lineItems.length - 1]]

    const calc = computeInvoice(finalLineItems, {
      courierCharges: 0,
      otherCharges: 0,
      discount: 0,
    })

    // Override grandTotal to match job's finalAmount for accuracy
    const jobTotal = Number(job.finalAmount) || Number(job.estimatedAmount) || calc.grandTotal
    const paid = (Number(job.paidAmount) || 0) + (Number(job.advanceAmount) || 0)
    
    const pdfBuffer = await generateInvoicePdf({
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
      docType: 'invoice',
      templateId,
      productImages: loadProductImages(),
      adBannerVariant: bannerVariant,
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Service-Invoice-${job.jobId || id}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e: any) {
    console.error('Service PDF generation error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate PDF' }, { status: 500 })
  }
}
