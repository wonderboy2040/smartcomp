'use client'

import { useState, useEffect, Suspense, lazy, useCallback, useMemo, memo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { useFetch, prefetch, invalidate } from '@/lib/api'
import { SetupWizard } from '@/components/SetupWizard'
import { useTheme } from '@/lib/theme-context'
import { PdfPreviewProvider } from '@/lib/preview-context'
import { DashboardView } from '@/components/panels/Dashboard'
import {
  LayoutDashboard, Package, FileText, FileCheck2, Users,
  Building2, Wallet, MessageSquare, Settings, Store,
  Menu, X, Sparkles, ChevronRight, Loader2, Wrench, LogOut, Receipt, BarChart3, Boxes, PiggyBank, FileSpreadsheet, Megaphone, ShieldAlert, FileSignature, Palette, Sun, Moon, Zap, Wifi, ShieldCheck,
  Brain, Bot, Command, Crown, Rocket
} from 'lucide-react'

// ===== DYNAMIC IMPORTS FOR HEAVY PANELS =====
const StockPanel = lazy(() => import('@/components/panels/Stock').then(m => ({ default: m.StockPanel })))
const InvoicesPanel = lazy(() => import('@/components/panels/Invoices').then(m => ({ default: m.InvoicesPanel })))
const QuotationsPanel = lazy(() => import('@/components/panels/Quotations').then(m => ({ default: m.QuotationsPanel })))
const CustomersPanel = lazy(() => import('@/components/panels/Customers').then(m => ({ default: m.CustomersPanel })))
const SuppliersPanel = lazy(() => import('@/components/panels/Suppliers').then(m => ({ default: m.SuppliersPanel })))
const PaymentsPanel = lazy(() => import('@/components/panels/Payments').then(m => ({ default: m.PaymentsPanel })))
const WhatsAppPanel = lazy(() => import('@/components/panels/WhatsApp').then(m => ({ default: m.WhatsAppPanel })))
const SettingsPanel = lazy(() => import('@/components/panels/Settings').then(m => ({ default: m.SettingsPanel })))
const JobsPanel = lazy(() => import('@/components/panels/Jobs').then(m => ({ default: m.JobsPanel })))
const ServicePaymentsPanel = lazy(() => import('@/components/panels/ServicePayments').then(m => ({ default: m.ServicePaymentsPanel })))
const ExpensesPanel = lazy(() => import('@/components/panels/Expenses').then(m => ({ default: m.ExpensesPanel })))
const ReportsPanel = lazy(() => import('@/components/panels/Reports').then(m => ({ default: m.ReportsPanel })))
const SerialsPanel = lazy(() => import('@/components/panels/Serials').then(m => ({ default: m.SerialsPanel })))
const PersonalExpenditurePanel = lazy(() => import('@/components/panels/PersonalExpenditure').then(m => ({ default: m.PersonalExpenditurePanel })))
const FinancialsPanel = lazy(() => import('@/components/panels/Financials').then(m => ({ default: m.FinancialsPanel })))
const CampaignsPanel = lazy(() => import('@/components/panels/Campaigns').then(m => ({ default: m.CampaignsPanel })))
const CreditControlPanel = lazy(() => import('@/components/panels/CreditControl').then(m => ({ default: m.CreditControlPanel })))
const AMCPanel = lazy(() => import('@/components/panels/AMC').then(m => ({ default: m.AMCPanel })))
const PosterMakerPanel = lazy(() => import('@/components/panels/PosterMaker').then(m => ({ default: m.PosterMakerPanel })))

// NEW PRO SUPER INTELLIGENCE PANELS v7.0
const AIIntelligencePanel = lazy(() => import('@/components/panels/AIIntelligence').then(m => ({ default: m.AIIntelligencePanel })))
const AutomationHubPanel = lazy(() => import('@/components/panels/AutomationHub').then(m => ({ default: m.AutomationHubPanel })))
const CommandCenterPanel = lazy(() => import('@/components/panels/CommandCenter').then(m => ({ default: m.CommandCenterPanel })))

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-slate-600', pro: false },
  { id: 'ai', label: 'AI Intelligence', icon: Brain, color: 'text-violet-400', pro: true, badge: 'SUPER' },
  { id: 'command', label: 'Command Center', icon: Command, color: 'text-indigo-400', pro: true, badge: '⌘K' },
  { id: 'automation', label: 'Automation Hub', icon: Bot, color: 'text-emerald-400', pro: true, badge: 'AUTO' },
  { id: 'stock', label: 'Stock', icon: Package, color: 'text-blue-600', pro: false },
  { id: 'invoices', label: 'Invoices', icon: FileText, color: 'text-emerald-600', pro: false },
  { id: 'quotations', label: 'Quotations', icon: FileCheck2, color: 'text-cyan-600', pro: false },
  { id: 'payments', label: 'Payments', icon: Wallet, color: 'text-orange-600', pro: false },
  { id: 'customers', label: 'Customers', icon: Users, color: 'text-pink-600', pro: false },
  { id: 'suppliers', label: 'Suppliers', icon: Building2, color: 'text-violet-600', pro: false },
  { id: 'whatsapp', label: 'WhatsApp Enquiry', icon: MessageSquare, color: 'text-green-600', pro: false },
  { id: 'jobs', label: 'Service Jobs', icon: Wrench, color: 'text-blue-600', pro: false },
  { id: 'servicepayments', label: 'Service Payments', icon: Wallet, color: 'text-purple-600', pro: false },
  { id: 'serials', label: 'Serials & Warranty', icon: Boxes, color: 'text-indigo-600', pro: false },
  { id: 'amc', label: 'AMC Contracts', icon: FileSignature, color: 'text-blue-600', pro: false },
  { id: 'expenses', label: 'Shop Expenses', icon: Receipt, color: 'text-red-600', pro: false },
  { id: 'personal', label: 'Personal Expenditure', icon: PiggyBank, color: 'text-pink-600', pro: false },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, color: 'text-green-600', pro: false },
  { id: 'credit', label: 'Credit Control', icon: ShieldAlert, color: 'text-red-600', pro: false },
  { id: 'financials', label: 'Financials (P&L)', icon: FileSpreadsheet, color: 'text-indigo-600', pro: false },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'text-indigo-600', pro: false },
  { id: 'poster', label: 'Poster Maker', icon: Palette, color: 'text-purple-600', pro: false },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-600', pro: false },
] as const

