'use client'

import { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFetch, prefetch, invalidate } from '@/lib/api'
import { useTheme } from '@/lib/theme-context'
import { SetupWizard } from '@/components/SetupWizard'
import { DashboardView } from '@/components/panels/Dashboard'
import {
  LayoutDashboard, Package, FileText, FileCheck2, Users,
  Building2, Wallet, MessageSquare, Settings, Store,
  Menu, X, Sparkles, ChevronRight, Loader2, Wrench, LogOut, Receipt, BarChart3, Boxes, PiggyBank, FileSpreadsheet, Megaphone, ShieldAlert, FileSignature, Palette, Sun, Moon, Monitor
} from 'lucide-react'

// ===== DYNAMIC IMPORTS FOR HEAVY PANELS =====
// Each panel is split into its own chunk, so the initial JS bundle stays small.
// Panels are only downloaded when the user first opens them.
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

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-slate-600' },
  { id: 'stock', label: 'Stock', icon: Package, color: 'text-blue-600' },
  { id: 'invoices', label: 'Invoices', icon: FileText, color: 'text-emerald-600' },
  { id: 'quotations', label: 'Quotations', icon: FileCheck2, color: 'text-cyan-600' },
  { id: 'payments', label: 'Payments', icon: Wallet, color: 'text-orange-600' },
  { id: 'customers', label: 'Customers', icon: Users, color: 'text-pink-600' },
  { id: 'suppliers', label: 'Suppliers', icon: Building2, color: 'text-violet-600' },
  { id: 'whatsapp', label: 'WhatsApp Enquiry', icon: MessageSquare, color: 'text-green-600' },
  { id: 'jobs', label: 'Service Jobs', icon: Wrench, color: 'text-blue-600' },
  { id: 'servicepayments', label: 'Service Payments', icon: Wallet, color: 'text-purple-600' },
  { id: 'serials', label: 'Serials & Warranty', icon: Boxes, color: 'text-indigo-600' },
  { id: 'amc', label: 'AMC Contracts', icon: FileSignature, color: 'text-blue-600' },
  { id: 'expenses', label: 'Shop Expenses', icon: Receipt, color: 'text-red-600' },
  { id: 'personal', label: 'Personal Expenditure', icon: PiggyBank, color: 'text-pink-600' },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, color: 'text-green-600' },
  { id: 'credit', label: 'Credit Control', icon: ShieldAlert, color: 'text-red-600' },
  { id: 'financials', label: 'Financials (P&L)', icon: FileSpreadsheet, color: 'text-indigo-600' },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'text-indigo-600' },
  { id: 'poster', label: 'Poster Maker', icon: Palette, color: 'text-purple-600' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-600' },
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
  const { theme, resolvedTheme, toggleTheme } = useTheme()
  // Track which panels have been activated at least once — they stay mounted
  // afterwards so switching back is instant, but we don't load all 20 on first paint.
  const [mountedPanels, setMountedPanels] = useState<Set<string>>(() => new Set([initialTab]))

  const { data: shop } = useFetch<any>('/api/shop', undefined)
  const { data: dashData } = useFetch<any>('/api/dashboard', undefined)

  // ULTRA FAST v4.0: Prefetch with更快 stagger 200ms + batch prefetch for ultra speed
  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    // Ultra fast: 100ms initial + 150ms stagger = all prefetched in <1s instead of 3s
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

  // PERFORMANCE: Background refresh every 2 minutes (matches server cache TTL).
  // Only refreshes dashboard stats - individual panels refresh when user visits them.
  useEffect(() => {
    if (!isConfigured) return
    const id = setInterval(() => {
      invalidate('/api/dashboard')
    }, 120000) // every 2 minutes
    return () => clearInterval(id)
  }, [isConfigured])

  // Check if APPS_SCRIPT_URL is configured
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

  // Auto-seed sample data on first load if configured
  useEffect(() => {
    if (!isConfigured) return
    const seeded = localStorage.getItem('seeded')
    if (!seeded) {
      fetch('/api/seed/init', { method: 'POST' })
        .then(() => localStorage.setItem('seeded', 'true'))
        .catch(() => {})
    }
  }, [isConfigured])

  // ===== ALL HOOKS MUST BE ABOVE THE EARLY RETURNS BELOW =====
  // (React's Rules of Hooks: hook count must not change between renders.
  //  Putting useCallback / useMemo after `if (!configChecked) return …`
  //  would cause React error #310 "Rendered more hooks than during the
  //  previous render" on the render where configChecked flips to true.)
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
  // ============================================================

  // Show setup wizard if not configured
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
    <div className="min-h-screen flex" style={{ background: 'var(--clay-bg)' }}>
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-50 lg:z-40 w-[280px] sm:w-72 h-[100dvh] safe-top clay-sidebar text-white flex flex-col transition-transform duration-300`}
      >
        {/* Logo/Header */}
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                boxShadow: '4px 4px 10px rgba(0,0,0,0.2), -2px -2px 6px rgba(255,255,255,0.1)',
              }}
            >
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm truncate">{shopName}</h1>
              <p className="text-[10px] text-slate-400">Sales & Service Panel</p>
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
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin overscroll-contain">
          {NAV_ITEMS.map((item) => {
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
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <span className="flex items-center gap-2">
              {theme === 'light' && <Moon className="w-3.5 h-3.5" />}
              {theme === 'dark' && <Sun className="w-3.5 h-3.5 text-amber-400" />}
              {theme === 'system' && <Monitor className="w-3.5 h-3.5 text-blue-400" />}
              <span>
                {theme === 'light' && 'Dark Mode'}
                {theme === 'dark' && 'System Mode'}
                {theme === 'system' && `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`}
              </span>
            </span>
            <span
              className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
              style={{ background: resolvedTheme === 'dark' ? '#6366f1' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                style={{
                  left: resolvedTheme === 'dark' ? '22px' : '2px',
                  background: resolvedTheme === 'dark' ? '#fff' : '#94a3b8',
                }}
              />
            </span>
          </button>
          <div className="rounded-xl p-2.5 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-300">v6.0.0 · Pro Edition Fixed</span>
            <span className="ml-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="System healthy" />
          </div>
          <button
            onClick={async () => {
              if (confirm('Logout? You will need to enter PIN again to access the panel.')) {
                try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
                window.location.href = '/login'
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
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
      <main className="flex-1 min-w-0 flex flex-col w-full">
        {/* Top bar - mobile only */}
        <header className="lg:hidden sticky top-0 z-30 p-3 flex items-center justify-between safe-top" style={{ background: 'var(--clay-surface)', boxShadow: '0 4px 12px var(--clay-shadow-dark)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--clay-surface)', boxShadow: '3px 3px 8px var(--clay-shadow-dark), -3px -3px 8px var(--clay-shadow-light)' }}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '2px 2px 6px rgba(99,102,241,0.3)' }}
            >
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{shopName}</span>
          </div>
          {/* Theme toggle on mobile */}
          <button
            onClick={toggleTheme}
            className="p-2 h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--clay-surface)', boxShadow: '3px 3px 8px var(--clay-shadow-dark), -3px -3px 8px var(--clay-shadow-light)' }}
            aria-label="Toggle theme"
            title={`Theme: ${theme}`}
          >
            {theme === 'light' && <Moon className="w-5 h-5" style={{ color: 'var(--foreground)' }} />}
            {theme === 'dark' && <Sun className="w-5 h-5 text-amber-400" />}
            {theme === 'system' && <Monitor className="w-5 h-5 text-blue-400" />}
          </button>
        </header>

        <div className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full safe-bottom">
          {/* Lazy-mount panels with dynamic imports.
              - Dashboard is eager (it's the default tab).
              - Every other panel is dynamically imported on first activation,
                so the initial JS payload stays small.
              - Once a panel has been mounted, it stays mounted (hidden via CSS)
                so subsequent tab switches are instant. */}
          <PanelBoundary active={active} id="dashboard" mounted={mountedPanels.has('dashboard')}>
            <DashboardView onNavigate={handleNavigate} sheetsConnected={isConfigured} />
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
    </div>
  )
}

/**
 * PanelBoundary wraps a dynamically-imported panel with:
 *   - CSS-based hide/show (display:none) so switching back is instant
 *   - A Suspense fallback while the panel chunk is loading
 *   - Lazy mounting: only renders children once the panel has ever been activated
 */
function PanelBoundary({
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
  return (
    <div className={active === id ? 'block' : 'hidden'}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  )
}
