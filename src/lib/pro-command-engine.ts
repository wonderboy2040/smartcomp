/**
 * SmartComp Pro Command Engine v7.0
 * Universal Search + Quick Actions + Voice + Natural Language
 * Spotlight-style command palette
 */

export interface Command {
  id: string
  title: string
  description: string
  category: 'navigation' | 'action' | 'create' | 'search' | 'report' | 'ai'
  icon: string
  keywords: string[]
  action: () => void | Promise<void>
  shortcut?: string
  premium?: boolean
}

export interface SearchResult {
  id: string
  type: 'invoice' | 'customer' | 'item' | 'job' | 'quotation' | 'payment' | 'supplier'
  title: string
  subtitle: string
  meta: string
  score: number
  url?: string
  data: any
}

export interface QuickStat {
  label: string
  value: string
  change: number
  trend: 'up' | 'down' | 'stable'
}

/**
 * Universal fuzzy search across all data
 */
export function universalSearch(
  query: string,
  data: {
    invoices?: any[]
    customers?: any[]
    items?: any[]
    jobs?: any[]
    quotations?: any[]
    suppliers?: any[]
  }
): SearchResult[] {
  if (!query || query.trim().length < 2) return []
  
  const q = query.toLowerCase().trim()
  const results: SearchResult[] = []

  const scoreMatch = (text: string, query: string): number => {
    const lower = text.toLowerCase()
    if (lower === query) return 100
    if (lower.startsWith(query)) return 90
    if (lower.includes(query)) return 70
    // fuzzy: check if all chars in order
    let qi = 0
    for (let i = 0; i < lower.length && qi < query.length; i++) {
      if (lower[i] === query[qi]) qi++
    }
    if (qi === query.length) return 40
    return 0
  }

  // Search invoices
  ;(data.invoices || []).forEach(inv => {
    const texts = [
      inv.number || '',
      inv.customerName || '',
      inv.customerPhone || '',
      String(inv.grandTotal || ''),
    ]
    const maxScore = Math.max(...texts.map(t => scoreMatch(t, q)))
    if (maxScore > 0) {
      results.push({
        id: `inv_${inv.id}`,
        type: 'invoice',
        title: inv.number || `INV ${inv.id?.slice(0, 8)}`,
        subtitle: inv.customerName || 'Customer',
        meta: `Rs.${Number(inv.grandTotal || 0).toLocaleString()} • ${inv.paymentStatus || 'unpaid'}`,
        score: maxScore + (inv.number?.toLowerCase().includes(q) ? 10 : 0),
        data: inv,
      })
    }
  })

  // Search customers
  ;(data.customers || []).forEach(cust => {
    const texts = [cust.name || '', cust.phone || '', cust.email || '']
    const maxScore = Math.max(...texts.map(t => scoreMatch(t, q)))
    if (maxScore > 0) {
      results.push({
        id: `cust_${cust.id}`,
        type: 'customer',
        title: cust.name,
        subtitle: cust.phone || cust.email || '',
        meta: `${cust.totalInvoices || 0} invoices • Rs.${Number(cust.totalSpent || 0).toLocaleString()} spent`,
        score: maxScore + 5,
        data: cust,
      })
    }
  })

  // Search items
  ;(data.items || []).forEach(item => {
    const texts = [item.name || '', item.sku || '', item.category || '', item.hsnCode || '']
    const maxScore = Math.max(...texts.map(t => scoreMatch(t, q)))
    if (maxScore > 0) {
      results.push({
        id: `item_${item.id}`,
        type: 'item',
        title: item.name,
        subtitle: `${item.sku} • ${item.category}`,
        meta: `${item.quantity} ${item.unit || 'pcs'} • Rs.${Number(item.sellingPrice || 0).toLocaleString()}`,
        score: maxScore,
        data: item,
      })
    }
  })

  // Search jobs
  ;(data.jobs || []).forEach(job => {
    const texts = [
      job.jobId || '',
      job.customerName || '',
      job.device || '',
      job.problem || '',
      job.customerPhone || '',
    ]
    const maxScore = Math.max(...texts.map(t => scoreMatch(t, q)))
    if (maxScore > 0) {
      results.push({
        id: `job_${job.id}`,
        type: 'job',
        title: job.jobId || `${job.device} - ${job.customerName}`,
        subtitle: `${job.customerName} • ${job.device}`,
        meta: `${job.status} • ${job.priority || 'Normal'} priority`,
        score: maxScore,
        data: job,
      })
    }
  })

  // Search quotations
  ;(data.quotations || []).forEach(qt => {
    const texts = [qt.number || '', qt.customerName || '']
    const maxScore = Math.max(...texts.map(t => scoreMatch(t, q)))
    if (maxScore > 0) {
      results.push({
        id: `qt_${qt.id}`,
        type: 'quotation',
        title: qt.number || `QT ${qt.id?.slice(0, 8)}`,
        subtitle: qt.customerName || 'Customer',
        meta: `Rs.${Number(qt.grandTotal || 0).toLocaleString()} • ${qt.status || 'sent'}`,
        score: maxScore,
        data: qt,
      })
    }
  })

  // Search suppliers
  ;(data.suppliers || []).forEach(sup => {
    const texts = [sup.name || '', sup.company || '', sup.phone || '']
    const maxScore = Math.max(...texts.map(t => scoreMatch(t, q)))
    if (maxScore > 0) {
      results.push({
        id: `sup_${sup.id}`,
        type: 'supplier',
        title: sup.name || sup.company,
        subtitle: sup.company || sup.phone,
        meta: sup.suppliedItems || '',
        score: maxScore,
        data: sup,
      })
    }
  })

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
}

