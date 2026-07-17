'use client'

import { useEffect, useState } from 'react'
import { Check, CircleAlert, Clock3, Lock, RefreshCw, Sparkles } from 'lucide-react'
import type { AssessmentReport } from '@/features/simulator/domain/assessment'

type Props = { organizationId: string }

function Score({ label, score, accent }: { label: string; score: number; accent: string }) {
  return <div className="score-block"><div className="score-ring" style={{ '--score': `${score * 3.6}deg`, '--accent': accent } as React.CSSProperties}><strong>{score}</strong></div><span>{label}</span></div>
}

export default function FunctionalFeedbackView({ organizationId }: Props) {
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = async () => {
    setIsLoading(true); setError('')
    try {
      const response = await fetch(`/api/simulation/feedback?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Feedback report unavailable')
      const data = await response.json() as { report: AssessmentReport }
      setReport(data.report)
    } catch {
      setError('The assessment report could not be loaded. Complete another action and try again.')
    } finally { setIsLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  const scores = report?.scores || { technicalExecution: 0, collaboration: 0, ownershipReliability: 0, processFit: 0 }
  const readiness = Math.round((scores.technicalExecution + scores.collaboration + scores.ownershipReliability + scores.processFit) / 4)
  return <div className="page feedback-page">
    <section className="page-title"><div><p className="eyebrow">PRIVATE COACHING · SERVER-DERIVED</p><h1>How you’re working</h1><p>Scores are calculated from recorded organization events and show the evidence behind every signal.</p></div><div className="feedback-actions"><button className="refresh-feedback" onClick={refresh} disabled={isLoading}><RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh evidence</button><span className="private-badge"><Lock size={14} /> Private</span></div></section>
    <div className="coaching-hero"><div><span className="eyebrow">CURRENT SIMULATION SIGNAL</span><h2>{isLoading ? 'Reading the organization trail…' : readiness >= 75 ? 'You’re closing the loop well.' : 'Your evidence is taking shape.'}</h2><p>{isLoading ? 'Loading the immutable event record for this organization.' : report?.eventCount ? `This report is based on ${report.eventCount} recorded learner and agent event${report.eventCount === 1 ? '' : 's'}, not a hidden model judgment.` : 'No server-side evidence is recorded yet. Complete an action in the simulator to begin an assessment trail.'}</p>{report && <div className="next-coaching-step"><Sparkles size={16} /><span><b>Next best action:</b> {report.nextStep}</span></div>}</div><Score score={readiness} label="Work readiness" accent="#7c70f2" /></div>
    <div className="score-grid"><Score score={scores.technicalExecution} label="Technical execution" accent="#3eae90" /><Score score={scores.collaboration} label="Collaboration" accent="#7c70f2" /><Score score={scores.ownershipReliability} label="Ownership & reliability" accent="#ee9d5c" /><Score score={scores.processFit} label="Process fit" accent="#5899e7" /></div>
    <div className="feedback-columns"><section className="card evidence-card"><div className="section-head"><div><span className="eyebrow">AUDITABLE EVIDENCE</span><h2>Why these scores changed</h2></div>{report && <span className="evidence-count">{report.eventCount} events</span>}</div>{error && <div className="feedback-error"><CircleAlert size={16} /> {error}</div>}{isLoading && <div className="feedback-loading"><Clock3 size={16} /> Building evidence report…</div>}{report?.evidence.map((item) => <div className={`evidence ${item.outcome === 'positive' ? 'positive' : 'action'}`} key={item.title}><span>{item.outcome === 'positive' ? <Check size={16} /> : <CircleAlert size={16} />}</span><div><b>{item.title}</b><p>{item.detail}</p><small>{item.eventIds.length ? `Evidence: ${item.eventIds.length} recorded event${item.eventIds.length === 1 ? '' : 's'}` : 'No supporting event yet'}</small></div></div>)}</section><section className="card path-card"><span className="eyebrow">SCORING METHOD</span><h2>Transparent by design</h2><p>Scores only use recorded workflow actions, written communication, review responses, mention behavior, and event timing.</p><div className="assessment-method"><div><Check size={15} /> Every signal links to an event</div><div><Check size={15} /> Message quality uses visible heuristics</div><div><Check size={15} /> No hidden personality judgment</div></div><p className="feedback-footnote">A production deployment should persist the event store in a database and retain an immutable evidence ledger.</p></section></div>
  </div>
}
