'use client'

import { useFetch } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calc'
import {
  Package, Users, TrendingUp, AlertTriangle,
  Wallet, FileText, MessageSquare, IndianRupee, Clock,
  ArrowUpRight, RefreshCw, CheckCircle2, Sparkles, Zap,
  TrendingDown, ShoppingBag, CreditCard
} from 'lucide-react'

export function DashboardView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { data, loading, refetch } = useFetch<any>('/api/dashboard', undefined)
  const { data: sheetsData } = useFetch<any>('/api/sheets/sync', undefined)

  const stats = data?.stats || {}
  const recentInvoices = data?.recentInvoices || []
  const pendingInvoices = data?.pendingInvoices || []
  const recentPayments = data?.recentPayments || []
  const recentEnquiries = data?.recentEnquiries || []
  const lowStockList = data?.lowStockList || []

  const profitMargin = stats.monthSales ? ((stats.monthProfit / stats.monthSales) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sheetsData?.enabled ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-1 text-[10px] sm:text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" /> <span className="hidden sm:inline">Sheets Connected</span><span className="sm:hidden">Connected</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-2 py-1 text-[10px] sm:text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" /> <span className="hidden sm:inline">Not Configured</span><span className="sm:hidden">Setup</span>
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-200 h-9 px-3">
            <RefreshCw className="w-3.5 h-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Hero stat cards - main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <HeroCard
          label="Month Sales"
          value={formatCurrency(stats.monthSales || 0)}
          sub={`Profit: ${formatCurrency(stats.monthProfit || 0)}`}
          icon={IndianRupee}
          gradient="from-emerald-500 to-emerald-600"
          loading={loading}
          onClick={() => onNavigate('invoices')}
        />
        <HeroCard
          label="Stock Value"
          value={formatCurrency(stats.stockValueSelling || 0)}
          sub={`Cost: ${formatCurrency(stats.stockValueCost || 0)}`}
          icon={Package}
          gradient="from-blue-500 to-blue-600"
          loading={loading}
          onClick={() => onNavigate('stock')}
        />
        <HeroCard
          label="Outstanding"
          value={formatCurrency(stats.totalOutstanding || 0)}
          sub={`${pendingInvoices.length} pending`}
          icon={Wallet}
          gradient="from-orange-500 to-orange-600"
          loading={loading}
          onClick={() => onNavigate('payments')}
        />
        <HeroCard
          label="Today's Collection"
          value={formatCurrency(stats.todayPaymentTotal || 0)}
          sub={`${recentPayments.length} payments`}
          icon={TrendingUp}
          gradient="from-violet-500 to-violet-600"
          loading={loading}
          onClick={() => onNavigate('payments')}
        />
      </div>

      {/* Cash vs Credit vs Profit breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Cash Sales</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400">This Month</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatCurrency(stats.monthCashSales || 0)}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-emerald-600">
              <Zap className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Immediate payment</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-orange-600" />
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Credit Sales</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400">This Month</p>
                </div>
              </div>
              <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-orange-700 truncate">{formatCurrency(stats.monthCreditSales || 0)}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-orange-600">
              <Clock className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Pending collection</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-400 to-violet-600" />
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Net Profit</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400">{profitMargin}% margin</p>
                </div>
              </div>
              {Number(profitMargin) >= 0 ? <TrendingUp className="w-4 h-4 text-violet-500 flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />}
            </div>
            <p className={`text-lg sm:text-2xl font-bold truncate ${(stats.monthProfit || 0) >= 0 ? 'text-violet-700' : 'text-red-700'}`}>
              {formatCurrency(stats.monthProfit || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-violet-600">
              <Sparkles className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Selling - Cost = Profit</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <MiniStat
          label="Customers"
          value={String(stats.totalCustomers || 0)}
          sub={`${stats.totalSuppliers || 0} suppliers`}
          icon={Users}
          color="bg-pink-500"
          onClick={() => onNavigate('customers')}
        />
        <MiniStat
          label="Low Stock"
          value={String(stats.lowStockCount || 0)}
          sub="Need restocking"
          icon={AlertTriangle}
          color="bg-red-500"
          onClick={() => onNavigate('stock')}
        />
        <MiniStat
          label="Quotations"
          value={String(stats.totalQuotations || 0)}
          sub={`Value: ${formatCurrency(stats.monthQuotationValue || 0)}`}
          icon={FileText}
          color="bg-cyan-500"
          onClick={() => onNavigate('quotations')}
        />
        <MiniStat
          label="Enquiries"
          value={String(stats.pendingEnquiries || 0)}
          sub="Awaiting replies"
          icon={MessageSquare}
          color="bg-amber-500"
          onClick={() => onNavigate('whatsapp')}
        />
      </div>

      {/* Recent Activity - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Recent Invoices */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                Recent Invoices
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('invoices')} className="text-xs h-8">
                <span className="hidden sm:inline">View All</span><span className="sm:hidden">All</span> →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentInvoices.length === 0 ? (
              <EmptyState icon={FileText} message="No invoices yet" />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                {recentInvoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => onNavigate('invoices')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{inv.number}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 truncate">{inv.customer.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">{formatCurrency(inv.grandTotal)}</p>
                      <Badge
                        variant="outline"
                        className={
                          inv.paymentStatus === 'paid'
                            ? 'bg-green-50 text-green-700 border-green-200 text-[9px] sm:text-[10px]'
                            : inv.paymentStatus === 'partial'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 text-[9px] sm:text-[10px]'
                            : 'bg-red-50 text-red-700 border-red-200 text-[9px] sm:text-[10px]'
                        }
                      >
                        {inv.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-orange-600" />
                </div>
                Pending Payments
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('payments')} className="text-xs h-8">
                <span className="hidden sm:inline">View All</span><span className="sm:hidden">All</span> →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingInvoices.length === 0 ? (
              <EmptyState icon={CheckCircle2} message="All payments cleared!" iconColor="text-emerald-500" />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pendingInvoices.slice(0, 8).map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => onNavigate('payments')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{inv.customer.name}</p>
                      <p className="text-xs text-slate-500">{inv.number} · {new Date(inv.date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(inv.amountDue)}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{inv.paymentType}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                </div>
                Low Stock Alert
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('stock')} className="text-xs h-8">
                Manage →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {lowStockList.length === 0 ? (
              <EmptyState icon={CheckCircle2} message="All items well stocked" iconColor="text-emerald-500" />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {lowStockList.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku}</p>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] flex-shrink-0">
                      {item.quantity} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Enquiries */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                WhatsApp Enquiries
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('whatsapp')} className="text-xs h-8">
                <span className="hidden sm:inline">View All</span><span className="sm:hidden">All</span> →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentEnquiries.length === 0 ? (
              <EmptyState icon={MessageSquare} message="No enquiries sent yet" />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recentEnquiries.map((e: any) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{e.supplier.name}</p>
                      <p className="text-xs text-slate-500">{new Date(e.sentAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        e.status === 'rate_updated'
                          ? 'bg-green-50 text-green-700 border-green-200 text-[10px]'
                          : e.status === 'responded'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 text-[10px]'
                      }
                    >
                      {String(e?.status || '').replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HeroCard({
  label, value, sub, icon: Icon, gradient, loading, onClick,
}: {
  label: string
  value: string
  sub: string
  icon: any
  gradient: string
  loading: boolean
  onClick: () => void
}) {
  if (loading) {
    return <div className={`h-28 sm:h-32 rounded-2xl bg-gradient-to-br ${gradient} opacity-50 animate-pulse`} />
  }
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-3 sm:p-5 text-white shadow-lg cursor-pointer transition-transform active:scale-95 hover:scale-[1.02] hover:shadow-xl`}
    >
      {/* Decorative bubble */}
      <div className="absolute -right-6 -top-6 w-20 h-20 sm:w-24 sm:h-24 bg-white/10 rounded-full" />
      <div className="absolute -right-4 -bottom-4 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full" />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-white/80 uppercase tracking-wide">{label}</p>
            <p className="text-base sm:text-2xl font-bold mt-1 truncate">{value}</p>
            <p className="text-[10px] sm:text-xs text-white/80 mt-1 truncate">{sub}</p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label, value, sub, icon: Icon, color, onClick,
}: {
  label: string
  value: string
  sub: string
  icon: any
  color: string
  onClick: () => void
}) {
  return (
    <Card
      className="border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-95"
      onClick={onClick}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 sm:w-9 sm:h-9 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 uppercase truncate">{label}</p>
            <p className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">{value}</p>
          </div>
        </div>
        <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 truncate">{sub}</p>
      </CardContent>
    </Card>
  )
}

function EmptyState({ icon: Icon, message, iconColor = 'text-slate-300' }: { icon: any; message: string; iconColor?: string }) {
  return (
    <div className="text-center py-8">
      <Icon className={`w-10 h-10 mx-auto mb-2 ${iconColor}`} />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
