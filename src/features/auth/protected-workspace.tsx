'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SimulatorApp from '@/features/simulator/components/simulator-app'
import { getSupabaseBrowser, isSupabaseAuthConfigured } from '@/lib/supabase-browser'

export default function ProtectedWorkspace() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const configured = isSupabaseAuthConfigured()
  useEffect(() => {
    const supabase = getSupabaseBrowser()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/sign-in'); else setReady(true) })
  }, [router])
  if (!configured) return <main className="auth-required"><h1>AIWEX authentication is almost ready.</h1><p>Add the Supabase publishable URL and anon key, then configure your OAuth providers to open the protected workspace.</p><Link href="/sign-in">Open sign-in setup</Link></main>
  if (!ready) return <main className="auth-required"><p>Securing your workspace…</p></main>
  return <SimulatorApp />
}
