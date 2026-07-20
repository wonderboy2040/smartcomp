'use client'

import { useFetch } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calc'
import { useMemo, useState } from 'react'
import { generateSuperIntelligence, type IntelligenceInput } from '@/lib/super-intelligence'
import {
  Package, Users, TrendingUp, AlertTriangle,
  Wallet, FileText, MessageSquare, IndianRupee, Clock,
  ArrowUpRight, RefreshCw, CheckCircle2, Sparkles, Zap,
  TrendingDown, ShoppingBag, CreditCard, Wrench, User, Brain,
  Lightbulb, Target, ShieldCheck, Crown, Rocket, Activity, Bot, Eye,
  DollarSign, BarChart3, Layers, Cpu, Command, ArrowDownRight
} from 'lucide-react'

export function DashboardView({ onNavigate, sheetsConnected = true }: { onNavigate: (tab: string) => void; sheetsConnected?: boolean }) {
  const { data, loading, refetch } = useFetch<any>('/api/dashboard', undefined)
  const { data: invoices } = useFetch<any[]>('/api/invoices?limit=500', undefined)
  const { data: items } = useFetch<any[]>('/api/items', undefined)
  const { data: customers } = useFetch<any[]>('/api/customers', undefined)
  const { data: jobs } = useFetch<any[]>('/api/jobs', undefined)
  const { data: payments } = useFetch<any[]>('/api/payments?limit=100', undefined)
  const { data: expenses } = useFetch<any[]>('/api/expenses', undefined)

  const [aiExpanded, setAiExpanded] = useState(true)

  const stats = data?.stats || {}
  const recentInvoices = data?.recentInvoices || []
  const pendingInvoices = data?.pendingInvoices || []
  const recentPayments = data?.recentPayments || []
  const recentEnquiries = data?.recentEnquiries || []
  const lowStockList = data?.lowStockList || []

  const profitMargin = stats.monthSales ? ((stats.monthProfit / stats.monthSales) * 100).toFixed(1) : '0'

  const superIntel = useMemo(() => {
    if (!invoices || !items || !customers || !jobs) return null
    try {
      const input: IntelligenceInput = {
        invoices: invoices || [],
        items: items || [],
        customers: customers || [],
        jobs: jobs || [],
        payments: payments || [],
        expenses: expenses || [],
      }
      return generateSuperIntelligence(input)
    } catch {
      return null
    }
  }, [invoices, items, customers, jobs, payments, expenses])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header + PRO badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate flex items-center gap-2">
            Dashboard
            <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0 text-[10px] px-2">SUPER INTELLIGENCE v7.0 PRO</Badge>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • AI Score: {superIntel?.aiScore || '--'}/100 • {superIntel?.healthStatus?.replace('_', ' ') || 'analyzing'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sheetsConnected ? (
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

      {/* SUPER INTELLIGENCE COMMAND STRIP */}
      {superIntel && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 p-[1px]">
          <div className="rounded-[15px] bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 p-4 sm:p-5 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:20px_20px]" />
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold">Super Intelligence Live</p>
                      <Badge className="bg-emerald-400 text-emerald-950 border-0 text-[10px] animate-pulse">LIVE • Analyzing</Badge>
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-[10px]"><Cpu className="w-3 h-3 mr-1" /> Edge AI</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      <div className="rounded-lg bg-white/10 border border-white/10 p-2">
                        <p className="text-[10px] text-violet-200 uppercase">AI Health</p>
                        <p className="font-bold">{superIntel.aiScore}/100 • {superIntel.healthStatus}</p>
                      </div>
                      <div className="rounded-lg bg-white/10 border border-white/10 p-2">
                        <p className="text-[10px] text-violet-200 uppercase">Forecast Next</p>
                        <p className="font-bold truncate">Rs.{(superIntel.forecasts[0]?.predictedSales || 0).toLocaleString()} • {superIntel.forecasts[0]?.trend} {superIntel.forecasts[0]?.trend === 'up' ? '↑' : superIntel.forecasts[0]?.trend === 'down' ? '↓' : '→'}</p>
                      </div>
                      <div className="rounded-lg bg-white/10 border border-white/10 p-2">
                        <p className="text-[10px] text-violet-200 uppercase">Leaks Found</p>
                        <p className="font-bold text-amber-200">Rs.{superIntel.summary.totalLeakAmount.toLocaleString()} recoverable</p>
                      </div>
                      <div className="rounded-lg bg-white/10 border border-white/10 p-2">
                        <p className="text-[10px] text-violet-200 uppercase">Actions</p>
                        <p className="font-bold">{superIntel.insights.length} insights • {superIntel.anomalies.length} alerts</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:w-[280px]">
                  <Button size="sm" className="bg-white text-violet-700 hover:bg-violet-50 font-semibold" onClick={() => onNavigate('ai')}>
                    <Sparkles className="w-4 h-4 mr-1" /> Open AI Intelligence Hub
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs" onClick={() => onNavigate('automation')}>
                      <Bot className="w-3 h-3 mr-1" /> Automations
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs" onClick={() => onNavigate('command')}>
                      <Command className="w-3 h-3 mr-1" /> Command
                    </Button>
                  </div>
                </div>
              </div>

              {aiExpanded && superIntel.insights.length > 0 && (
                <div className="mt-4 grid md:grid-cols-3 gap-2">
                  {superIntel.insights.slice(0, 3).map(ins => (
                    <div key={ins.id} className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-3 hover:bg-white/15 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={`${ins.priority === 'urgent' ? 'bg-red-500' : ins.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'} text-white border-0 text-[9px]`}>{ins.priority.toUpperCase()}</Badge>
                        <span className="text-[10px] text-violet-200">{ins.category}</span>
                      </div>
                      <p className="font-semibold text-xs mt-2 line-clamp-1">{ins.title}</p>
                      <p className="text-[11px] text-violet-100 mt-1 line-clamp-2">{ins.message}</p>
                      {ins.suggestedAction && <p className="text-[10px] mt-2 text-amber-200 font-medium">→ {ins.suggestedAction}</p>}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setAiExpanded(!aiExpanded)} className="mt-3 text-[11px] text-violet-200 hover:text-white flex items-center gap-1">
                {aiExpanded ? '▲ Collapse AI' : '▼ Expand 3 top insights'} • {superIntel.summary.predictedGrowth} growth • {superIntel.summary.criticalAnomalies} critical
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero stat cards - main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <HeroCard
          label="Month Sales"
          value={formatCurrency(stats.monthSales || 0)}
          sub={`Profit: ${formatCurrency(stats.monthProfit || 0)} • ${profitMargin}% margin`}
          icon={IndianRupee}
          gradient="from-emerald-500 to-emerald-600"
          loading={loading}
          onClick={() => onNavigate('invoices')}
          trend={superIntel?.forecasts[0]?.trend}
        />
        <HeroCard
          label="Stock Value"
          value={formatCurrency(stats.stockValueSelling || 0)}
          sub={`Cost: ${formatCurrency(stats.stockValueCost || 0)} • ${stats.lowStockCount || 0} low`}
          icon={Package}
          gradient="from-blue-500 to-blue-600"
          loading={loading}
          onClick={() => onNavigate('stock')}
        />
        <HeroCard
          label="Outstanding"
          value={formatCurrency(stats.totalOutstanding || 0)}
          sub={`${pendingInvoices.length} pending • Rs.${superIntel?.summary.totalLeakAmount ? `${(superIntel.summary.totalLeakAmount/1000).toFixed(1)}k leak` : 'focus'}`}
          icon={Wallet}
          gradient="from-orange-500 to-orange-600"
          loading={loading}
          onClick={() => onNavigate('payments')}
        />
        <HeroCard
          label="AI Forecast Next"
          value={superIntel ? `Rs.${(superIntel.forecasts[0]?.predictedSales || 0).toLocaleString()}` : formatCurrency(stats.todayPaymentTotal || 0)}
          sub={`${superIntel?.forecasts[0]?.confidence || 0}% conf • ${superIntel?.forecasts[0]?.trend || 'stable'} trend`}
          icon={Rocket}
          gradient="from-violet-500 to-indigo-600"
          loading={loading}
          onClick={() => onNavigate('ai')}
          isAI
        />
      </div>

      {/* Cash vs Credit vs Profit breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Cash Sales</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400">This Month • Instant</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatCurrency(stats.monthCashSales || 0)}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-emerald-600">
              <Zap className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Immediate payment • Healthy cashflow</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-orange-600" />
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Credit Sales</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400">Pending collection</p>
                </div>
              </div>
              <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-orange-700 truncate">{formatCurrency(stats.monthCreditSales || 0)}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-orange-600">
              <Clock className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{pendingInvoices.length} pending • AI auto-reminder on</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1 bg-gradient-to-r from-violet-400 to-violet-600" />
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 uppercase">Net Profit AI</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400">{profitMargin}% margin • {superIntel?.profitLeaks.length ? `${superIntel.profitLeaks.length} leaks` : 'optimized'}</p>
                </div>
              </div>
              {Number(profitMargin) >= 0 ? <TrendingUp className="w-4 h-4 text-violet-500 flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />}
            </div>
            <p className={`text-lg sm:text-2xl font-bold truncate ${(stats.monthProfit || 0) >= 0 ? 'text-violet-700' : 'text-red-700'}`}>
              {formatCurrency(stats.monthProfit || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-violet-600">
              <Sparkles className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Selling - Cost = Profit • AI optimized</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <MiniStat
          label="Customers AI"
          value={String(stats.totalCustomers || 0)}
          sub={`${superIntel?.summary.highRiskCustomers || 0} at-risk • ${stats.totalSuppliers || 0} suppliers`}
          icon={Users}
          color="bg-pink-500"
          onClick={() => onNavigate('customers')}
          highlight={superIntel ? (superIntel.summary.highRiskCustomers || 0) > 0 : false}
        />
        <MiniStat
          label="Low Stock AI"
          value={String(stats.lowStockCount || 0)}
          sub={`${superIntel?.summary.stockoutRiskItems || 0} risk • AI reorder`}
          icon={AlertTriangle}
          color="bg-red-500"
          onClick={() => onNavigate('stock')}
          highlight={(stats.lowStockCount || 0) > 3}
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
          sub="Awaiting replies + AI draft"
          icon={MessageSquare}
          color="bg-amber-500"
          onClick={() => onNavigate('whatsapp')}
        />
      </div>

      {/* Service Section — Jobs stats + 50-50 Profit Share cards */}
      {(stats.totalJobs > 0 || stats.todayServiceTotal > 0) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
            <MiniStat label="Total Jobs" value={String(stats.totalJobs || 0)} sub={`${stats.todayJobs || 0} today • AI tracked`} icon={Wrench} color="bg-blue-500" onClick={() => onNavigate('jobs')} />
            <MiniStat label="Pending Jobs" value={String(stats.pendingJobs || 0)} sub={`${stats.highPriorityJobs || 0} high • Need attention`} icon={Clock} color="bg-amber-500" onClick={() => onNavigate('jobs')} highlight={(stats.pendingJobs || 0) > 5} />
            <MiniStat label="High Priority" value={String(stats.highPriorityJobs || 0)} sub="Active urgent • SLA" icon={AlertTriangle} color="bg-red-500" onClick={() => onNavigate('jobs')} highlight={(stats.highPriorityJobs || 0) > 0} />
            <MiniStat label="Today's Service" value={formatCurrency(stats.todayServiceTotal || 0)} sub={`UPI: ${formatCurrency(stats.todayServiceUPI || 0)}`} icon={IndianRupee} color="bg-emerald-500" onClick={() => onNavigate('servicepayments')} />
            <MiniStat label="Month Service" value={formatCurrency(stats.monthServiceTotal || 0)} sub={`Cash: ${formatCurrency(stats.monthServiceCash || 0)}`} icon={TrendingUp} color="bg-purple-500" onClick={() => onNavigate('servicepayments')} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <Card className="border-0 overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 sm:p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg">Admin Share (50%)</h3>
                    <p className="text-blue-100 text-xs">Your share from paid service jobs • AI calculated</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white/10 rounded-xl">
                    <span className="text-blue-100 text-sm">This Month</span>
                    <span className="font-bold text-xl">{formatCurrency(stats.adminTotalShare || 0)}</span>
                  </div>
                  <div className="pt-2 border-t border-white/20 space-y-1">
                    <div className="flex justify-between text-sm text-blue-100"><span>Service Share:</span><span>{formatCurrency(stats.adminServiceShare || 0)}</span></div>
                    <div className="flex justify-between text-sm text-blue-100"><span>Parts Profit Share:</span><span>{formatCurrency(stats.adminPartsShare || 0)}</span></div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-0 overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-4 sm:p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg">Engineer Share (50%)</h3>
                    <p className="text-purple-100 text-xs">Engineer share from paid service jobs</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white/10 rounded-xl">
                    <span className="text-purple-100 text-sm">This Month</span>
                    <span className="font-bold text-xl">{formatCurrency(stats.engineerTotalShare || 0)}</span>
                  </div>
                  <div className="pt-2 border-t border-white/20 space-y-1">
                    <div className="flex justify-between text-sm text-purple-100"><span>Service Share:</span><span>{formatCurrency(stats.engineerServiceShare || 0)}</span></div>
                    <div className="flex justify-between text-sm text-purple-100"><span>Parts Profit Share:</span><span>{formatCurrency(stats.engineerPartsShare || 0)}</span></div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* AI Action Center - 3 columns */}
      {superIntel && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center"><Brain className="w-4 h-4 text-violet-600" /></div>
                AI Forecast
                <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px] ml-auto">{superIntel.forecasts[0].confidence}% conf</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {superIntel.forecasts.slice(0, 2).map((f, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold">{f.period} • {f.trend}</p>
                      <p className="text-[11px] text-slate-600">Rs.{f.predictedSales.toLocaleString()} sales</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-700">Rs.{f.predictedProfit.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">{f.lowerBound.toLocaleString()} - {f.upperBound.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full text-xs h-8" onClick={() => onNavigate('ai')}>Full forecast →</Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
                Anomalies AI
                {superIntel.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length > 0 && <Badge className="bg-red-600 text-white text-[10px] ml-auto animate-pulse">{superIntel.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length} urgent</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 max-h-[180px] overflow-y-auto">
              {superIntel.anomalies.length === 0 ? (
                <div className="text-center py-4"><ShieldCheck className="w-8 h-8 mx-auto text-emerald-500" /><p className="text-xs text-slate-600 mt-1">No issues • All healthy ✓</p></div>
              ) : superIntel.anomalies.slice(0, 3).map((a, i) => (
                <div key={i} className={`p-2.5 rounded-xl border-l-4 ${a.severity === 'critical' ? 'border-red-500 bg-red-50' : a.severity === 'high' ? 'border-orange-500 bg-orange-50' : 'border-amber-400 bg-amber-50'}`}>
                  <p className="text-xs font-bold truncate">{a.title}</p>
                  <p className="text-[11px] text-slate-700 line-clamp-2 mt-0.5">{a.description}</p>
                  <p className="text-[10px] text-violet-700 font-medium mt-1">→ {a.action}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-emerald-600" /></div>
                Profit Leaks AI
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] ml-auto">Rs.{(superIntel.summary.totalLeakAmount/1000).toFixed(1)}k recoverable</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {superIntel.profitLeaks.length === 0 ? (
                <div className="text-center py-4"><Target className="w-8 h-8 mx-auto text-emerald-500" /><p className="text-xs text-slate-600 mt-1">No leaks • Optimized ✓</p></div>
              ) : superIntel.profitLeaks.slice(0, 2).map((l, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-slate-50 border">
                  <div className="flex justify-between"><p className="text-xs font-bold">{l.area}</p><p className="text-xs font-bold text-red-600">-Rs.{l.leakAmount.toLocaleString()}</p></div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{l.description}</p>
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">Fix: {l.fix}</p>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full text-xs h-8" onClick={() => onNavigate('ai')}>View all leaks →</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0"><ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /></div>Recent Invoices
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('invoices')} className="text-xs h-8">View All →</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentInvoices.length === 0 ? <EmptyState icon={FileText} message="No invoices yet" /> : (
              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                {recentInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onNavigate('invoices')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{inv.number}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 truncate">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">{formatCurrency(inv.grandTotal)}</p>
                      <Badge variant="outline" className={inv.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200 text-[9px] sm:text-[10px]' : inv.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200 text-[9px] sm:text-[10px]' : 'bg-red-50 text-red-700 border-red-200 text-[9px] sm:text-[10px]'}>{inv.paymentStatus}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center"><Wallet className="w-3.5 h-3.5 text-orange-600" /></div>Pending Payments</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('payments')} className="text-xs h-8">View All →</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingInvoices.length === 0 ? <EmptyState icon={CheckCircle2} message="All payments cleared!" iconColor="text-emerald-500" /> : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pendingInvoices.slice(0, 8).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onNavigate('payments')}>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900 truncate">{inv?.customer?.name || inv?.customerName || 'Walk-in'}</p><p className="text-xs text-slate-500">{inv?.number || ''} · {inv?.date ? new Date(inv.date).toLocaleDateString('en-IN') : ''}</p></div>
                    <div className="text-right flex-shrink-0 ml-2"><p className="text-sm font-semibold text-red-600">{formatCurrency(inv.amountDue)}</p><p className="text-[10px] text-slate-400 uppercase">{inv.paymentType}</p></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /></div>Low Stock Alert AI</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('stock')} className="text-xs h-8">Manage →</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {lowStockList.length === 0 ? <EmptyState icon={CheckCircle2} message="All items well stocked" iconColor="text-emerald-500" /> : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {lowStockList.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900 truncate">{item?.name || 'Unnamed'}</p><p className="text-xs text-slate-500">{item?.sku || ''} • AI suggests reorder</p></div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] flex-shrink-0">{item.quantity} {item.unit}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center"><MessageSquare className="w-3.5 h-3.5 text-emerald-600" /></div>WhatsApp Enquiries</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('whatsapp')} className="text-xs h-8">View All →</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentEnquiries.length === 0 ? <EmptyState icon={MessageSquare} message="No enquiries sent yet" /> : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recentEnquiries.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900 truncate">{e?.supplier?.name || e?.supplierName || 'Unknown'}</p><p className="text-xs text-slate-500">{e?.sentAt ? new Date(e.sentAt).toLocaleDateString('en-IN') : ''}</p></div>
                    <Badge variant="outline" className={e.status === 'rate_updated' ? 'bg-green-50 text-green-700 border-green-200 text-[10px]' : e.status === 'responded' ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]' : 'bg-slate-50 text-slate-600 border-slate-200 text-[10px]'}>{String(e?.status || '').replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PRO Footer */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 via-indigo-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Crown className="w-5 h-5 text-white" /></div>
              <div>
                <p className="font-bold text-sm">SmartComp PRO v7.0 • Super Intelligence Active</p>
                <p className="text-[11px] text-slate-600">AI Forecast • Anomaly Detection • Profit Leaks • Customer Churn • Stock Prediction • Automations • Command Center</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-emerald-600 text-white text-[10px]">✓ Zero API Cost</Badge>
              <Badge variant="outline" className="text-[10px]">✓ Offline</Badge>
              <Badge variant="outline" className="text-[10px]">✓ Private</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HeroCard({ label, value, sub, icon: Icon, gradient, loading, onClick, trend, isAI }: { label: string; value: string; sub: string; icon: any; gradient: string; loading: boolean; onClick: () => void; trend?: string; isAI?: boolean }) {
  if (loading) return <div className={`h-28 sm:h-32 rounded-2xl bg-gradient-to-br ${gradient} opacity-50 animate-pulse`} />
  return (
    <div onClick={onClick} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-3 sm:p-5 text-white shadow-lg cursor-pointer transition-transform active:scale-95 hover:scale-[1.02] hover:shadow-xl ${isAI ? 'ring-2 ring-violet-300 ring-offset-2' : ''}`}>
      <div className="absolute -right-6 -top-6 w-20 h-20 sm:w-24 sm:h-24 bg-white/10 rounded-full" />
      <div className="absolute -right-4 -bottom-4 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full" />
      {isAI && <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />}
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-white/80 uppercase tracking-wide flex items-center gap-1">{label} {trend && <span className="text-[10px] bg-white/20 px-1 rounded">{trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}</span>} {isAI && <Brain className="w-3 h-3" />}</p>
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

function MiniStat({ label, value, sub, icon: Icon, color, onClick, highlight }: { label: string; value: string; sub: string; icon: any; color: string; onClick: () => void; highlight?: boolean }) {
  return (
    <Card className={`border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-95 ${highlight ? 'ring-1 ring-amber-300 border-amber-200 bg-amber-50/50' : ''}`} onClick={onClick}>
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 sm:w-9 sm:h-9 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 uppercase truncate flex items-center gap-1">{label} {highlight && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />}</p>
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
    <div className="text-center py-8"><Icon className={`w-10 h-10 mx-auto mb-2 ${iconColor}`} /><p className="text-sm text-slate-500">{message}</p></div>
  )
}
