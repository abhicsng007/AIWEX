'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, CircleAlert, Clock3, FileCheck2, Lock, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import type { AssessmentReport } from '@/features/simulator/domain/assessment'
import type { DeliveryReport, RecruiterSignalStatus } from '@/features/simulator/domain/delivery-reports'

type Props = { organizationId: string }

function Score({ label, score, accent }: { label: string; score: number; accent: string }) {
  return <div className="score-block"><div className="score-ring" style={{ '--score': `${score * 3.6}deg`, '--accent': accent } as React.CSSProperties}><strong>{score}</strong></div><span>{label}</span></div>
}

function reportDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recorded just now' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function signalLabel(status: RecruiterSignalStatus) {
  if (status === 'verified') return 'Verified in ledger'
  if (status === 'partial') return 'Partially evidenced'
  return 'Evidence needed'
}

function ReportCard({ report, index, open, onToggle }: { report: DeliveryReport; index: number; open: boolean; onToggle: () => void }) {
  const verified = report.recruiterSignals.filter((signal) => signal.status === 'verified').length
  const isFinal = report.kind === 'project'
  const highlights = report.evidenceHighlights?.length ? report.evidenceHighlights : report.strengths
  return <article className={`delivery-report ${isFinal ? 'final-report' : ''}`}>
    <button className="delivery-report-summary" onClick={onToggle} aria-expanded={open}>
      <span className="delivery-report-marker">{isFinal ? <ShieldCheck size={15} /> : index + 1}</span>
      <span className="delivery-report-title">
        <small>{isFinal ? 'FINAL PROJECT REPORT' : `${String(report.scenarioLevel).toUpperCase()} DELIVERY REPORT`}</small>
        <b>{report.taskId ? `${report.taskId} · ${report.taskTitle}` : report.taskTitle}</b>
        <em>{reportDate(report.createdAt)} · {verified}/{report.recruiterSignals.length} evidence dimensions verified</em>
      </span>
      <ChevronDown size={18} className={open ? 'open' : ''} />
    </button>
    {open && <div className="delivery-report-body">
      <p className="delivery-report-summary-text">{report.summary}</p>

      {highlights.length > 0 && (
        <section className="evidence-highlights" aria-label="Evidence highlights">
          <div className="report-section-head"><span className="eyebrow">EVIDENCE HIGHLIGHTS</span><small>Concrete facts from the ledger</small></div>
          <ul className="evidence-highlight-list">
            {highlights.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}

      <div className="delivery-report-insight">
        <FileCheck2 size={17} />
        <div>
          <b>What a recruiter can verify</b>
          <p>{report.strengths.join(' ')}</p>
          {report.growthArea && <p className="growth-area"><b>Gap still visible in the ledger:</b> {report.growthArea}</p>}
        </div>
      </div>

      <section className="recruiter-signal-list" aria-label="Recruiter-relevant evidence">
        <div className="report-section-head">
          <span className="eyebrow">RECRUITER EVIDENCE DIMENSIONS</span>
          <small>Findings + artifacts (not resume claims)</small>
        </div>
        {report.recruiterSignals.map((signal) => (
          <article className={`recruiter-signal ${signal.status}`} key={signal.id}>
            <span>{signal.status === 'verified' ? <Check size={15} /> : signal.status === 'partial' ? <CircleAlert size={15} /> : <Clock3 size={15} />}</span>
            <div>
              <div className="recruiter-signal-head">
                <b>{signal.label}</b>
                <small>{signalLabel(signal.status)}</small>
              </div>
              <p className="signal-finding">{signal.finding}</p>
              {signal.artifacts?.length ? (
                <ul className="signal-artifacts">
                  {signal.artifacts.map((artifact) => <li key={artifact}>{artifact}</li>)}
                </ul>
              ) : null}
              <em>{signal.eventIds.length ? `${signal.eventIds.length} linked ledger event${signal.eventIds.length === 1 ? '' : 's'}` : 'No linked ledger event yet'}</em>
            </div>
          </article>
        ))}
      </section>

      <section className="delivery-timeline" aria-label="Task evidence timeline">
        <div className="report-section-head">
          <span className="eyebrow">RECORDED DELIVERY TRAIL</span>
          <small>{report.timeline.length} timestamped events</small>
        </div>
        {report.timeline.length
          ? report.timeline.map((item) => (
            <div className="delivery-timeline-item" key={item.eventId}>
              <i />
              <span>
                <b>{item.label}</b>
                {item.detail ? <p className="timeline-detail">{item.detail}</p> : null}
                <small>{reportDate(item.at)}</small>
              </span>
            </div>
          ))
          : <p>No workflow evidence was available when this snapshot was created.</p>}
      </section>

      {isFinal && report.performanceNarrative && (
        <section className="performance-narrative" aria-label="How the learner fared">
          <div className="report-section-head">
            <span className="eyebrow">HOW YOU FARED</span>
            <small>Written assessment from the evidence trail</small>
          </div>
          <p className="performance-narrative-intro">
            The following sections describe performance in plain language. They are grounded in the recorded work above, without restating scores or raw metrics.
          </p>
          {([
            ['Technical execution', report.performanceNarrative.technicalExecution],
            ['Collaboration', report.performanceNarrative.collaboration],
            ['Ownership & reliability', report.performanceNarrative.ownershipReliability],
            ['Process fit', report.performanceNarrative.processFit],
            ['Work readiness', report.performanceNarrative.workReadiness],
          ] as const).map(([title, body]) => (
            <article className="performance-narrative-block" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </section>
      )}

      <p className="report-disclaimer">
        This portfolio is generated only from append-only simulation events (ids, timestamps, and metadata).
        It is practice evidence for this scenario, not an employer verification or hiring decision.
      </p>
    </div>}
  </article>
}

export default function FunctionalFeedbackView({ organizationId }: Props) {
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [deliveryReports, setDeliveryReports] = useState<DeliveryReport[]>([])
  const [openReportId, setOpenReportId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = async () => {
    setIsLoading(true); setError('')
    try {
      const response = await fetch(`/api/simulation/feedback?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Feedback report unavailable')
      const data = await response.json() as { report: AssessmentReport; deliveryReports?: DeliveryReport[] }
      setReport(data.report)
      const nextReports = data.deliveryReports || []
      setDeliveryReports(nextReports)
      setOpenReportId((current) => current || nextReports[nextReports.length - 1]?.id || null)
    } catch {
      setError('The assessment report could not be loaded. Complete another action and try again.')
    } finally { setIsLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  const scores = report?.scores || { technicalExecution: 0, collaboration: 0, ownershipReliability: 0, processFit: 0 }
  const readiness = Math.round((scores.technicalExecution + scores.collaboration + scores.ownershipReliability + scores.processFit) / 4)
  const finalReport = deliveryReports.find((item) => item.kind === 'project')
  return <div className="page feedback-page">
    <section className="page-title"><div><p className="eyebrow">PRIVATE COACHING · SERVER-DERIVED</p><h1>How you’re working</h1><p>Scores and delivery cards are calculated only from recorded organization events, with concrete artifacts a recruiter can inspect.</p></div><div className="feedback-actions"><button className="refresh-feedback" onClick={refresh} disabled={isLoading}><RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh evidence</button><span className="private-badge"><Lock size={14} /> Private</span></div></section>
    <div className="coaching-hero"><div><span className="eyebrow">CURRENT SIMULATION SIGNAL</span><h2>{isLoading ? 'Reading the organization trail…' : readiness >= 75 ? 'You’re closing the loop well.' : 'Your evidence is taking shape.'}</h2><p>{isLoading ? 'Loading the immutable event record for this organization.' : report?.eventCount ? `This report is based on ${report.eventCount} recorded learner and agent event${report.eventCount === 1 ? '' : 's'}, not a hidden model judgment.` : 'No server-side evidence is recorded yet. Complete an action in the simulator to begin an assessment trail.'}</p>{report && <div className="next-coaching-step"><Sparkles size={16} /><span><b>Next best action:</b> {report.nextStep}</span></div>}</div><Score score={readiness} label="Work readiness" accent="#7c70f2" /></div>
    <div className="score-grid"><Score score={scores.technicalExecution} label="Technical execution" accent="#3eae90" /><Score score={scores.collaboration} label="Collaboration" accent="#7c70f2" /><Score score={scores.ownershipReliability} label="Ownership & reliability" accent="#ee9d5c" /><Score score={scores.processFit} label="Process fit" accent="#5899e7" /></div>
    <section className="delivery-history"><div className="section-head"><div><span className="eyebrow">DELIVERY EVIDENCE HISTORY</span><h2>Task reports, in the order you completed them</h2><p>Each card is an immutable snapshot created when a task clears the merge gate. Open a card for timestamps, quotes, IDs, and linked ledger events.</p></div><span className={`report-progress ${finalReport ? 'complete' : ''}`}>{finalReport ? 'Final report ready' : `${deliveryReports.filter((item) => item.kind === 'task').length}/6 task reports`}</span></div>
      {isLoading && <div className="feedback-loading"><Clock3 size={16} /> Reading delivery-report history…</div>}
      {!isLoading && deliveryReports.length === 0 && <div className="empty-delivery-history"><FileCheck2 size={20} /><div><b>Your first delivery report will appear here.</b><p>Finish a task through checks, review, approval, and merge. The system will then capture the evidence automatically.</p></div></div>}
      <div className="delivery-report-timeline">{deliveryReports.map((item, index) => <ReportCard key={item.id} report={item} index={index} open={openReportId === item.id} onToggle={() => setOpenReportId((current) => current === item.id ? null : item.id)} />)}</div>
    </section>
    <div className="feedback-columns"><section className="card evidence-card"><div className="section-head"><div><span className="eyebrow">AUDITABLE EVIDENCE</span><h2>Why these scores changed</h2></div>{report && <span className="evidence-count">{report.eventCount} events</span>}</div>{error && <div className="feedback-error"><CircleAlert size={16} /> {error}</div>}{isLoading && <div className="feedback-loading"><Clock3 size={16} /> Building evidence report…</div>}{report?.evidence.map((item) => <div className={`evidence ${item.outcome === 'positive' ? 'positive' : 'action'}`} key={item.title}><span>{item.outcome === 'positive' ? <Check size={16} /> : <CircleAlert size={16} />}</span><div><b>{item.title}</b><p>{item.detail}</p><small>{item.eventIds.length ? `Evidence: ${item.eventIds.length} recorded event${item.eventIds.length === 1 ? '' : 's'}` : 'No supporting event yet'}</small></div></div>)}</section><section className="card path-card"><span className="eyebrow">SCORING METHOD</span><h2>Transparent by design</h2><p>Scores only use recorded workflow actions, written communication, review responses, mention behavior, and event timing.</p><div className="assessment-method"><div><Check size={15} /> Every signal links to an event</div><div><Check size={15} /> Message quality uses visible heuristics</div><div><Check size={15} /> No hidden personality judgment</div></div><p className="feedback-footnote">A production deployment should persist the event store in a database and retain an immutable evidence ledger.</p></section></div>
  </div>
}
