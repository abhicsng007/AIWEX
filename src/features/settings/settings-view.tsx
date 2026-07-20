'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react'

export type ThemeMode = 'light' | 'dark' | 'system'

type SettingsViewProps = {
  displayName: string
  email: string | null
  isDemo: boolean
  themeMode: ThemeMode
  resolvedTheme: 'light' | 'dark'
  onDisplayNameChange: (name: string) => void
  onThemeModeChange: (mode: ThemeMode) => void
  onSignOut: () => Promise<void>
  onClearLocalProgress: () => void
}

const themeOptions: Array<{ id: ThemeMode; label: string; detail: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', detail: 'Bright surfaces for daytime work', icon: Sun },
  { id: 'dark', label: 'Dark', detail: 'Low-glare palette for long sessions', icon: Moon },
  { id: 'system', label: 'System', detail: 'Match your device preference', icon: Monitor },
]

export default function SettingsView({
  displayName,
  email,
  isDemo,
  themeMode,
  resolvedTheme,
  onDisplayNameChange,
  onThemeModeChange,
  onSignOut,
  onClearLocalProgress,
}: SettingsViewProps) {
  const [nameDraft, setNameDraft] = useState(displayName)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])

  const saveName = () => {
    const next = nameDraft.trim()
    if (!next) {
      setStatus('Display name cannot be empty.')
      return
    }
    onDisplayNameChange(next)
    setStatus('Display name saved on this device.')
  }

  const signOut = async () => {
    setBusy(true)
    setStatus(isDemo ? 'Ending demo session…' : 'Signing you out…')
    try {
      await onSignOut()
    } catch {
      setBusy(false)
      setStatus('Sign-out failed. Please try again.')
    }
  }

  const clearProgress = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setStatus('Click clear again to wipe local simulation progress on this device.')
      return
    }
    onClearLocalProgress()
    setConfirmClear(false)
    setStatus('Local simulation progress cleared. Reloading…')
  }

  return (
    <div className="page settings-page">
      <section className="page-title">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Settings</h1>
          <p>Manage how AIWEX looks and how your session is handled on this device.</p>
        </div>
      </section>

      <div className="settings-grid">
        <section className="card settings-card">
          <div className="settings-card-head">
            <UserRound size={18} />
            <div>
              <span className="eyebrow">PROFILE</span>
              <h2>Your learner identity</h2>
            </div>
          </div>
          <label className="settings-field">
            Display name
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveName()
                }
              }}
              maxLength={64}
              autoComplete="name"
            />
          </label>
          <label className="settings-field">
            Email
            <input value={email || (isDemo ? 'Demo session (no email)' : 'Not available')} readOnly />
          </label>
          <div className="settings-actions">
            <button type="button" className="primary-button" onClick={saveName} disabled={nameDraft.trim() === displayName}>
              <Check size={15} /> Save name
            </button>
            <small>Saved to this browser. OAuth providers still own your sign-in email.</small>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card-head">
            {resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            <div>
              <span className="eyebrow">APPEARANCE</span>
              <h2>Theme</h2>
            </div>
          </div>
          <div className="theme-option-grid" role="radiogroup" aria-label="Theme mode">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const selected = themeMode === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`theme-option ${selected ? 'selected' : ''}`}
                  onClick={() => {
                    onThemeModeChange(option.id)
                    setStatus(`Theme set to ${option.label.toLowerCase()}.`)
                  }}
                >
                  <Icon size={16} />
                  <span>
                    <b>{option.label}</b>
                    <small>{option.detail}</small>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="settings-hint">Currently showing <b>{resolvedTheme}</b> mode.</p>
        </section>

        <section className="card settings-card">
          <div className="settings-card-head">
            <ShieldCheck size={18} />
            <div>
              <span className="eyebrow">SESSION</span>
              <h2>{isDemo ? 'Demo session' : 'Sign out'}</h2>
            </div>
          </div>
          <p className="settings-copy">
            {isDemo
              ? 'This is a disposable demo workspace. Exiting returns you to the landing page and drops the demo cookie on this browser.'
              : 'Sign out clears your authenticated session on this browser. Your private simulation run remains on the server for your account.'}
          </p>
          <div className="settings-actions">
            <button type="button" className="danger-button" onClick={() => void signOut()} disabled={busy}>
              <LogOut size={15} /> {isDemo ? 'Exit demo' : 'Sign out'}
            </button>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card-head">
            <Trash2 size={18} />
            <div>
              <span className="eyebrow">DEVICE DATA</span>
              <h2>Local progress</h2>
            </div>
          </div>
          <p className="settings-copy">
            Clear cached stand-up, workspace, and board state stored only in this browser. Server-backed simulation events are not deleted.
          </p>
          <div className="settings-actions">
            <button type="button" className={confirmClear ? 'danger-button' : 'secondary-button'} onClick={clearProgress}>
              <Trash2 size={15} /> {confirmClear ? 'Confirm clear local data' : 'Clear local progress'}
            </button>
            {confirmClear && (
              <button type="button" className="ghost-button" onClick={() => { setConfirmClear(false); setStatus('') }}>
                Cancel
              </button>
            )}
          </div>
        </section>
      </div>

      {status && <p className="settings-status" role="status">{status}</p>}
    </div>
  )
}