/**
 * Generate smart quick actions based on context
 */
export function generateContextActions(data: {
  invoices?: any[]
  items?: any[]
  jobs?: any[]
  dashboard?: any
}): { title: string; description: string; icon: string; priority: number; actionId: string }[] {
  const actions: { title: string; description: string; icon: string; priority: number; actionId: string }[] = []

  // Low stock
  const lowStock = (data.items || []).filter((it: any) => Number(it.quantity) <= Number(it.minQuantity))
  if (lowStock.length > 0) {
    actions.push({
      title: `Reorder ${lowStock.length} Low Stock Items`,
      description: `${lowStock.slice(0, 2).map((i: any) => i.name).join(', ')}${lowStock.length > 2 ? ` +${lowStock.length - 2} more` : ''}`,
      icon: 'Package',
      priority: lowStock.length > 5 ? 100 : 70,
      actionId: 'reorder_low_stock',
    })
  }

  // Overdue invoices
  const overdue = (data.invoices || []).filter((inv: any) => Number(inv.amountDue) > 0)
  if (overdue.length > 0) {
    const totalDue = overdue.reduce((s: number, inv: any) => s + Number(inv.amountDue), 0)
    actions.push({
      title: `Collect Rs.${totalDue.toLocaleString()} Outstanding`,
      description: `${overdue.length} invoices pending payment`,
      icon: 'Wallet',
      priority: totalDue > 50000 ? 95 : 60,
      actionId: 'collect_payments',
    })
  }

  // Pending jobs
  const pendingJobs = (data.jobs || []).filter((j: any) => j.status === 'Pending' || j.status === 'In Progress')
  if (pendingJobs.length > 3) {
    actions.push({
      title: `${pendingJobs.length} Service Jobs Need Attention`,
      description: `${pendingJobs.filter((j: any) => j.priority === 'High').length} high priority`,
      icon: 'Wrench',
      priority: 80,
      actionId: 'view_pending_jobs',
    })
  }

  // Daily report
  const hour = new Date().getHours()
  if (hour >= 9 && hour <= 11) {
    actions.push({
      title: 'Review Morning Dashboard',
      description: 'Check today sales, payments, pending tasks',
      icon: 'BarChart3',
      priority: 40,
      actionId: 'view_dashboard',
    })
  }

  // AI insights
  actions.push({
    title: 'Generate AI Business Insights',
    description: 'Get super intelligence analysis & recommendations',
    icon: 'Brain',
    priority: 50,
    actionId: 'ai_insights',
  })

  return actions.sort((a, b) => b.priority - a.priority).slice(0, 6)
}

