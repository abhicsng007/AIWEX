'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Check, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { getSupabaseBrowser, isSupabaseAuthConfigured } from '@/lib/supabase-browser'

type Provider = 'github' | 'google'

const MAGIC_LINK_COOLDOWN_MS = 60_000

const emailCooldownKey = (value: string) => `aiwex.magic-link.cooldown.${value.trim().toLowerCase()}`

function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg className="provider-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.3 0 .32.22.7.82.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12z"
      />
    </svg>
  )
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg className="provider-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

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
        <button type="button" disabled={busy} onClick={() => void signIn('github')}><GitHubIcon /> Continue with GitHub</button>
        <button type="button" disabled={busy} onClick={() => void signIn('google')}><GoogleIcon /> Continue with Google</button>
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
