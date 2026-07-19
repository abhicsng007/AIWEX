'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CircleAlert, ExternalLink, LoaderCircle, ShieldCheck } from 'lucide-react'
import type { WorkspaceFile } from '@/features/simulator/domain/workspace'

type Props = {
  organizationId: string
  onReturn: () => void
  onFileSynchronized: (file: WorkspaceFile) => void
}

type Session = {
  workbenchUrl: string
  workbenchOrigin: string
  token: string
  expiresAt: string
  files: WorkspaceFile[]
}

function isWorkspaceFile(value: unknown): value is WorkspaceFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<WorkspaceFile>
  return typeof file.path === 'string' && typeof file.content === 'string' && ['typescript', 'tsx', 'markdown', 'json'].includes(file.language || '') && (typeof file.updatedAt === 'string' || file.updatedAt === null) && (typeof file.revisionId === 'string' || file.revisionId === null)
}

export default function FunctionalTheiaWorkspaceView({ organizationId, onReturn, onFileSynchronized }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [reason, setReason] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    let active = true
    const checkAvailability = async () => {
      try {
        const response = await fetch(`/api/simulation/ide/session?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
        const result = await response.json().catch(() => ({})) as { available?: boolean; reason?: string; error?: string }
        if (!active) return
        setAvailable(Boolean(response.ok && result.available))
        setReason(result.reason || result.error || '')
      } catch {
        if (!active) return
        setAvailable(false)
        setReason('The Theia workbench service could not be reached.')
      }
    }
    void checkAvailability()
    return () => { active = false }
  }, [organizationId])

  useEffect(() => {
    if (!session) return
    const receiveBridgeMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== session.workbenchOrigin || event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return
      const message = event.data as { type?: string; file?: unknown }
      if (message.type === 'aiwex.theia.ready') {
        frame.current?.contentWindow?.postMessage({ type: 'aiwex.theia.bootstrap', token: session.token, files: session.files, apiOrigin: window.location.origin, expiresAt: session.expiresAt }, session.workbenchOrigin)
      }
      if (message.type === 'aiwex.theia.revision-saved' && isWorkspaceFile(message.file)) onFileSynchronized(message.file)
    }
    window.addEventListener('message', receiveBridgeMessage)
    return () => window.removeEventListener('message', receiveBridgeMessage)
  }, [onFileSynchronized, session])

  const launch = async () => {
    setLaunching(true)
    setReason('')
    try {
      const response = await fetch('/api/simulation/ide/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId }) })
      const result = await response.json().catch(() => ({})) as Partial<Session> & { error?: string; reason?: string }
      if (!response.ok || !result.workbenchUrl || !result.workbenchOrigin || !result.token || !result.expiresAt || !Array.isArray(result.files)) {
        setReason(result.error || result.reason || 'Theia could not start. Your built-in workspace is still available.')
        setAvailable(false)
        return
      }
      setSession(result as Session)
    } catch {
      setReason('Theia could not start. Your built-in workspace is still available.')
    } finally {
      setLaunching(false)
    }
  }

  if (available === null) return <section className="theia-state"><LoaderCircle className="spin" size={20} /><div><b>Checking the secure Theia workbench...</b><span>The standard workspace remains available while this check runs.</span></div><button className="theia-return" type="button" onClick={onReturn}><ArrowLeft size={15} /> Return to workspace</button></section>
  if (!available) return <section className="theia-state"><CircleAlert size={20} /><div><b>Theia beta is not available for this run.</b><span>{reason || 'The secure workbench is disabled or not configured.'}</span></div><button className="theia-return" type="button" onClick={onReturn}><ArrowLeft size={15} /> Use built-in workspace</button></section>
  if (!session) return <section className="theia-state"><ShieldCheck size={20} /><div><b>Theia beta is ready.</b><span>Launch the isolated editor. Your scenario files will remain in the AIWEX event ledger.</span></div><button className="primary-button" type="button" disabled={launching} onClick={() => void launch()}>{launching ? <><LoaderCircle className="spin" size={15} /> Starting...</> : <><ExternalLink size={15} /> Launch Theia</>}</button><button className="theia-return" type="button" onClick={onReturn}><ArrowLeft size={15} /> Use built-in workspace</button></section>

  return <section className="theia-workbench">
    <header><div><ShieldCheck size={16} /><span><b>Theia beta - isolated workbench</b><small>Session expires at {new Date(session.expiresAt).toLocaleTimeString()}. Saves remain in the AIWEX event ledger.</small></span></div><button className="theia-return" type="button" onClick={onReturn}><ArrowLeft size={15} /> Use built-in workspace</button></header>
    <iframe ref={frame} src={session.workbenchUrl} title="SignalDesk Theia workbench" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups" referrerPolicy="no-referrer" allow="clipboard-read; clipboard-write" />
  </section>
}
