import { NextResponse } from 'next/server'

export async function GET() {
  // Tells the client whether PIN protection is enabled (so the login page
  // can decide whether to render). The actual cookie validity is enforced
  // by middleware; we only report the *requirement* here.
  return NextResponse.json({ pinRequired: !!process.env.APP_PIN })
}