const PREFETCH_URLS = [
  '/api/items',
  '/api/customers',
  '/api/invoices?limit=200',
  '/api/suppliers',
  '/api/jobs',
  '/api/expenses',
]

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}>
      <HomeInner />
    </Suspense>
  )
}

function HomeInner() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'dashboard'
  const [active, setActive] = useState(initialTab)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [configChecked, setConfigChecked] = useState(false)
  const [isConfigured, setIsConfigured] = useState(true)
  const [mountedPanels, setMountedPanels] = useState<Set<string>>(() => new Set([initialTab]))
  const { theme, toggleTheme } = useTheme()

  const { data: shop } = useFetch<any>('/api/shop', undefined)
  const { data: dashData } = useFetch<any>('/api/dashboard', undefined)

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    PREFETCH_URLS.forEach((url, i) => {
      const t = setTimeout(() => {
        if (!cancelled) prefetch(url)
      }, 100 + i * 150)
      timers.push(t)
    })
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [isConfigured])

  useEffect(() => {
    if (!isConfigured) return
    const id = setInterval(() => {
      invalidate('/api/dashboard')
    }, 120000)
    return () => clearInterval(id)
  }, [isConfigured])

  useEffect(() => {
    let cancelled = false
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setIsConfigured(data.configured)
        setConfigChecked(true)
      })
      .catch(() => {
        if (cancelled) return
        setConfigChecked(true)
        setIsConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    const seeded = localStorage.getItem('seeded')
    if (!seeded) {
      fetch('/api/seed/init', { method: 'POST' })
        .then(() => localStorage.setItem('seeded', 'true'))
        .catch(() => {})
    }
  }, [isConfigured])

  // Keyboard shortcuts: Ctrl+K for Command Center, G+D etc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleNavigate('command')
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        handleNavigate('ai')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleNavigate = useCallback((tab: string) => {
    setActive(tab)
    setSidebarOpen(false)
    setMountedPanels((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const shopName = useMemo(() => shop?.name || 'Smart Computers', [shop])
  const activeItem = useMemo(() => NAV_ITEMS.find((item) => item.id === active) || NAV_ITEMS[0], [active])
  const ActiveIcon = activeItem.icon
  const todayLabel = useMemo(() => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date()), [])

  if (!configChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!isConfigured) {
    return <SetupWizard />
  }

  const lowStockCount = dashData?.stats?.lowStockCount || 0
  const pendingEnquiries = dashData?.stats?.pendingEnquiries || 0

  return (
    <div className="min-h-screen flex bg-background premium-app-shell">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-50 lg:z-40 w-[300px] sm:w-80 h-[100dvh] safe-top clay-sidebar premium-sidebar text-white flex flex-col transition-transform duration-300`}
      >
        {/* Logo/Header */}
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                boxShadow: '4px 4px 10px rgba(0,0,0,0.2), -2px -2px 6px rgba(255,255,255,0.1)',
              }}
            >
              <Store className="w-5 h-5 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm truncate flex items-center gap-1">{shopName} <Crown className="w-3 h-3 text-amber-400" /></h1>
              <p className="text-[10px] text-violet-300 flex items-center gap-1"><Rocket className="w-3 h-3" /> PRO v7.0 • Super Intelligence</p>
            </div>
            <button
              className="lg:hidden text-white h-9 w-9 p-0 flex-shrink-0 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Pro banner */}
          <div className="mt-3 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/30 p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-amber-200">PRO Super Intelligence Active</p>
                <p className="text-[9px] text-violet-200">AI • Automation • Command • Zero API Cost</p>
              </div>
              <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 animate-pulse border-0">LIVE</Badge>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin overscroll-contain">
          {/* Super Intelligence Group */}
          <div className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80 px-3 py-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Super Intelligence PRO</p>
            {NAV_ITEMS.filter(i => i.pro).map((item) => {
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 lg:py-3 rounded-2xl text-sm font-medium transition-all min-h-[48px] lg:min-h-[44px] relative overflow-hidden ${
                    isActive ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-violet-400/30' : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {isActive && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />}
                  <div className="relative flex items-center gap-3 w-full">
                    <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-white' : item.color}`} />
                    <span className="flex-1 text-left text-[13px] font-semibold">{item.label}</span>
                    <Badge className={`${isActive ? 'bg-white/20 text-white border-white/20' : 'bg-violet-500/20 text-violet-200 border-violet-400/20'} text-[9px] px-1.5 py-0 border`}>{(item as any).badge}</Badge>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="h-px bg-white/5 my-2" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500/80 px-3 py-1">Business Modules</p>

          {NAV_ITEMS.filter(i => !i.pro).map((item) => {
            const isActive = active === item.id
            const showBadge = (item.id === 'stock' && lowStockCount > 0) || (item.id === 'whatsapp' && pendingEnquiries > 0)
            const badgeCount = item.id === 'stock' ? lowStockCount : item.id === 'whatsapp' ? pendingEnquiries : 0

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 lg:py-3 rounded-2xl text-sm font-medium transition-all min-h-[48px] lg:min-h-[44px] ${
                  isActive ? 'clay-nav-active' : 'clay-nav-item text-slate-300'
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-white' : item.color}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {showBadge && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-5 text-center flex-shrink-0" style={{ boxShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
                    {badgeCount}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 flex-shrink-0 safe-bottom space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="rounded-xl p-2.5 flex items-center gap-1.5 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/20">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-violet-200">AI Engine v7.0 PRO Active</p>
              <p className="text-[9px] text-slate-400">Zero cost • Offline • Private</p>
            </div>
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <div className="rounded-xl p-2.5 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-300">v7.0 PRO • {theme === 'dark' ? 'Premium Dark' : 'Premium Light'}</span>
            <span className="ml-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="System healthy" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'rgba(255,255,255,0.04)' }}
              aria-label="Toggle light and dark theme"
              title="Toggle light/dark theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={async () => {
                if (confirm('Logout? You will need to enter PIN again to access the panel.')) {
                  try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
                  window.location.href = '/login'
                }
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <PdfPreviewProvider>
        <main className="flex-1 min-w-0 flex flex-col w-full premium-main">
        {/* Top bar - mobile only */}
        <header className="lg:hidden sticky top-0 z-30 p-3 flex items-center justify-between safe-top bg-card/90 backdrop-blur-xl border-b border-border shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 h-11 w-11 rounded-xl flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '2px 2px 6px rgba(99,102,241,0.3)' }}
            >
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm truncate text-foreground">{shopName}</span>
            <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0 text-[9px]">PRO v7</Badge>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 h-11 w-11 rounded-xl flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Toggle light and dark theme"
            title="Toggle light/dark theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-foreground" /> : <Moon className="w-5 h-5 text-foreground" />}
          </button>
        </header>

        {/* Premium desktop command bar */}
        <header className="hidden lg:block sticky top-0 z-30 border-b border-border/70 bg-background/72 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto w-full px-6 py-4">
            <div className="premium-topbar rounded-[1.75rem] border border-border/70 bg-card/78 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-5">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="premium-icon-orb w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-violet-600 to-indigo-600">
                    <ActiveIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-bold">{todayLabel} · Live Workspace</p>
                      <Badge className="premium-soft-badge border-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">v7.0 PRO • Super Intelligence</Badge>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-foreground truncate flex items-center gap-2">{activeItem.label} {(activeItem as any).pro && <Crown className="w-4 h-4 text-amber-500" />}</h2>
                    <p className="text-sm text-muted-foreground truncate">{shopName} business control center • AI + Automation • Zero API cost</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleNavigate('command')}
                    className="premium-mini-stat hidden xl:flex bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                    title="Command Center"
                  >
                    <Command className="w-4 h-4" />
                    <span>⌘K Command</span>
                  </button>
                  <button
                    onClick={() => handleNavigate('ai')}
                    className="premium-mini-stat hidden xl:flex bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    title="AI Intelligence"
                  >
                    <Brain className="w-4 h-4" />
                    <span>AI Hub</span>
                  </button>
                  <button
                    onClick={() => handleNavigate('stock')}
                    className="premium-mini-stat hidden xl:flex"
                    title="Open stock alerts"
                  >
                    <Package className="w-4 h-4 text-amber-500" />
                    <span>{lowStockCount} Low Stock</span>
                  </button>
                  <div className="premium-mini-stat">
                    <Wifi className="w-4 h-4 text-emerald-500" />
                    <span>Online • AI Live</span>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="premium-theme-toggle"
                    aria-label="Toggle light and dark theme"
                    title="Toggle light/dark theme"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full safe-bottom premium-content">
          <div className="premium-hero-strip hidden lg:flex items-center justify-between gap-4 mb-5 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 px-4 py-2">
            <div className="flex items-center gap-3 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-700 font-medium">PRO v7.0 • Super Intelligence • Zero API cost • Privacy-first • Offline capable</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-slate-600">Lazy panels + 120s cache + Automation Engine + Command Center + Voice</span>
            </div>
          </div>
          <PanelBoundary active={active} id="dashboard" mounted={mountedPanels.has('dashboard')}>
            <DashboardView onNavigate={handleNavigate} sheetsConnected={isConfigured} />
          </PanelBoundary>
          <PanelBoundary active={active} id="ai" mounted={mountedPanels.has('ai')}>
            <AIIntelligencePanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="command" mounted={mountedPanels.has('command')}>
            <CommandCenterPanel onNavigate={handleNavigate} />
          </PanelBoundary>
          <PanelBoundary active={active} id="automation" mounted={mountedPanels.has('automation')}>
            <AutomationHubPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="stock" mounted={mountedPanels.has('stock')}>
            <StockPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="invoices" mounted={mountedPanels.has('invoices')}>
            <InvoicesPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="quotations" mounted={mountedPanels.has('quotations')}>
            <QuotationsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="payments" mounted={mountedPanels.has('payments')}>
            <PaymentsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="customers" mounted={mountedPanels.has('customers')}>
            <CustomersPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="suppliers" mounted={mountedPanels.has('suppliers')}>
            <SuppliersPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="whatsapp" mounted={mountedPanels.has('whatsapp')}>
            <WhatsAppPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="jobs" mounted={mountedPanels.has('jobs')}>
            <JobsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="servicepayments" mounted={mountedPanels.has('servicepayments')}>
            <ServicePaymentsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="serials" mounted={mountedPanels.has('serials')}>
            <SerialsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="amc" mounted={mountedPanels.has('amc')}>
            <AMCPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="expenses" mounted={mountedPanels.has('expenses')}>
            <ExpensesPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="personal" mounted={mountedPanels.has('personal')}>
            <PersonalExpenditurePanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="campaigns" mounted={mountedPanels.has('campaigns')}>
            <CampaignsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="credit" mounted={mountedPanels.has('credit')}>
            <CreditControlPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="financials" mounted={mountedPanels.has('financials')}>
            <FinancialsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="reports" mounted={mountedPanels.has('reports')}>
            <ReportsPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="poster" mounted={mountedPanels.has('poster')}>
            <PosterMakerPanel />
          </PanelBoundary>
          <PanelBoundary active={active} id="settings" mounted={mountedPanels.has('settings')}>
            <SettingsPanel />
          </PanelBoundary>
        </div>
      </main>
      </PdfPreviewProvider>
    </div>
  )
}

const PanelBoundary = memo(function PanelBoundary({
  active,
  id,
  mounted,
  children,
}: {
  active: string
  id: string
  mounted: boolean
  children: React.ReactNode
}) {
  if (!mounted) return null
  const isSelected = active === id
  return (
    <div className={isSelected ? 'block premium-panel animate-in' : 'hidden'}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-7 h-7 animate-spin text-violet-500 mx-auto" />
              <p className="text-xs text-slate-500 mt-2">Loading {id} • PRO v7.0</p>
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  )
})
