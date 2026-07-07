'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFetch } from '@/lib/api'
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
import {
  LayoutDashboard, Package, FileText, FileCheck2, Users,
  Building2, Wallet, MessageSquare, Settings, Store,
  Menu, X, Sparkles, ChevronRight, Loader2
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
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-600' },
]

export default function Home() {
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [configChecked, setConfigChecked] = useState(false)
  const [isConfigured, setIsConfigured] = useState(true)
  // Track which panels have been activated at least once — they stay mounted
  // afterwards so switching back is instant, but we don't load all 9 on first paint.
  const [mountedPanels, setMountedPanels] = useState<Set<string>>(new Set(['dashboard']))

  const { data: shop } = useFetch<any>('/api/shop', undefined)
  const { data: dashData } = useFetch<any>('/api/dashboard', undefined)

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
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-50 lg:z-40 w-[280px] sm:w-64 h-[100dvh] safe-top bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-transform duration-300 shadow-2xl`}
      >
        {/* Logo/Header */}
        <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm truncate">{shop?.name || 'Smart Computers'}</h1>
              <p className="text-[10px] text-slate-400">Sales & Service Panel</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-slate-700 h-9 w-9 p-0 flex-shrink-0"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1 scrollbar-thin overscroll-contain">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id
            const showBadge = (item.id === 'stock' && lowStockCount > 0) || (item.id === 'whatsapp' && pendingEnquiries > 0)
            const badgeCount = item.id === 'stock' ? lowStockCount : item.id === 'whatsapp' ? pendingEnquiries : 0

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] lg:min-h-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white active:bg-slate-700/70'
                }`}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : item.color}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {showBadge && (
                  <Badge className="bg-red-500 text-white hover:bg-red-500 text-[10px] px-1.5 py-0 min-w-5 justify-center flex-shrink-0">
                    {badgeCount}
                  </Badge>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/50 flex-shrink-0 safe-bottom">
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span>v1.0 · Ready for GitHub Render</span>
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col w-full">
        {/* Top bar - mobile only */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 p-3 flex items-center justify-between safe-top">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="p-2 h-10 w-10"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Store className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm truncate">{shop?.name || 'Smart Computers'}</span>
          </div>
          <div className="w-10 flex-shrink-0" />
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
          {mountedPanels.has('settings') && (
            <div className={active === 'settings' ? 'block' : 'hidden'}><SettingsPanel /></div>
          )}
        </div>
      </main>
    </div>
  )
}
