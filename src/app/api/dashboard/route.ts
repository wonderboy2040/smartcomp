import { NextResponse } from 'next/server'
import { getDashboardStats, isConfigured } from '@/lib/sheets-client'

export async function GET() {
  try {
    if (!isConfigured()) {
      return NextResponse.json({
        stats: {
          totalItems: 0, lowStockCount: 0, totalCustomers: 0, totalSuppliers: 0,
          stockValueCost: 0, stockValueSelling: 0, monthSales: 0, monthProfit: 0,
          monthCashSales: 0, monthCreditSales: 0, totalOutstanding: 0,
          monthQuotationValue: 0, totalQuotations: 0, todayPaymentTotal: 0, pendingEnquiries: 0,
        },
        pendingInvoices: [], recentInvoices: [], recentPayments: [], recentEnquiries: [], lowStockList: [],
      })
    }
    const data = await getDashboardStats()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
