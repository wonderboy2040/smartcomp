'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AUTOMATION_TEMPLATES, getAutomationEngine, type AutomationRule, type AutomationLog } from '@/lib/automation-engine'
import {
  Bot, Zap, Play, Pause, Plus, Settings, Clock, CheckCircle, AlertCircle,
  BarChart3, Sparkles, Brain, Workflow, Timer, Target, Activity,
  Package, Wallet, Users, Wrench, Megaphone, FileText, Heart, Cake, ShieldCheck,
  TrendingUp, Bell, Mail, MessageSquare, Webhook, Database, Crown
} from 'lucide-react'

const iconMap: Record<string, any> = {
  HandHeart: Heart,
  Package: Package,
  Bot: Bot,
  Clock: Clock,
  CheckCircle: CheckCircle,
  AlertTriangle: AlertCircle,
  Heart: Heart,
  BarChart3: BarChart3,
  Brain: Brain,
  Receipt: FileText,
  Cake: Cake,
  FileText: FileText,
  Wrench: Wrench,
  Wallet: Wallet,
}

export function AutomationHubPanel() {
  const [rules, setRules] = useState<AutomationRule[]>(AUTOMATION_TEMPLATES)
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [activeTab, setActiveTab] = useState<'rules' | 'logs' | 'stats' | 'builder'>('rules')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    const engine = getAutomationEngine()
    setRules(engine.getRules())
    setLogs(engine.getLogs(50))
  }, [])

  const engine = getAutomationEngine()
  const stats = engine.getStats()

  const filteredRules = rules.filter(r => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
    const matchesCat = categoryFilter === 'all' || r.category === categoryFilter
    return matchesSearch && matchesCat
  })

  const toggleRule = (id: string) => {
    const rule = rules.find(r => r.id === id)
    if (!rule) return
    if (rule.enabled) engine.disableRule(id)
    else engine.enableRule(id)
    setRules([...engine.getRules()])
  }

  const runRuleNow = async (id: string) => {
    try {
      const log = await engine.executeRule(id, { manual: true, triggeredBy: 'user', timestamp: new Date().toISOString() })
      setLogs([log, ...engine.getLogs(50)])
    } catch (e) {
      console.error(e)
    }
  }

  const categories = [
    { id: 'all', label: 'All', count: rules.length },
    { id: 'sales', label: 'Sales', count: rules.filter(r => r.category === 'sales').length },
    { id: 'stock', label: 'Stock', count: rules.filter(r => r.category === 'stock').length },
    { id: 'customer', label: 'Customer', count: rules.filter(r => r.category === 'customer').length },
    { id: 'service', label: 'Service', count: rules.filter(r => r.category === 'service').length },
    { id: 'finance', label: 'Finance', count: rules.filter(r => r.category === 'finance').length },
    { id: 'marketing', label: 'Marketing', count: rules.filter(r => r.category === 'marketing').length },
  ]

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'sales': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'stock': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'customer': return 'bg-pink-100 text-pink-700 border-pink-200'
      case 'service': return 'bg-cyan-100 text-cyan-700 border-cyan-200'
      case 'finance': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'marketing': return 'bg-violet-100 text-violet-700 border-violet-200'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-5 sm:p-7 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-500/15 rounded-full blur-2xl" />
        
        <div className="relative flex flex-col lg:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Workflow className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">Automation Hub <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 border-0 text-[10px] font-bold">PRO</Badge></h1>
                <p className="text-slate-300 text-xs sm:text-sm mt-1">No-code workflows • Save 10+ hours/week • Auto-pilot your shop</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="bg-white/10 text-slate-200 border-white/10 text-[10px]"><Bot className="w-3 h-3 mr-1" /> 12 Pre-built Templates</Badge>
              <Badge variant="outline" className="bg-white/10 text-slate-200 border-white/10 text-[10px]"><Zap className="w-3 h-3 mr-1" /> Instant Triggers</Badge>
              <Badge variant="outline" className="bg-white/10 text-slate-200 border-white/10 text-[10px]"><ShieldCheck className="w-3 h-3 mr-1" /> No Coding Needed</Badge>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/10 p-3 text-center">
              <p className="text-[10px] text-slate-300 uppercase">Active</p>
              <p className="text-xl font-bold">{stats.enabledRules}</p>
              <p className="text-[10px] text-emerald-300">{stats.totalRules} total</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/10 p-3 text-center">
              <p className="text-[10px] text-slate-300 uppercase">Runs</p>
              <p className="text-xl font-bold">{stats.totalRuns}</p>
              <p className="text-[10px] text-blue-300">{stats.runsLast24h} today</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/10 p-3 text-center">
              <p className="text-[10px] text-slate-300 uppercase">Success</p>
              <p className="text-xl font-bold">{stats.avgSuccessRate}%</p>
              <p className="text-[10px] text-violet-300">avg rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto">
        {[
          { id: 'rules', label: 'Workflows', icon: Workflow },
          { id: 'logs', label: 'Activity Log', icon: Activity },
          { id: 'stats', label: 'Analytics', icon: BarChart3 },
          { id: 'builder', label: 'Builder', icon: Plus },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-white shadow text-indigo-700 border border-indigo-100' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="border-slate-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows... e.g. low stock, payment, welcome" className="h-10 bg-slate-50" />
                </div>
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${categoryFilter === cat.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {cat.label} ({cat.count})
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rules grid */}
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
            {filteredRules.map(rule => {
              const Icon = iconMap[rule.icon] || Bot
              const isEnabled = rule.enabled
              return (
                <Card key={rule.id} className={`border transition-all hover:shadow-md ${isEnabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/50 opacity-75'}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isEnabled ? `bg-${rule.color}-100 text-${rule.color}-600` : 'bg-slate-200 text-slate-500'} border`} style={{ backgroundColor: isEnabled ? undefined : undefined }}>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${rule.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : rule.color === 'orange' ? 'bg-orange-100 text-orange-600' : rule.color === 'blue' ? 'bg-blue-100 text-blue-600' : rule.color === 'red' ? 'bg-red-100 text-red-600' : rule.color === 'green' ? 'bg-green-100 text-green-600' : rule.color === 'amber' ? 'bg-amber-100 text-amber-600' : rule.color === 'pink' ? 'bg-pink-100 text-pink-600' : rule.color === 'violet' ? 'bg-violet-100 text-violet-600' : rule.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm flex items-center gap-2">
                              {rule.name}
                              {rule.isTemplate && <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200"><Crown className="w-2.5 h-2.5 mr-0.5" /> TEMPLATE</Badge>}
                            </p>
                            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{rule.description}</p>
                          </div>
                          <Switch checked={isEnabled} onCheckedChange={() => toggleRule(rule.id)} />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          <Badge variant="outline" className={`${getCategoryColor(rule.category)} text-[10px] border`}>{rule.category}</Badge>
                          <Badge variant="outline" className="text-[10px]"><Timer className="w-3 h-3 mr-1" />{rule.trigger.type.replace('_', ' ')}</Badge>
                          <Badge variant="outline" className="text-[10px]"><Zap className="w-3 h-3 mr-1" />{rule.actions.length} action{rule.actions.length > 1 ? 's' : ''}</Badge>
                          <Badge variant="outline" className="text-[10px] bg-slate-50">{rule.stats.totalRuns} runs • {rule.stats.successRate}% success</Badge>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => runRuleNow(rule.id)}>
                            <Play className="w-3 h-3 mr-1" /> Run Now
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs">
                            <Settings className="w-3 h-3 mr-1" /> Configure
                          </Button>
                          {isEnabled ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 ml-auto text-[10px]">ACTIVE • Auto</Badge> : <Badge variant="outline" className="ml-auto text-[10px]">Paused</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredRules.length === 0 && (
            <Card className="border-dashed"><CardContent className="p-8 text-center"><Bot className="w-10 h-10 mx-auto text-slate-300" /><p className="text-sm text-slate-500 mt-2">No workflows match your filter</p></CardContent></Card>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /> Automation Activity Log • Last 50 Runs</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-10">
                <Timer className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm text-slate-500 mt-2">No activity yet. Enable workflows to see logs here.</p>
                <p className="text-xs text-slate-400 mt-1">Logs appear when automations trigger automatically or you Run Now</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className={`p-3 rounded-xl border flex gap-3 ${log.status === 'success' ? 'bg-emerald-50/50 border-emerald-100' : log.status === 'failed' ? 'bg-red-50 border-red-100' : log.status === 'skipped' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${log.status === 'success' ? 'bg-emerald-100 text-emerald-600' : log.status === 'failed' ? 'bg-red-100 text-red-600' : log.status === 'skipped' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'}`}>
                      {log.status === 'success' ? <CheckCircle className="w-4 h-4" /> : log.status === 'failed' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-xs">{log.ruleName}</p>
                        <Badge variant="outline" className="text-[10px]">{log.trigger.replace('_', ' ')}</Badge>
                        <Badge className={`${log.status === 'success' ? 'bg-emerald-600 text-white' : log.status === 'failed' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'} text-[10px]`}>{log.status}</Badge>
                        <span className="text-[10px] text-slate-500 ml-auto">{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{log.message} • {log.executionTimeMs}ms</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'stats' && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm">Automation Impact</CardTitle></CardHeader><CardContent className="space-y-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100"><p className="text-[11px] text-violet-700 uppercase">Time Saved (Est)</p><p className="text-2xl font-bold text-violet-900">{stats.totalRuns * 3} min</p><p className="text-[11px] text-violet-600">Based on {stats.totalRuns} automated runs × 3 min avg manual</p></div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100"><p className="text-[11px] text-emerald-700 uppercase">Success Rate</p><p className="text-2xl font-bold text-emerald-900">{stats.avgSuccessRate}%</p><p className="text-[11px] text-emerald-600">{stats.successLast24h}/{stats.runsLast24h} successful last 24h</p></div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100"><p className="text-[11px] text-blue-700 uppercase">Active Workflows</p><p className="text-2xl font-bold text-blue-900">{stats.enabledRules}/{stats.totalRules}</p><p className="text-[11px] text-blue-600">Enable more to save more time</p></div>
          </CardContent></Card>

          <Card className="border-slate-200 md:col-span-2"><CardHeader><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader><CardContent>
            <div className="space-y-2">
              {[
                { cat: 'sales', label: 'Sales Automation', icon: TrendingUp, color: 'blue' },
                { cat: 'stock', label: 'Stock Management', icon: Package, color: 'orange' },
                { cat: 'customer', label: 'Customer Engagement', icon: Users, color: 'pink' },
                { cat: 'service', label: 'Service Operations', icon: Wrench, color: 'cyan' },
                { cat: 'finance', label: 'Finance & Collections', icon: Wallet, color: 'emerald' },
                { cat: 'marketing', label: 'Marketing & Winback', icon: Megaphone, color: 'violet' },
              ].map(item => {
                const count = rules.filter(r => r.category === item.cat).length
                const enabled = rules.filter(r => r.category === item.cat && r.enabled).length
                const pct = count > 0 ? (enabled / count) * 100 : 0
                return (
                  <div key={item.cat} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                    <div className={`w-8 h-8 rounded-lg bg-${item.color}-100 text-${item.color}-600 flex items-center justify-center`}><item.icon className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <div className="flex justify-between"><p className="text-xs font-medium">{item.label}</p><p className="text-[11px] text-slate-500">{enabled}/{count} active</p></div>
                      <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} /></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent></Card>
        </div>
      )}

      {activeTab === 'builder' && (
        <Card className="border-slate-200 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Plus className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-lg mt-4">Custom Workflow Builder (PRO)</h3>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">Drag & drop triggers, conditions, and actions to build your own automation. Coming in v7.1 - Currently use templates which cover 90% needs!</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 max-w-2xl mx-auto text-left">
              <div className="p-3 rounded-xl bg-slate-50 border"><p className="text-xs font-bold flex items-center gap-1"><Bell className="w-3 h-3" /> Triggers (10+)</p><p className="text-[11px] text-slate-600 mt-1">Invoice created, low stock, payment overdue, job completed, customer inactive, custom schedule...</p></div>
              <div className="p-3 rounded-xl bg-slate-50 border"><p className="text-xs font-bold flex items-center gap-1"><Target className="w-3 h-3" /> Conditions</p><p className="text-[11px] text-slate-600 mt-1">If amount {'>'} 5000, if customer VIP, if stock {'<'} min, days since etc...</p></div>
              <div className="p-3 rounded-xl bg-slate-50 border"><p className="text-xs font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> Actions (12+)</p><p className="text-[11px] text-slate-600 mt-1">Send WhatsApp, email, create task, reorder, notify, webhook, generate report...</p></div>
            </div>
            <Button className="mt-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white"><Sparkles className="w-4 h-4 mr-2" /> Request Early Access - v7.1 Builder</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
