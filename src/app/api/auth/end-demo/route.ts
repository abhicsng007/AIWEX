import { NextRequest, NextResponse } from 'next/server'
import { clearDemoCookie } from '@/features/auth/demo-session'

export const dynamic = 'force-dynamic'

/** Clears the httpOnly demo cookie so exit-demo and post-signup flows cannot reuse it. */
export async function POST(request: NextRequest) {
  return clearDemoCookie(NextResponse.json({ ok: true }), request)
}
