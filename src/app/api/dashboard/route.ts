import { NextResponse } from 'next/server'
import { getDashboardStats, isConfigured, isCircuitBreakerActive, resetCircuitBreaker } from '@/lib/sheets-client'

export async function GET() {
  try {
    if (!isConfigured()) {
      return NextResponse.json({
        stats: {
          totalItems: 0, lowStockCount: 0, totalCustomers: 0, totalSuppliers: 0,
          stockValueCost: 0, stockValueSelling: 0, monthSales: 0, monthProfit: 0,
          monthCashSales: 0, monthCreditSales: 0, totalOutstanding: 0,
          monthQuotationValue: 0, totalQuotations: 0, todayPaymentTotal: 0, pendingEnquiries: 0,
          totalJobs: 0, pendingJobs: 0, completedJobs: 0, deliveredJobs: 0,
          highPriorityJobs: 0, todayJobs: 0, monthJobs: 0,
          todayServiceTotal: 0, todayServiceUPI: 0, todayServiceCash: 0,
          monthServiceTotal: 0, monthServiceUPI: 0, monthServiceCash: 0,
          adminServiceShare: 0, adminPartsShare: 0, adminTotalShare: 0,
          engineerServiceShare: 0, engineerPartsShare: 0, engineerTotalShare: 0,
        },
        pendingInvoices: [], recentInvoices: [], recentPayments: [], recentEnquiries: [], lowStockList: [],
        recentJobs: [],
        notConfigured: true,
      })
    }

    // If circuit breaker active, return cached empty to keep site loading, not 500
    if (isCircuitBreakerActive()) {
      return NextResponse.json({
        stats: {
          totalItems: 0, lowStockCount: 0, totalCustomers: 0, totalSuppliers: 0,
          stockValueCost: 0, stockValueSelling: 0, monthSales: 0, monthProfit: 0,
          monthCashSales: 0, monthCreditSales: 0, totalOutstanding: 0,
          monthQuotationValue: 0, totalQuotations: 0, todayPaymentTotal: 0, pendingEnquiries: 0,
          totalJobs: 0, pendingJobs: 0, completedJobs: 0, deliveredJobs: 0,
          highPriorityJobs: 0, todayJobs: 0, monthJobs: 0,
          todayServiceTotal: 0, todayServiceUPI: 0, todayServiceCash: 0,
          monthServiceTotal: 0, monthServiceUPI: 0, monthServiceCash: 0,
          adminServiceShare: 0, adminPartsShare: 0, adminTotalShare: 0,
          engineerServiceShare: 0, engineerPartsShare: 0, engineerTotalShare: 0,
        },
        pendingInvoices: [], recentInvoices: [], recentPayments: [], recentEnquiries: [], lowStockList: [],
        recentJobs: [],
        circuitBreaker: true,
        warning: 'Circuit breaker active - Google Sheets temporarily unavailable. Will auto-recover in 10s. If persists, check Apps Script deployment: Settings → Sync → Copy latest code.gs → Paste → Deploy new version → Anyone access → Copy /exec URL',
        fix: 'APPS_SCRIPT_URL may be stale. Update to latest v5.0 Quantum code.gs',
      }, {
        headers: { 'X-Circuit-Breaker': 'active' }
      })
    }

    const data = await getDashboardStats()
    return NextResponse.json(data)
  } catch (e: any) {
    const isBreaker = e?.message?.includes('Circuit breaker')
    const isHtml = e?.message?.includes('HTML') || e?.message?.includes('Stale') || e?.message?.includes('LOGIN') || e?.message?.includes('Deployment')

    // For circuit breaker or HTML errors, return 200 with empty data + warning, not 500, to keep site loading
    if (isBreaker || isHtml) {
      return NextResponse.json({
        stats: {
          totalItems: 0, lowStockCount: 0, totalCustomers: 0, totalSuppliers: 0,
          stockValueCost: 0, stockValueSelling: 0, monthSales: 0, monthProfit: 0,
          monthCashSales: 0, monthCreditSales: 0, totalOutstanding: 0,
          monthQuotationValue: 0, totalQuotations: 0, todayPaymentTotal: 0, pendingEnquiries: 0,
          totalJobs: 0, pendingJobs: 0, completedJobs: 0, deliveredJobs: 0,
          highPriorityJobs: 0, todayJobs: 0, monthJobs: 0,
          todayServiceTotal: 0, todayServiceUPI: 0, todayServiceCash: 0,
          monthServiceTotal: 0, monthServiceUPI: 0, monthServiceCash: 0,
          adminServiceShare: 0, adminPartsShare: 0, adminTotalShare: 0,
          engineerServiceShare: 0, engineerPartsShare: 0, engineerTotalShare: 0,
        },
        pendingInvoices: [], recentInvoices: [], recentPayments: [], recentEnquiries: [], lowStockList: [],
        recentJobs: [],
        error: e?.message,
        circuitBreaker: isBreaker,
        staleDeployment: isHtml,
        warning: isHtml ? 'Stale/broken Apps Script deployment. Fix: Settings → Sync → Copy latest code.gs v5.0 Quantum → Paste in Apps Script → Deploy new version (Anyone) → Copy /exec URL → Update env' : 'Circuit breaker active - will auto-recover in 10s',
        fix: isHtml ? 'Update Apps Script to v5.0 Quantum code.gs' : 'Wait 10s or call /api/sheets/sync?action=resetCircuitBreaker via POST',
      }, {
        headers: { 'X-Circuit-Breaker': isBreaker ? 'active' : 'inactive', 'X-Stale-Deployment': isHtml ? 'true' : 'false' },
        status: 200, // Return 200 to keep frontend loading, not 500
      })
    }

    return NextResponse.json({ error: e?.message, warning: 'Dashboard load failed' }, { status: 200 }) // Also 200 to keep site from blank
  }
}
