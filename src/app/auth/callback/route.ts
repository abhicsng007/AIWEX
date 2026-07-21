import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { clearDemoCookie } from '@/features/auth/demo-session'

function signInRedirect(request: NextRequest, message: string) {
  const url = new URL('/sign-in', request.url)
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return signInRedirect(request, 'Authentication is not configured.')
  if (!code) return signInRedirect(request, 'The sign-in link did not include an authorization code. Please try again.')

  // Real accounts always start their own private run. Drop any leftover demo
  // cookie so signed-up users never keep loading disposable demo ledger data.
  const response = clearDemoCookie(NextResponse.redirect(new URL('/app', request.url)), request)
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookies) { cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
    },
  })
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return signInRedirect(request, error.message)
  return response
}
