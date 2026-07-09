'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFetch, prefetch, invalidate } from '@/lib/api'
import { useTheme } from '@/lib/theme-context'
import { SetupWizard } from '@/components/SetupWizard'
import { DashboardView } from '@/components/panels/Dashboard'
import { StockPanel } from '@/components/panels/Stock'
import { InvoicesPanel } from '@/components/panels/Invoices'
import { QuotationsPanel } from '@/components/panels/Quotations'
import { CustomersPanel } from '@/components/panels/Customers'
import { SuppliersPanel } from '@/components/panels/Suppliers'
import { PaymentsPanel } from '@/components/panels/Payments'
import { WhatsAppPanel } from '@/components/panels/WhatsApp'
import { SettingsPanel } from '@/components/panels/Settings'
import { JobsPanel } from '@/components/panels/Jobs'
import { ServicePaymentsPanel } from '@/components/panels/ServicePayments'
import { ExpensesPanel } from '@/components/panels/Expenses'
import { ReportsPanel } from '@/components/panels/Reports'
import { SerialsPanel } from '@/components/panels/Serials'
import { PersonalExpenditurePanel } from '@/components/panels/PersonalExpenditure'
import { FinancialsPanel } from '@/components/panels/Financials'
import { CampaignsPanel } from '@/components/panels/Campaigns'
import { CreditControlPanel } from '@/components/panels/CreditControl'
import { AMCPanel } from '@/components/panels/AMC'
import { PosterMakerPanel } from '@/components/panels/PosterMaker'
import {
  LayoutDashboard, Package, FileText, FileCheck2, Users,
  Building2, Wallet, MessageSquare, Settings, Store,
  Menu, X, Sparkles, ChevronRight, Loader2, Wrench, LogOut, Receipt, BarChart3, Boxes, PiggyBank, FileSpreadsheet, Megaphone, ShieldAlert, FileSignature, Palette, Sun, Moon
} from 'lucide-react'

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
  const { theme, toggleTheme } = useTheme()
  // Track which panels have been activated at least once — they stay mounted
  // afterwards so switching back is instant, but we don't load all 9 on first paint.
  const [mountedPanels, setMountedPanels] = useState<Set<string>>(new Set([initialTab]))

  const { data: shop } = useFetch<any>('/api/shop', undefined)
  const { data: dashData } = useFetch<any>('/api/dashboard', undefined)

  // PERFORMANCE: Prefetch the most commonly used panel data in the background.
  // Only prefetch the top 4 panels - others load on demand when clicked.
  // Stagger by 500ms so we don't hammer Apps Script all at once.
  useEffect(() => {
    if (!isConfigured) return
    const urls = [
      '/api/items',
      '/api/customers',
      '/api/invoices?limit=200',
      '/api/suppliers',
      '/api/jobs',
      '/api/expenses',
    ]
    urls.forEach((url, i) => {
      setTimeout(() => prefetch(url), 500 + i * 500)
    })
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
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setIsConfigured(data.configured)
        setConfigChecked(true)
      })
      .catch(() => {
        setConfigChecked(true)
        setIsConfigured(false)
      })
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

  const handleNavigate = (tab: string) => {
    setActive(tab)
    setSidebarOpen(false)
    // Lazily mount the panel — it stays mounted afterwards so future switches are instant
    setMountedPanels((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

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
              <h1 className="font-bold text-sm truncate">{shop?.name || 'Smart Computers'}</h1>
              <p className="text-[10px] text-slate-400">Sales & Service Panel</p>
            </div>
            <button
              className="lg:hidden text-white h-9 w-9 p-0 flex-shrink-0 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}
              onClick={() => setSidebarOpen(false)}
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
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
            <span
              className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
              style={{ background: theme === 'dark' ? '#6366f1' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                style={{
                  left: theme === 'dark' ? '22px' : '2px',
                  background: theme === 'dark' ? '#fff' : '#94a3b8',
                }}
              />
            </span>
          </button>
          <div className="rounded-xl p-2.5 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Sparkles className="w-3 h-3 text-indigo-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-400">v2.0 · Claymorphism Edition</span>
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
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{shop?.name || 'Smart Computers'}</span>
          </div>
          {/* Theme toggle on mobile */}
          <button
            onClick={toggleTheme}
            className="p-2 h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--clay-surface)', boxShadow: '3px 3px 8px var(--clay-shadow-dark), -3px -3px 8px var(--clay-shadow-light)' }}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" style={{ color: 'var(--foreground)' }} /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>
        </header>

        <div className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full safe-bottom">
          {/* Lazy-mount panels: only mount a panel once it's been activated,
              but keep it mounted afterwards so switching back is instant.
              This avoids firing 9 parallel Apps Script calls on first load. */}
          {mountedPanels.has('dashboard') && (
            <div className={active === 'dashboard' ? 'block' : 'hidden'}><DashboardView onNavigate={handleNavigate} /></div>
          )}
          {mountedPanels.has('stock') && (
            <div className={active === 'stock' ? 'block' : 'hidden'}><StockPanel /></div>
          )}
          {mountedPanels.has('invoices') && (
            <div className={active === 'invoices' ? 'block' : 'hidden'}><InvoicesPanel /></div>
          )}
          {mountedPanels.has('quotations') && (
            <div className={active === 'quotations' ? 'block' : 'hidden'}><QuotationsPanel /></div>
          )}
          {mountedPanels.has('payments') && (
            <div className={active === 'payments' ? 'block' : 'hidden'}><PaymentsPanel /></div>
          )}
          {mountedPanels.has('customers') && (
            <div className={active === 'customers' ? 'block' : 'hidden'}><CustomersPanel /></div>
          )}
          {mountedPanels.has('suppliers') && (
            <div className={active === 'suppliers' ? 'block' : 'hidden'}><SuppliersPanel /></div>
          )}
          {mountedPanels.has('whatsapp') && (
            <div className={active === 'whatsapp' ? 'block' : 'hidden'}><WhatsAppPanel /></div>
          )}
          {mountedPanels.has('jobs') && (
            <div className={active === 'jobs' ? 'block' : 'hidden'}><JobsPanel /></div>
          )}
          {mountedPanels.has('servicepayments') && (
            <div className={active === 'servicepayments' ? 'block' : 'hidden'}><ServicePaymentsPanel /></div>
          )}
          {mountedPanels.has('serials') && (
            <div className={active === 'serials' ? 'block' : 'hidden'}><SerialsPanel /></div>
          )}
          {mountedPanels.has('amc') && (
            <div className={active === 'amc' ? 'block' : 'hidden'}><AMCPanel /></div>
          )}
          {mountedPanels.has('expenses') && (
            <div className={active === 'expenses' ? 'block' : 'hidden'}><ExpensesPanel /></div>
          )}
          {mountedPanels.has('personal') && (
            <div className={active === 'personal' ? 'block' : 'hidden'}><PersonalExpenditurePanel /></div>
          )}
          {mountedPanels.has('campaigns') && (
            <div className={active === 'campaigns' ? 'block' : 'hidden'}><CampaignsPanel /></div>
          )}
          {mountedPanels.has('credit') && (
            <div className={active === 'credit' ? 'block' : 'hidden'}><CreditControlPanel /></div>
          )}
          {mountedPanels.has('financials') && (
            <div className={active === 'financials' ? 'block' : 'hidden'}><FinancialsPanel /></div>
          )}
          {mountedPanels.has('reports') && (
            <div className={active === 'reports' ? 'block' : 'hidden'}><ReportsPanel /></div>
          )}
          {mountedPanels.has('poster') && (
            <div className={active === 'poster' ? 'block' : 'hidden'}><PosterMakerPanel /></div>
          )}
          {mountedPanels.has('settings') && (
            <div className={active === 'settings' ? 'block' : 'hidden'}><SettingsPanel /></div>
          )}
        </div>
      </main>
    </div>
  )
}
