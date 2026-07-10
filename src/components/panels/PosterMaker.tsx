'use client'

import { useState, useRef, useCallback } from 'react'
import { useFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { toPng } from 'html-to-image'
import {
  Image as ImageIcon, Download, RefreshCw, Plus, Trash2, Palette, ShoppingCart, Phone, MapPin,
  Shield, Zap, Star, CheckCircle, Cpu, HardDrive, Monitor, Keyboard, Mouse, Printer,
} from 'lucide-react'

const TEMPLATES = [
  { id: 'laptop-blue', name: 'Laptop Blue', bg: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', accent: '#3b82f6', accent2: '#fbbf24' },
  { id: 'laptop-sasta', name: 'Sasta Deal', bg: 'linear-gradient(135deg, #1e40af 50%, #f59e0b 50%)', accent: '#ffffff', accent2: '#fbbf24' },
  { id: 'accessory-dark', name: 'Dark Bold', bg: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)', accent: '#f97316', accent2: '#ffffff' },
  { id: 'monitor-glow', name: 'Gold Glow', bg: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)', accent: '#fbbf24', accent2: '#ef4444' },
  { id: 'printer-pro', name: 'Printer Pro', bg: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', accent: '#06b6d4', accent2: '#fbbf24' },
  { id: 'ssd-speed', name: 'SSD Speed', bg: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)', accent: '#22c55e', accent2: '#ffffff' },
  { id: 'ram-gaming', name: 'RAM Gaming', bg: 'linear-gradient(135deg, #581c87 0%, #1e1b4b 100%)', accent: '#a855f7', accent2: '#fbbf24' },
  { id: 'mouse-rgb', name: 'Mouse RGB', bg: 'linear-gradient(135deg, #7f1d1d 0%, #18181b 100%)', accent: '#ef4444', accent2: '#f97316' },
  { id: 'keyboard-mech', name: 'Mech Keyboard', bg: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)', accent: '#f59e0b', accent2: '#a3a3a3' },
  { id: 'service-repair', name: 'Service Repair', bg: 'linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)', accent: '#0ea5e9', accent2: '#fbbf24' },
]

export function PosterMakerPanel() {
  const { toast } = useToast()
  const posterRef = useRef<HTMLDivElement>(null)
  const { data: shop } = useFetch<any>('/api/shop', undefined)

  const [template, setTemplate] = useState(TEMPLATES[0])
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

  const handleDownload = useCallback(async () => {
    if (posterRef.current === null) return
    toast({ title: 'Generating poster...' })
    try {
      const dataUrl = await toPng(posterRef.current, {
        quality: 1,
        pixelRatio: 3, // 3x = 2K+ resolution (800x1200 * 3 = 2400x3600)
        cacheBust: true,
        width: 800,
        height: 1200,
        backgroundColor: '#000000',
      })
      const link = document.createElement('a')
      link.download = `${product.name.replace(/\s+/g, '_')}_poster.png`
      link.href = dataUrl
      link.click()
      toast({ title: 'Poster downloaded!' })
    } catch (e: any) {
      toast({ title: 'Error generating poster', description: e.message, variant: 'destructive' })
    }
  }, [posterRef, product.name, toast])

  const addSpec = () => {
    setProduct({
      ...product,
      specs: [...product.specs, { icon: 'cpu', label: 'New Feature', desc: 'Description' }],
    })
  }

  const removeSpec = (i: number) => {
    setProduct({ ...product, specs: product.specs.filter((_, idx) => idx !== i) })
  }

  const updateSpec = (i: number, field: string, value: string) => {
    const specs = [...product.specs]
    specs[i] = { ...specs[i], [field]: value }
    setProduct({ ...product, specs })
  }

  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      cpu: Cpu, harddrive: HardDrive, monitor: Monitor, keyboard: Keyboard,
      mouse: Mouse, printer: Printer, shield: Shield, zap: Zap, star: Star,
      check: CheckCircle,
    }
    return icons[iconName] || Cpu
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0" />
            <span className="truncate">Poster Maker</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create professional promotional posters for products — download as PNG
          </p>
        </div>
        <Button onClick={handleDownload} className="bg-purple-600 hover:bg-purple-700 h-11">
          <Download className="w-4 h-4 mr-1.5" /> Download PNG
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ===== LEFT: Form ===== */}
        <div className="space-y-3">
          {/* Template selector */}
          <Card className="border-slate-200">
            <CardContent className="p-3">
              <Label className="text-xs font-medium mb-2 block">Template Design</Label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t)}
                    className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      template.id === t.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={{ background: t.bg, color: '#fff', minHeight: '50px' }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Product details */}
          <Card className="border-slate-200">
            <CardContent className="p-3 space-y-2">
              <Label className="text-xs font-medium">Product Details</Label>
              <Input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} placeholder="Product name" className="h-9 text-sm" />
              <Input value={product.model} onChange={(e) => setProduct({ ...product, model: e.target.value })} placeholder="Model number" className="h-9 text-sm" />
              <Input value={product.headline} onChange={(e) => setProduct({ ...product, headline: e.target.value })} placeholder="Headline (e.g., PERFORMANCE THAT KEEPS UP)" className="h-9 text-sm" />
              <Input value={product.subheadline} onChange={(e) => setProduct({ ...product, subheadline: e.target.value })} placeholder="Subheadline" className="h-9 text-sm" />
              <Input value={product.imageUrl} onChange={(e) => setProduct({ ...product, imageUrl: e.target.value })} placeholder="Product image URL (optional)" className="h-9 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={product.offerText} onChange={(e) => setProduct({ ...product, offerText: e.target.value })} placeholder="Offer text" className="h-9 text-sm" />
                <Input value={product.priceText} onChange={(e) => setProduct({ ...product, priceText: e.target.value })} placeholder="Price (e.g., ₹39,990)" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={product.phone} onChange={(e) => setProduct({ ...product, phone: e.target.value })} placeholder="Phone number" className="h-9 text-sm" />
                <Input value={product.address} onChange={(e) => setProduct({ ...product, address: e.target.value })} placeholder="Shop address" className="h-9 text-sm" />
              </div>
              <Input value={product.ctaText} onChange={(e) => setProduct({ ...product, ctaText: e.target.value })} placeholder="CTA (e.g., ORDER NOW!)" className="h-9 text-sm" />
            </CardContent>
          </Card>

          {/* Specs editor */}
          <Card className="border-slate-200">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Features / Specs</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addSpec}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              {product.specs.map((spec, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <Select value={spec.icon} onValueChange={(v) => updateSpec(i, 'icon', v)}>
                    <SelectTrigger className="w-16 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpu">CPU</SelectItem>
                      <SelectItem value="harddrive">Storage</SelectItem>
                      <SelectItem value="monitor">Display</SelectItem>
                      <SelectItem value="keyboard">Keyboard</SelectItem>
                      <SelectItem value="mouse">Mouse</SelectItem>
                      <SelectItem value="printer">Printer</SelectItem>
                      <SelectItem value="shield">Warranty</SelectItem>
                      <SelectItem value="zap">Speed</SelectItem>
                      <SelectItem value="star">Quality</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={spec.label} onChange={(e) => updateSpec(i, 'label', e.target.value)} placeholder="Label" className="h-8 text-xs flex-1" />
                  <Input value={spec.desc} onChange={(e) => updateSpec(i, 'desc', e.target.value)} placeholder="Description" className="h-8 text-xs flex-1" />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeSpec(i)}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ===== RIGHT: Live Preview ===== */}
        <div className="lg:sticky lg:top-4 self-start">
          <div className="text-xs text-slate-500 mb-2 text-center">Live Preview (1080×1920 · 2K Export)</div>
          <div className="flex justify-center">
            <div
              ref={posterRef}
              style={{
                width: '800px',
                height: '1200px',
                background: template.bg,
                position: 'relative',
                overflow: 'hidden',
                fontFamily: 'Inter, sans-serif',
                transform: 'scale(0.45)',
                transformOrigin: 'top left',
                marginBottom: '-660px',
              }}
            >
              {/* Shop name header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 30px', borderBottom: `2px solid ${template.accent}33`,
              }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
                    {shopName.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '11px', color: template.accent2, marginTop: '2px' }}>
                    {shopTagline}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['Shield', 'Star', 'Zap'].map((Icon, i) => {
                    const Ico = [Shield, Star, Zap][i]
                    return (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <Ico style={{ width: '20px', height: '20px', color: template.accent }} />
                        <div style={{ fontSize: '7px', color: '#ffffff99', marginTop: '2px' }}>
                          {['TRUSTED', 'QUALITY', 'EXPERT'][i]}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Product name + headline */}
              <div style={{ padding: '20px 30px 10px' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, color: template.accent, lineHeight: '1.1' }}>
                  {product.name.toUpperCase()}
                </div>
                {product.model && (
                  <div style={{ fontSize: '12px', color: '#ffffff80', marginTop: '4px' }}>{product.model}</div>
                )}
                <div style={{
                  fontSize: '20px', fontWeight: 700, color: '#fff', marginTop: '8px',
                }}>
                  {product.headline}
                </div>
                <div style={{ fontSize: '14px', color: template.accent2, fontWeight: 600 }}>
                  {product.subheadline}
                </div>
              </div>

              {/* Product image OR placeholder */}
              <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '10px 30px', height: '280px',
              }}>
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{ maxHeight: '260px', maxWidth: '100%', objectFit: 'contain' }}
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div style={{
                    width: '300px', height: '200px', borderRadius: '12px',
                    background: `${template.accent}22`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    border: `2px dashed ${template.accent}55`,
                  }}>
                    <ImageIcon style={{ width: '48px', height: '48px', color: `${template.accent}55` }} />
                  </div>
                )}
              </div>

              {/* Specs list */}
              <div style={{ padding: '10px 30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
                {product.specs.slice(0, 8).map((spec, i) => {
                  const Icon = getIcon(spec.icon)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: `${template.accent}22`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon style={{ width: '16px', height: '16px', color: template.accent }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{spec.label}</div>
                        <div style={{ fontSize: '9px', color: '#ffffff99' }}>{spec.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Offer + Price banner */}
              {(product.offerText || product.priceText) && (
                <div style={{
                  margin: '15px 30px', padding: '12px 20px', borderRadius: '10px',
                  background: `linear-gradient(90deg, ${template.accent2}22, ${template.accent}22)`,
                  border: `1px solid ${template.accent}44`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  {product.offerText && (
                    <div style={{ fontSize: '12px', fontWeight: 600, color: template.accent2 }}>
                      🎁 {product.offerText}
                    </div>
                  )}
                  {product.priceText && (
                    <div style={{
                      fontSize: '24px', fontWeight: 900, color: template.accent2,
                    }}>
                      {product.priceText}
                    </div>
                  )}
                </div>
              )}

              {/* CTA + Contact */}
              <div style={{
                position: 'absolute', bottom: '0', left: '0', right: '0',
                background: template.id === 'laptop-sasta' ? '#1e40af' : '#000000dd',
                padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{
                    display: 'inline-block', padding: '10px 24px', borderRadius: '8px',
                    background: template.accent2, color: '#000', fontSize: '16px', fontWeight: 800,
                  }}>
                    {product.ctaText}
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Phone style={{ width: '14px', height: '14px', color: '#fff' }} />
                      <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{product.phone}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MapPin style={{ width: '14px', height: '14px', color: '#fff' }} />
                      <span style={{ fontSize: '11px', color: '#fff' }}>{product.address}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {['100% ORIGINAL', 'FAST DELIVERY', 'WARRANTY SUPPORT'].map((t, i) => (
                      <div key={i} style={{
                        fontSize: '8px', color: '#ffffffcc', padding: '3px 8px',
                        border: '1px solid #ffffff33', borderRadius: '4px',
                      }}>
                        {t}
                      </div>
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