/**
 * Voice command processor (client-side intent mapping)
 */
export function processVoiceCommand(transcript: string): { intent: string; params: Record<string, string>; response: string } {
  const text = transcript.toLowerCase().trim()

  if (text.includes('show') && (text.includes('invoice') || text.includes('bill'))) {
    return {
      intent: 'navigate',
      params: { tab: 'invoices' },
      response: 'Showing invoices panel',
    }
  }
  if (text.includes('new invoice') || text.includes('create invoice')) {
    return {
      intent: 'create',
      params: { type: 'invoice' },
      response: 'Opening new invoice form',
    }
  }
  if (text.includes('stock') && (text.includes('show') || text.includes('open'))) {
    return { intent: 'navigate', params: { tab: 'stock' }, response: 'Opening stock panel' }
  }
  if (text.includes('customer')) {
    return { intent: 'navigate', params: { tab: 'customers' }, response: 'Opening customers' }
  }
  if (text.includes('dashboard') || text.includes('home')) {
    return { intent: 'navigate', params: { tab: 'dashboard' }, response: 'Going to dashboard' }
  }
  if (text.includes('service') || text.includes('job')) {
    return { intent: 'navigate', params: { tab: 'jobs' }, response: 'Opening service jobs' }
  }
  if (text.includes('report') || text.includes('analytics')) {
    return { intent: 'navigate', params: { tab: 'reports' }, response: 'Opening reports' }
  }
  if (text.includes('payment')) {
    return { intent: 'navigate', params: { tab: 'payments' }, response: 'Opening payments' }
  }
  if (text.match(/(search|find).*(invoice|bill).*(number|no)?\s*([a-z0-9\/-]+)/)) {
    const match = text.match(/([a-z0-9\/-]{3,})$/)
    return {
      intent: 'search',
      params: { query: match?.[1] || '', type: 'invoice' },
      response: `Searching for ${match?.[1]}`,
    }
  }
  if (text.includes('low stock')) {
    return { intent: 'search', params: { query: 'low stock', filter: 'lowStock' }, response: 'Finding low stock items' }
  }
  if (text.includes('how much') && text.includes('sales')) {
    return { intent: 'ai_query', params: { query: 'sales today' }, response: 'Checking sales data' }
  }

  return {
    intent: 'unknown',
    params: {},
    response: `Sorry, I didn't understand "${transcript}". Try: "show invoices", "new invoice", "low stock", "customers", "service jobs"`,
  }
}

// ===== KEYBOARD SHORTCUTS =====

export const KEYBOARD_SHORTCUTS = [
  { key: 'Ctrl+K / Cmd+K', description: 'Open Command Palette', category: 'Navigation' },
  { key: 'Ctrl+N / Cmd+N', description: 'New Invoice', category: 'Actions' },
  { key: 'Ctrl+J / Cmd+J', description: 'New Service Job', category: 'Actions' },
  { key: 'Ctrl+F / Cmd+F', description: 'Universal Search', category: 'Search' },
  { key: 'G then D', description: 'Go to Dashboard', category: 'Navigation' },
  { key: 'G then S', description: 'Go to Stock', category: 'Navigation' },
  { key: 'G then I', description: 'Go to Invoices', category: 'Navigation' },
  { key: 'G then C', description: 'Go to Customers', category: 'Navigation' },
  { key: 'G then J', description: 'Go to Jobs', category: 'Navigation' },
  { key: 'G then A', description: 'Go to AI Intelligence', category: 'Navigation' },
  { key: 'Ctrl+Shift+A', description: 'AI Insights', category: 'AI' },
  { key: '?', description: 'Show Shortcuts Help', category: 'Help' },
]
