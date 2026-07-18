'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Check, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { getSupabaseBrowser, isSupabaseAuthConfigured } from '@/lib/supabase-browser'

type Provider = 'github' | 'google' | 'linkedin_oidc'

const MAGIC_LINK_COOLDOWN_MS = 60_000

const emailCooldownKey = (value: string) => `aiwex.magic-link.cooldown.${value.trim().toLowerCase()}`

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(0)
  const configured = isSupabaseAuthConfigured()
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))

  useEffect(() => {
    setNow(Date.now())
  }, [])

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error')
    if (error) setStatus(error)
  }, [])

  useEffect(() => {
    if (!email.trim()) {
      setCooldownUntil(0)
      return
    }
    const stored = Number(window.localStorage.getItem(emailCooldownKey(email)))
    setCooldownUntil(stored > Date.now() ? stored : 0)
    setNow(Date.now())
  }, [email])

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  const startEmailCooldown = () => {
    const until = Date.now() + MAGIC_LINK_COOLDOWN_MS
    window.localStorage.setItem(emailCooldownKey(email), String(until))
    setCooldownUntil(until)
    setNow(Date.now())
  }

  const signIn = async (provider: Provider) => {
    const supabase = getSupabaseBrowser()
    if (!supabase) {
      setStatus('Social signup will activate after the Supabase publishable key is configured.')
      return
    }
    setBusy(true)
    setStatus('Redirecting securely...')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setStatus(error.message)
      setBusy(false)
    }
  }

  const emailSignIn = async (event: React.FormEvent) => {
    event.preventDefault()
    if (cooldownSeconds > 0) {
      setStatus(`A sign-in link was just sent. Please wait ${cooldownSeconds}s before requesting another.`)
      return
    }
    const supabase = getSupabaseBrowser()
    if (!supabase) {
      setStatus('Email signup will activate after the Supabase publishable key is configured.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(false)
    if (!error) {
      startEmailCooldown()
      setStatus('Check your inbox for your AIWEX sign-in link. You can request another in 60 seconds.')
      return
    }
    if (/rate limit|too many requests/i.test(error.message)) {
      startEmailCooldown()
      setStatus('Supabase has limited email delivery for this project. Please wait before retrying; use custom SMTP before production.')
      return
    }
    setStatus(error.message)
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to AIWEX</Link>
        <p className="landing-eyebrow"><Sparkles size={14} /> YOUR CAREER, IN MOTION</p>
        <h1>Make your next<br /><em>work story real.</em></h1>
        <p>Join an AI engineering organization where every meaningful choice becomes evidence of how you work.</p>
        <div className="auth-benefits"><span><Check size={14} /> Curated project context</span><span><Check size={14} /> Private coaching evidence</span><span><Check size={14} /> A real delivery cadence</span></div>
        <div className="auth-quote"><span>“</span><p>The practice environment I wished I had before my first engineering role.</p><small>Built for deliberate growth</small></div>
      </section>
      <section className="auth-card">
        <div className="auth-card-heading"><span className="auth-card-mark">A</span><p className="landing-eyebrow">CREATE OR CONTINUE</p><h2>Welcome to AIWEX</h2><p>Use the account you&apos;ll want attached to your work history.</p></div>
        <button type="button" disabled={busy} onClick={() => void signIn('github')}><span className="provider-mark github-mark">GH</span> Continue with GitHub</button>
        <button type="button" disabled={busy} onClick={() => void signIn('google')}><span className="provider-mark google-mark">G</span> Continue with Google</button>
        <button type="button" disabled={busy} onClick={() => void signIn('linkedin_oidc')}><span className="provider-mark linkedin-mark">in</span> Continue with LinkedIn</button>
        <div className="auth-divider"><span />or continue with email<span /></div>
        <form onSubmit={emailSignIn}>
          <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button className="auth-email" type="submit" disabled={busy || cooldownSeconds > 0}><Mail size={16} /> {cooldownSeconds > 0 ? `Resend available in ${cooldownSeconds}s` : 'Send me a sign-in link'}</button>
        </form>
        {status && <p className="auth-status" role="status">{status}</p>}
        {!configured && <p className="auth-config">Auth UI is ready. Add the Supabase publishable URL/key and provider credentials after deployment to activate sign-in.</p>}
        <small><LockKeyhole size={12} /> Your learning record is private and secure.</small>
      </section>
    </main>
  )
}
