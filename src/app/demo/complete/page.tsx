'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck, Check, CircleAlert, LoaderCircle } from 'lucide-react'
import { clearDemoClientData } from '@/features/auth/clear-demo-client-data'

type ProgressLine = {
  phase: string
  message: string
  percent?: number | null
  done?: boolean
  error?: boolean
  redirect?: string
}

const STAGES = [
  { id: 'session', label: 'Create demo session' },
  { id: 'onboarding', label: 'Complete onboarding' },
  { id: 'welcome', label: 'Team welcome' },
  { id: 'level_basic', label: 'Basic delivery' },
  { id: 'level_intermediate', label: 'Intermediate delivery' },
  { id: 'level_advanced', label: 'Advanced delivery' },
  { id: 'meetings', label: 'Meetings & calendar' },
  { id: 'reports', label: 'Evidence reports' },
  { id: 'ready', label: 'Open workspace' },
] as const

function stageStatus(phase: string, currentPhase: string, failed: boolean, finished: boolean): 'pending' | 'active' | 'done' | 'error' {
  if (failed && phase === currentPhase) return 'error'
  if (finished) return 'done'
  const order = STAGES.map((item) => item.id)
  // Map fine-grained phases onto coarse stage ids
  const normalized = phase.startsWith('completed_')
    ? (phase.includes('PROJ-184') ? 'level_basic' : phase.includes('PROJ-191') || phase.includes('PROJ-189') ? 'level_intermediate' : 'level_advanced')
    : phase === 'qualified' || phase === 'onboarding'
      ? 'onboarding'
      : phase === 'team_welcome' || phase === 'agent_turn'
        ? 'welcome'
        : phase === 'calendar' || phase === 'performance' || phase === 'deployment_recorded'
          ? 'meetings'
          : phase === 'feedback_ready' || phase === 'ready'
            ? 'ready'
            : phase.startsWith('level_')
              ? phase
              : phase

  const currentIndex = Math.max(0, order.findIndex((id) => normalized.startsWith(id) || id === normalized))
  const stageIndex = order.indexOf(phase as typeof order[number])
  if (stageIndex < 0) return 'pending'
  if (stageIndex < currentIndex) return 'done'
  if (stageIndex === currentIndex) return failed ? 'error' : 'active'
  return 'pending'
}

