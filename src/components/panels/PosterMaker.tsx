'use client'

import { useState, useRef, useCallback } from 'react'
import { useFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { toPng } from 'html-to-image'
import {
  Image as ImageIcon, Download, Plus, Trash2, Palette, Phone, MapPin,
  Shield, Zap, Star, CheckCircle, Cpu, HardDrive, Monitor, Keyboard, Mouse, Printer,
} from 'lucide-react'

const RESOLUTIONS = [
  { id: '719x1160', name: '719 × 1160', w: 719, h: 1160, label: 'Story / Tall' },
  { id: '853x1280', name: '853 × 1280', w: 853, h: 1280, label: 'Poster / Print' },
  { id: '1280x1600', name: '1280 × 1600', w: 1280, h: 1600, label: 'FHD Large' },
]

// 10 PREMIUM TEMPLATES inspired by reference designs
const TEMPLATES = [
  // 1. Apex Tech Style — dark header + light body + spec boxes
  { id: 'apex-tech', name: 'Apex Tech', bg: '#f0f2f5', headerBg: '#1e293b', accent: '#3b82f6', accent2: '#ffffff', style: 'apex' },
  // 2. Teal Product — teal gradient + central product
  { id: 'teal-product', name: 'Teal Product', bg: 'linear-gradient(180deg, #134e4a 0%, #0d9488 60%, #115e59 100%)', headerBg: 'transparent', accent: '#5eead4', accent2: '#fbbf24', style: 'teal' },
  // 3. Service Pro — blue/orange service poster
  { id: 'service-pro', name: 'Service Pro', bg: '#1e3a5f', headerBg: '#1e3a5f', accent: '#f97316', accent2: '#fbbf24', style: 'service' },
  // 4. Tech Clean — silver/blue minimal
  { id: 'tech-clean', name: 'Tech Clean', bg: 'linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)', headerBg: '#334155', accent: '#3b82f6', accent2: '#ef4444', style: 'clean' },
  // 5. Dark Premium — black with gold
  { id: 'dark-premium', name: 'Dark Premium', bg: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)', headerBg: 'transparent', accent: '#fbbf24', accent2: '#f59e0b', style: 'dark' },
  // 6. Split Design — top dark, bottom light
  { id: 'split-design', name: 'Split Design', bg: '#ffffff', headerBg: '#1e40af', accent: '#1e40af', accent2: '#f59e0b', style: 'split' },
  // 7. Bold Offer — large offer text
  { id: 'bold-offer', name: 'Bold Offer', bg: 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)', headerBg: 'transparent', accent: '#fb923c', accent2: '#fde047', style: 'bold' },
  // 8. Corporate Navy — formal
  { id: 'corporate-navy', name: 'Corporate', bg: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)', headerBg: 'transparent', accent: '#60a5fa', accent2: '#dbeafe', style: 'corporate' },
  // 9. RGB Gaming — dark with purple/green
  { id: 'rgb-gaming', name: 'RGB Gaming', bg: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #1e1b4b 100%)', headerBg: 'transparent', accent: '#a855f7', accent2: '#22c55e', style: 'gaming' },
  // 10. Minimal White — clean white with accent
  { id: 'minimal-white', name: 'Minimal White', bg: '#ffffff', headerBg: '#ffffff', accent: '#0ea5e9', accent2: '#0284c7', style: 'minimal' },
]

export function PosterMakerPanel() {
  const { toast } = useToast()
  const posterRef = useRef<HTMLDivElement>(null)
  const { data: shop } = useFetch<any>('/api/shop', undefined)

  const [template, setTemplate] = useState(TEMPLATES[0])
  const [resolution, setResolution] = useState(RESOLUTIONS[0])
  const [product, setProduct] = useState({
    name: 'ASUS Vivobook 15',
    model: 'X1504VAP-BQ224WS',
    headline: 'PERFORMANCE THAT KEEPS UP',
    subheadline: 'STYLE THAT STANDS OUT',
    imageUrl: '',
    specs: [
      { icon: 'cpu', label: 'Intel Core 5 120U', desc: 'Powerful Performance' },
      { icon: 'harddrive', label: '16GB DDR4 RAM', desc: 'Smooth Multitasking' },
      { icon: 'monitor', label: '512GB PCIe SSD', desc: 'Blazing Fast Storage' },
      { icon: 'monitor', label: '15.6" FHD Display', desc: 'Clear & Bright' },
      { icon: 'keyboard', label: 'Backlit Keyboard', desc: 'Type in Comfort' },
      { icon: 'shield', label: 'Windows 11 + Office', desc: 'Pre-installed' },
    ],
    offerText: '1 Year Warranty + Free Backpack',
    priceText: '',
    ctaText: 'ORDER NOW!',
    phone: '7204335355',
    address: 'SP Road, Bangalore',
  })

  const shopName = shop?.name || 'Smart Computers Sales & Service'
  const shopTagline = 'YOUR TRUSTED TECH PARTNER'
  const t = template
  const isDark = t.style === 'dark' || t.style === 'gaming' || t.style === 'bold' || t.style === 'service' || t.style === 'corporate' || t.style === 'teal'
  const textColor = isDark || t.style === 'apex' ? '#ffffff' : '#1e293b'
  const subTextColor = isDark ? '#ffffff99' : '#64748b'
  const bodyBg = t.bg

  const previewScale = Math.min(350 / resolution.w, 520 / resolution.h)
  const previewMarginBottom = -(resolution.h * previewScale) + 16

  const handleDownload = useCallback(async () => {
    if (posterRef.current === null) return
    toast({ title: 'Generating FHD poster...' })
    try {
      const dataUrl = await toPng(posterRef.current, {
        quality: 1, pixelRatio: 1, cacheBust: true,
        width: resolution.w, height: resolution.h,
        backgroundColor: '#000000',
        style: { transform: 'none', transformOrigin: 'unset', margin: '0' },
      })
      const link = document.createElement('a')
      link.download = `${product.name.replace(/\s+/g, '_')}_${resolution.w}x${resolution.h}.png`
      link.href = dataUrl; link.click()
      toast({ title: `Poster downloaded! (${resolution.w}×${resolution.h} FHD)` })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }, [posterRef, product.name, resolution, toast])

  const addSpec = () => setProduct({ ...product, specs: [...product.specs, { icon: 'cpu', label: 'New', desc: 'Desc' }] })
  const removeSpec = (i: number) => setProduct({ ...product, specs: product.specs.filter((_, idx) => idx !== i) })
  const updateSpec = (i: number, field: string, value: string) => {
    const specs = [...product.specs]; specs[i] = { ...specs[i], [field]: value }; setProduct({ ...product, specs })
  }
  const getIcon = (n: string) => ({ cpu: Cpu, harddrive: HardDrive, monitor: Monitor, keyboard: Keyboard, mouse: Mouse, printer: Printer, shield: Shield, zap: Zap, star: Star, check: CheckCircle }[n] || Cpu)

  const fs = (px: number) => `${(px / 800) * resolution.w}px`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0" />
            <span className="truncate">Poster Maker</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">10 premium designs · 3 FHD resolutions · exact pixel export</p>
        </div>
        <Button onClick={handleDownload} className="bg-purple-600 hover:bg-purple-700 h-11">
          <Download className="w-4 h-4 mr-1.5" /> Download FHD
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* LEFT: Form */}
        <div className="space-y-3">
          {/* Resolution */}
          <Card className="border-slate-200"><CardContent className="p-3">
            <Label className="text-xs font-medium mb-2 block">Resolution (FHD Export)</Label>
            <div className="grid grid-cols-3 gap-2">
              {RESOLUTIONS.map((r) => (
                <button key={r.id} onClick={() => setResolution(r)}
                  className={`p-2 rounded-lg border-2 text-center transition-all ${resolution.id === r.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="text-xs font-bold text-slate-700">{r.name}</p>
                  <p className="text-[9px] text-slate-400">{r.label}</p>
                </button>
              ))}
            </div>
          </CardContent></Card>

          {/* Templates */}
          <Card className="border-slate-200"><CardContent className="p-3">
            <Label className="text-xs font-medium mb-2 block">Premium Design (10 Templates)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TEMPLATES.map((tpl) => (
                <button key={tpl.id} onClick={() => setTemplate(tpl)}
                  className={`p-2 rounded-lg border-2 text-[10px] font-medium transition-all ${template.id === tpl.id ? 'border-purple-500 ring-1 ring-purple-300' : 'border-slate-200 hover:border-slate-300'}`}
                  style={{ background: tpl.bg, color: tpl.style === 'minimal' || tpl.style === 'clean' || tpl.style === 'split' ? '#1e293b' : '#fff', minHeight: '45px' }}
                  title={tpl.name}>
                  {tpl.name}
                </button>
              ))}
            </div>
          </CardContent></Card>

          {/* Product details */}
          <Card className="border-slate-200"><CardContent className="p-3 space-y-2">
            <Label className="text-xs font-medium">Product Details</Label>
            <Input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} placeholder="Product name" className="h-9 text-sm" />
            <Input value={product.model} onChange={(e) => setProduct({ ...product, model: e.target.value })} placeholder="Model number" className="h-9 text-sm" />
            <Input value={product.headline} onChange={(e) => setProduct({ ...product, headline: e.target.value })} placeholder="Headline" className="h-9 text-sm" />
            <Input value={product.subheadline} onChange={(e) => setProduct({ ...product, subheadline: e.target.value })} placeholder="Subheadline" className="h-9 text-sm" />
            <Input value={product.imageUrl} onChange={(e) => setProduct({ ...product, imageUrl: e.target.value })} placeholder="Product image URL" className="h-9 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={product.offerText} onChange={(e) => setProduct({ ...product, offerText: e.target.value })} placeholder="Offer text" className="h-9 text-sm" />
              <Input value={product.priceText} onChange={(e) => setProduct({ ...product, priceText: e.target.value })} placeholder="Price (₹39,990)" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={product.phone} onChange={(e) => setProduct({ ...product, phone: e.target.value })} placeholder="Phone" className="h-9 text-sm" />
              <Input value={product.address} onChange={(e) => setProduct({ ...product, address: e.target.value })} placeholder="Address" className="h-9 text-sm" />
            </div>
            <Input value={product.ctaText} onChange={(e) => setProduct({ ...product, ctaText: e.target.value })} placeholder="CTA" className="h-9 text-sm" />
          </CardContent></Card>

          {/* Specs */}
          <Card className="border-slate-200"><CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Features / Specs</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addSpec}><Plus className="w-3 h-3 mr-1" /> Add</Button>
            </div>
            {product.specs.map((spec, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Select value={spec.icon} onValueChange={(v) => updateSpec(i, 'icon', v)}>
                  <SelectTrigger className="w-16 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['cpu','harddrive','monitor','keyboard','mouse','printer','shield','zap','star','check'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={spec.label} onChange={(e) => updateSpec(i, 'label', e.target.value)} placeholder="Label" className="h-8 text-xs flex-1" />
                <Input value={spec.desc} onChange={(e) => updateSpec(i, 'desc', e.target.value)} placeholder="Desc" className="h-8 text-xs flex-1" />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeSpec(i)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
            ))}
          </CardContent></Card>
        </div>

        {/* RIGHT: Preview */}
        <div className="lg:sticky lg:top-4 self-start">
          <div className="text-xs text-slate-500 mb-2 text-center">Live Preview · {resolution.w}×{resolution.h} · FHD · {t.name}</div>
          <div className="flex justify-center overflow-hidden">
            <div ref={posterRef} style={{
              width: `${resolution.w}px`, height: `${resolution.h}px`,
              background: bodyBg, position: 'relative', overflow: 'hidden',
              fontFamily: 'Inter, sans-serif',
              transform: `scale(${previewScale})`, transformOrigin: 'top left',
              marginBottom: `${previewMarginBottom}px`,
            }}>
              {/* ===== HEADER BAR ===== */}
              {t.style !== 'teal' && t.style !== 'minimal' && (
                <div style={{
                  background: t.headerBg !== 'transparent' ? t.headerBg : t.bg,
                  padding: `${fs(18)} ${fs(28)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: t.style === 'apex' ? `${fs(3)} solid ${t.accent}` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: fs(18), fontWeight: 800, color: textColor, letterSpacing: '0.5px' }}>{shopName.toUpperCase()}</div>
                    <div style={{ fontSize: fs(10), color: t.accent2, marginTop: '2px' }}>{shopTagline}</div>
                  </div>
                  <div style={{ display: 'flex', gap: fs(10) }}>
                    {[Shield, Star, Zap].map((Ico, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <Ico style={{ width: fs(18), height: fs(18), color: t.accent }} />
                        <div style={{ fontSize: fs(6), color: subTextColor, marginTop: '2px' }}>{['TRUSTED','QUALITY','EXPERT'][i]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== PRODUCT NAME ===== */}
              <div style={{ padding: `${fs(18)} ${fs(28)} ${fs(8)}` }}>
                <div style={{ fontSize: fs(30), fontWeight: 900, color: t.accent, lineHeight: '1.1' }}>{product.name.toUpperCase()}</div>
                {product.model && <div style={{ fontSize: fs(11), color: subTextColor, marginTop: '4px' }}>{product.model}</div>}
                <div style={{ fontSize: fs(18), fontWeight: 700, color: textColor, marginTop: '6px' }}>{product.headline}</div>
                <div style={{ fontSize: fs(13), color: t.accent2, fontWeight: 600 }}>{product.subheadline}</div>
              </div>

              {/* ===== PRODUCT IMAGE ===== */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: `${fs(8)} ${fs(28)}`, height: fs(240) }}>
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} style={{ maxHeight: fs(220), maxWidth: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
                ) : (
                  <div style={{ width: fs(280), height: fs(180), borderRadius: fs(10), background: `${t.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `${fs(2)} dashed ${t.accent}40` }}>
                    <ImageIcon style={{ width: fs(44), height: fs(44), color: `${t.accent}50` }} />
                  </div>
                )}
              </div>

              {/* ===== SPECS GRID ===== */}
              <div style={{ padding: `${fs(8)} ${fs(28)}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${fs(7)} ${fs(16)}` }}>
                {product.specs.slice(0, 8).map((spec, i) => {
                  const Icon = getIcon(spec.icon)
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: fs(7),
                      background: t.style === 'apex' || t.style === 'clean' ? `${t.accent}10` : 'transparent',
                      padding: t.style === 'apex' || t.style === 'clean' ? `${fs(6)} ${fs(8)}` : '0',
                      borderRadius: fs(6),
                    }}>
                      <div style={{ width: fs(30), height: fs(30), borderRadius: fs(6), background: `${t.accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: fs(15), height: fs(15), color: t.accent }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: fs(10), fontWeight: 700, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spec.label}</div>
                        <div style={{ fontSize: fs(8), color: subTextColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spec.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ===== OFFER + PRICE ===== */}
              {(product.offerText || product.priceText) && (
                <div style={{
                  margin: `${fs(12)} ${fs(28)}`, padding: `${fs(10)} ${fs(18)}`, borderRadius: fs(8),
                  background: `${t.accent2}20`, border: `${fs(1)} solid ${t.accent}40`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  {product.offerText && <div style={{ fontSize: fs(11), fontWeight: 600, color: t.accent2 }}>{product.offerText}</div>}
                  {product.priceText && <div style={{ fontSize: fs(24), fontWeight: 900, color: t.accent2 }}>{product.priceText}</div>}
                </div>
              )}

              {/* ===== CTA + CONTACT FOOTER ===== */}
              <div style={{
                position: 'absolute', bottom: '0', left: '0', right: '0',
                background: t.style === 'split' ? t.headerBg : t.style === 'minimal' || t.style === 'clean' ? t.accent : '#000000d0',
                padding: `${fs(18)} ${fs(28)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'inline-block', padding: `${fs(9)} ${fs(22)}`, borderRadius: fs(6), background: t.accent2, color: t.style === 'minimal' || t.style === 'clean' ? '#fff' : '#000', fontSize: fs(15), fontWeight: 800 }}>
                    {product.ctaText}
                  </div>
                  <div style={{ marginTop: fs(8), display: 'flex', gap: fs(14), flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone style={{ width: fs(13), height: fs(13), color: '#fff' }} />
                      <span style={{ fontSize: fs(12), color: '#fff', fontWeight: 600 }}>{product.phone}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin style={{ width: fs(13), height: fs(13), color: '#fff' }} />
                      <span style={{ fontSize: fs(10), color: '#fff' }}>{product.address}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: fs(5), justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: fs(180) }}>
                    {['100% ORIGINAL', 'FAST DELIVERY', 'WARRANTY'].map((txt, i) => (
                      <div key={i} style={{ fontSize: fs(7), color: '#ffffffcc', padding: `${fs(3)} ${fs(7)}`, border: `${fs(1)} solid #ffffff30`, borderRadius: fs(3) }}>{txt}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
