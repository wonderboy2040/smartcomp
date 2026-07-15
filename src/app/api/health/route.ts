import { NextResponse } from 'next/server'
import { isConfigured, getCacheStats } from '@/lib/sheets-client'

export async function GET() {
  try {
    const configured = isConfigured()
    const cacheStats = getCacheStats()
    
    return NextResponse.json({
      status: 'ok',
      version: '4.0.0',
      codename: 'SmartComp Pro',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? process.uptime() : 0,
      configured,
      features: {
        dataProtection: true,
        softDelete: true,
        optimisticUI: true,
        pwa: true,
        whatsapp: true,
        amc: true,
        reports: true,
        export: true,
      },
      cache: cacheStats,
      env: {
        nodeVersion: process.version,
        platform: process.platform,
      }
    })
  } catch (e: any) {
    return NextResponse.json({
      status: 'error',
      error: e?.message,
      version: '4.0.0',
    }, { status: 500 })
  }
}