export default function DemoCompletePreparingPage() {
  const [lines, setLines] = useState<ProgressLine[]>([{ phase: 'session', message: 'Starting showcase preparation…', percent: 1 }])
  const [percent, setPercent] = useState(1)
  const [currentPhase, setCurrentPhase] = useState('session')
  const [failed, setFailed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Preparing your complete journey showcase…')
  const started = useRef(false)

  const latest = lines[lines.length - 1]
  const activeStageId = useMemo(() => {
    if (finished) return 'ready'
    if (currentPhase.startsWith('completed_PROJ-184') || currentPhase === 'level_basic') return 'level_basic'
    if (currentPhase.startsWith('completed_PROJ-19') || currentPhase === 'level_intermediate') return 'level_intermediate'
    if (currentPhase.startsWith('completed_PROJ-20') || currentPhase === 'level_advanced') return 'level_advanced'
    if (currentPhase === 'qualified' || currentPhase === 'onboarding') return 'onboarding'
    if (currentPhase === 'team_welcome' || currentPhase === 'agent_turn' || currentPhase === 'welcome') return 'welcome'
    if (currentPhase === 'calendar' || currentPhase === 'meetings' || currentPhase === 'performance') return 'meetings'
    if (currentPhase === 'reports' || currentPhase === 'ready' || currentPhase === 'feedback_ready') return 'ready'
    return currentPhase.startsWith('level_') ? currentPhase : 'session'
  }, [currentPhase, finished])

  useEffect(() => {
    if (started.current) return
    started.current = true
    // Drop any prior onboarding-demo localStorage before the new cookie lands.
    clearDemoClientData()

    const goHome = (message?: string) => {
      const url = message
        ? `/?error=${encodeURIComponent(message)}`
        : '/?error=' + encodeURIComponent('We could not prepare the full journey showcase. Please try a simpler demo from the home page.')
      window.location.replace(url)
    }

    const run = async () => {
      try {
        const response = await fetch('/api/demo/showcase', {
          method: 'POST',
          headers: { Accept: 'application/x-ndjson' },
          cache: 'no-store',
        })

        if (!response.ok || !response.body) {
          let detail = 'The showcase service is unavailable right now.'
          try {
            const data = await response.json() as { error?: string; redirect?: string }
            if (data.redirect?.startsWith('/app')) {
              window.location.replace(data.redirect)
              return
            }
            if (data.error) detail = data.error
          } catch { /* use default */ }
          setFailed(true)
          setStatusMessage(detail)
          window.setTimeout(() => goHome(detail), 1600)
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let sawError = false

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n')
          buffer = parts.pop() || ''
          for (const part of parts) {
            if (!part.trim()) continue
            let row: ProgressLine
            try {
              row = JSON.parse(part) as ProgressLine
            } catch {
              continue
            }
            if (typeof row.percent === 'number' && Number.isFinite(row.percent)) setPercent(Math.max(0, Math.min(100, row.percent)))
            if (row.phase) setCurrentPhase(row.phase)
            if (row.message) setStatusMessage(row.message)
            setLines((items) => [...items.slice(-24), row])

            if (row.error) {
              sawError = true
              setFailed(true)
              const friendly = 'We could not prepare the full journey showcase. Taking you back to the home page…'
              setStatusMessage(friendly)
              window.setTimeout(() => {
                window.location.replace(row.redirect || `/?error=${encodeURIComponent(friendly)}`)
              }, 1400)
              return
            }
            if (row.done) {
              setFinished(true)
              setPercent(100)
              setStatusMessage('Showcase ready — opening your workspace…')
              window.setTimeout(() => {
                window.location.replace('/demo/workspace')
              }, 500)
              return
            }
          }
        }

        if (!sawError && !finished) {
          // Stream ended without a done/error frame — treat as soft failure.
          setFailed(true)
          const friendly = 'The showcase finished unexpectedly. Returning home…'
          setStatusMessage(friendly)
          window.setTimeout(() => goHome(friendly), 1400)
        }
      } catch {
        setFailed(true)
        const friendly = 'Network error while preparing the showcase. Returning home…'
        setStatusMessage(friendly)
        window.setTimeout(() => goHome(friendly), 1400)
      }
    }

    void run()
  }, [finished])

  return (
    <main className="demo-prepare-shell">
      <div className="demo-prepare-card" role="status" aria-live="polite" aria-busy={!finished && !failed}>
        <Link href="/" className="demo-prepare-back"><ArrowLeft size={15} /> Back to home</Link>
        <div className="demo-prepare-mark">
          {failed ? <CircleAlert size={22} /> : finished ? <BadgeCheck size={22} /> : <LoaderCircle size={22} className="demo-prepare-spin" />}
        </div>
        <p className="landing-eyebrow">FULL JOURNEY SHOWCASE</p>
        <h1>{failed ? 'Could not prepare showcase' : finished ? 'Showcase ready' : 'Preparing your complete journey'}</h1>
        <p className="demo-prepare-copy">
          {failed
            ? 'You will be returned to the home page shortly. You can retry the full showcase or open a lighter demo.'
            : 'Building a disposable demo with onboarding, Basic through Advanced delivery, meetings, calendar, and evidence reports.'}
        </p>

        <div className="demo-prepare-progress" aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="demo-prepare-percent">{Math.round(percent)}%</div>
        <p className={`demo-prepare-status ${failed ? 'is-error' : ''}`}>{statusMessage}</p>

        <ol className="demo-prepare-stages">
          {STAGES.map((stage) => {
            const status = stageStatus(stage.id, activeStageId, failed, finished)
            return (
              <li key={stage.id} className={`demo-prepare-stage ${status}`}>
                <span className="demo-prepare-stage-icon">
                  {status === 'done' ? <Check size={13} /> : status === 'error' ? <CircleAlert size={13} /> : status === 'active' ? <LoaderCircle size={13} className="demo-prepare-spin" /> : null}
                </span>
                <span>{stage.label}</span>
              </li>
            )
          })}
        </ol>

        {failed && (
          <div className="demo-prepare-actions">
            <Link className="landing-primary" href="/">Return home</Link>
            <Link className="landing-secondary" href="/demo?onboarding=1">Try onboarding demo</Link>
          </div>
        )}

        {!failed && (
          <p className="demo-prepare-note">This usually takes under a minute. Please keep this tab open.</p>
        )}
      </div>
    </main>
  )
}
