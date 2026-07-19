import { NextResponse } from 'next/server'
import { testConnection, getConfiguredUrlPreview } from '@/lib/sheets-client'
import { getAppPin } from '@/lib/runtime-config'

// GET - connection status + masked URL preview (so user can verify the URL format)
export async function GET() {
  const urlInfo = getConfiguredUrlPreview()
  return NextResponse.json({
    message: 'Google Sheets sync is configured via APPS_SCRIPT_URL environment variable.',
    urlPreview: urlInfo.urlPreview,
    urlConfigured: urlInfo.configured,
    urlEndsWithExec: urlInfo.endsWithExec,
    // Desktop-mode flags so the Settings panel can show a "Change Cloud URL" UI
    runtimeConfigActive: !!process.env.SMARTCOMP_CONFIG_PATH,
    pinRequired: !!getAppPin(),
  })
}

// POST - test connection
export async function POST() {
  const result = await testConnection()
  return NextResponse.json(result)
}
