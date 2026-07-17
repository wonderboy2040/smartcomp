import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

/**
 * GET /api/apps-script-code
 *
 * Returns the LATEST apps-script/code.gs content as plain text.
 * This lets users copy the latest code directly from their running app
 * (Settings → Sync tab → "Copy latest Apps Script code" button) without
 * having to navigate to GitHub.
 *
 * The file is read at request-time (not bundled at build) so it always
 * reflects the current deployed version.
 */
export async function GET(req: NextRequest) {
  try {
    // Resolve the path relative to the project root.
    // In Next.js, process.cwd() is the project root (where package.json lives).
    const filePath = path.join(process.cwd(), 'apps-script', 'code.gs')
    const content = await readFile(filePath, 'utf8')

    const format = req.nextUrl.searchParams.get('format') || 'text'

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        version: '2.7',
        filename: 'code.gs',
        size: content.length,
        content,
      })
    }

    // Default: plain text (easy to copy)
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not read apps-script/code.gs from disk: ' + (e?.message || 'unknown error'),
        hint: 'Make sure the apps-script/code.gs file is included in your deployment. If you deployed via Render/Vercel from the GitHub repo, the file should be present. If you only deployed the build output, you need to also include the apps-script directory.',
      },
      { status: 500 }
    )
  }
}
