'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFetch } from '@/lib/api'
import { universalSearch, generateContextActions, processVoiceCommand, KEYBOARD_SHORTCUTS } from '@/lib/pro-command-engine'
import {
  Search, Command, Sparkles, Mic, MicOff, Keyboard, Zap, TrendingUp,
  Package, FileText, Users, Wrench, Clock, ArrowRight, Brain, Lightbulb,
  Crown, Target, Bot, MessageSquare, History, Star
} from 'lucide-react'

export function CommandCenterPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { data: invoices } = useFetch<any[]>('/api/invoices?limit=200', undefined)
  const { data: items } = useFetch<any[]>('/api/items', undefined)
  const { data: customers } = useFetch<any[]>('/api/customers', undefined)
  const { data: jobs } = useFetch<any[]>('/api/jobs', undefined)
  const { data: quotations } = useFetch<any[]>('/api/quotations?limit=100', undefined)
  const { data: suppliers } = useFetch<any[]>('/api/suppliers', undefined)
  const { data: dashboard } = useFetch<any>('/api/dashboard', undefined)

  const [query, setQuery] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceResult, setVoiceResult] = useState<string>('')
  const [showShortcuts, setShowShortcuts] = useState(false)

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return universalSearch(query, { invoices, items, customers, jobs, quotations, suppliers })
  }, [query, invoices, items, customers, jobs, quotations, suppliers])

  const contextActions = useMemo(() => {
    return generateContextActions({ invoices, items, jobs, dashboard })
  }, [invoices, items, jobs, dashboard])

  const handleVoiceToggle = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser. Use Chrome/Edge.')
      return
    }
    if (isListening) {
      setIsListening(false)
      return
    }
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setVoiceResult(transcript)
      setQuery(transcript)
      const cmd = processVoiceCommand(transcript)
      if (cmd.intent === 'navigate' && onNavigate && cmd.params.tab) {
        onNavigate(cmd.params.tab)
      }
    }
    recognition.start()
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:p-6 text-white border border-slate-700">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Command className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">Command Center <Badge className="bg-white text-slate-900 text-[10px]">⌘K PRO</Badge></h1>
            <p className="text-slate-400 text-xs sm:text-sm">Spotlight search • Voice commands • Quick actions • Natural language</p>
          </div>
          <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowShortcuts(!showShortcuts)}>
            <Keyboard className="w-4 h-4 mr-1" /> Shortcuts
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="border-slate-200 shadow-lg overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600" />
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search anything... invoices, customers, stock, jobs, e.g. 'HP laptop' or 'Rahul' or 'INV-123'"
                className="pl-12 h-14 text-[15px] bg-slate-50 border-slate-200 rounded-xl"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] hidden sm:flex"><Command className="w-3 h-3 mr-1" />K</Badge>
              </div>
            </div>
            <Button
              variant={isListening ? "destructive" : "outline"}
              className="h-14 w-14 rounded-xl"
              onClick={handleVoiceToggle}
            >
              {isListening ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
            </Button>
          </div>

          {voiceResult && (
            <div className="mt-3 p-3 rounded-xl bg-violet-50 border border-violet-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-medium">Voice heard: "{voiceResult}"</span>
              <Badge className="bg-violet-600 text-white text-[10px] ml-auto">{processVoiceCommand(voiceResult).intent}</Badge>
            </div>
          )}

          {query && searchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">{searchResults.length} results for "{query}"</p>
              {searchResults.map(result => (
                <div key={result.id} className="group flex items-center gap-3 p-3 rounded-xl border bg-white hover:bg-slate-50 hover:border-violet-200 cursor-pointer transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${result.type === 'invoice' ? 'bg-emerald-100 text-emerald-600' : result.type === 'customer' ? 'bg-pink-100 text-pink-600' : result.type === 'item' ? 'bg-blue-100 text-blue-600' : result.type === 'job' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                    {result.type === 'invoice' ? <FileText className="w-5 h-5" /> : result.type === 'customer' ? <Users className="w-5 h-5" /> : result.type === 'item' ? <Package className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{result.title}</p>
                    <p className="text-[11px] text-slate-600 truncate">{result.subtitle}</p>
                    <p className="text-[10px] text-slate-500 truncate">{result.meta}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px]">{result.type}</Badge>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {query && searchResults.length === 0 && (
            <div className="mt-6 text-center py-6">
              <Search className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm text-slate-500 mt-2">No results for "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try different keywords or check spelling</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-slate-200 md:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Smart Quick Actions • AI Suggested</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {contextActions.map((action, i) => (
              <div key={i} className="group flex items-center gap-3 p-3 rounded-xl border bg-white hover:bg-gradient-to-r hover:from-violet-50 hover:to-indigo-50 hover:border-violet-200 cursor-pointer transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-violet-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-violet-700">{action.priority}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-[11px] text-slate-600 truncate">{action.description}</p>
                </div>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">Do it →</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 bg-gradient-to-br from-violet-600 to-indigo-700 text-white overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3"><Brain className="w-5 h-5" /><p className="font-bold text-sm">AI Business Copilot</p></div>
              <p className="text-xs text-violet-100">Ask anything in plain English/Hindi mix. I understand your business data deeply.</p>
              <div className="mt-3 space-y-1.5">
                {["sales this month", "low stock", "top customers", "pending jobs"].map(ex => (
                  <button key={ex} onClick={() => setQuery(ex)} className="block w-full text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-colors">"{ex}" →</button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2"><History className="w-4 h-4" /> Recent Searches</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {['HP Laptop', 'Rahul', 'INV-001', 'low stock', 'pending jobs'].map((s, i) => (
                <button key={i} onClick={() => setQuery(s)} className="flex items-center gap-2 w-full text-left p-2 rounded-lg hover:bg-slate-50 text-xs">
                  <Clock className="w-3 h-3 text-slate-400" /> {s}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {showShortcuts && (
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Keyboard className="w-4 h-4" /> Keyboard Shortcuts • Pro Power User</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {KEYBOARD_SHORTCUTS.map((s, i) => (
                <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border">
                  <span className="text-xs text-slate-600">{s.description}</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white">{s.key}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Premium features teaser */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0"><Crown className="w-5 h-5 text-white" /></div>
            <div>
              <p className="font-bold text-sm">PRO Power Features Enabled</p>
              <p className="text-xs text-slate-700 mt-1">✓ Universal search across 6 modules • ✓ Voice commands (Hindi+English) • ✓ AI natural language queries • ✓ Context-aware quick actions • ✓ Keyboard shortcuts • ✓ Command palette (⌘K)</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-amber-500 text-white text-[10px]">Zero API Cost</Badge>
                <Badge variant="outline" className="text-[10px]">Offline First</Badge>
                <Badge variant="outline" className="text-[10px]">Privacy-Private</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
