'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, BookOpen, BriefcaseBusiness, CalendarDays, Check, CircleAlert, ClipboardCheck, Clock3,
  ExternalLink, FileCheck2, GraduationCap, KeyRound, Layers3, Lock, Play, RotateCcw, ShieldCheck,
  UserRound, UsersRound,
} from 'lucide-react'
import { trainingPhases, type PublicOnboardingState, type ReadinessEvaluation, type ReadinessQuestion, type TrainingSlide } from '@/features/simulator/domain/onboarding'

type Props = { organizationId: string; onQualified: () => void; openProject: () => void }
type ClientSlide = Omit<TrainingSlide, 'correctOption'>
type ClientReadinessQuestion = Omit<ReadinessQuestion, 'correctOption'>
type ApiResponse = { state: PublicOnboardingState; slides?: ClientSlide[]; readinessQuestions?: ClientReadinessQuestion[]; correct?: boolean; correctAnswer?: string; feedback?: string; qualified?: boolean; score?: number; evaluation?: ReadinessEvaluation }
type QuizReview = { slide: ClientSlide; selectedAnswer: string; correctAnswer: string; feedback: string }

const phaseOrder: PublicOnboardingState['phase'][] = ['profile', 'policy', 'access', 'training', 'demo_task', 'qualified']
const phaseCopy: Record<PublicOnboardingState['phase'], { label: string; detail: string }> = {
  not_started: { label: 'Not started', detail: 'Employee record pending activation.' },
  profile: { label: 'Identity', detail: 'Confirm profile, reporting line, and role scope.' },
  policy: { label: 'Compliance', detail: 'Acknowledge required workplace policies.' },
  access: { label: 'Access', detail: 'Provision project systems and team channels.' },
  training: { label: 'Role enablement', detail: 'Complete required role-specific modules.' },
  remediation: { label: 'Remediation', detail: 'Close gaps from the readiness review.' },
  demo_task: { label: 'Readiness', detail: 'Submit evidence for manager-approved project access.' },
  qualified: { label: 'Qualified', detail: 'Project calendar and team access are active.' },
}

function statusFor(state: PublicOnboardingState, phase: PublicOnboardingState['phase']) {
  const activeIndex = phaseOrder.indexOf(state.phase === 'remediation' ? 'demo_task' : state.phase)
  const phaseIndex = phaseOrder.indexOf(phase)
  if (state.phase === 'qualified') return 'complete'
  if (phaseIndex < activeIndex) return 'complete'
  if (phaseIndex === activeIndex) return 'active'
  return 'locked'
}

function Header({ state }: { state: PublicOnboardingState }) {
  const completedPolicies = state.policies.filter((policy) => policy.acknowledged).length
  const grantedAccess = state.access.filter((item) => item.status === 'granted').length
  const completedModules = state.completedSlideIds.length
  return <section className="enterprise-onboarding-header">
    <div>
      <p className="eyebrow">ORGANIZATIONAL ONBOARDING</p>
      <h1>{state.profile.name}</h1>
      <p>{state.profile.role} - {state.profile.department} - Manager: {state.profile.manager}</p>
    </div>
    <div className="onboarding-metrics" aria-label="Onboarding progress">
      <div><b>{completedPolicies}/{state.policies.length}</b><span>Policies</span></div>
      <div><b>{grantedAccess}/{state.access.length}</b><span>Systems</span></div>
      <div><b>{completedModules}/{trainingPhases.length}</b><span>Modules</span></div>
    </div>
  </section>
}

function PhaseRail({ state }: { state: PublicOnboardingState }) {
  return <aside className="onboarding-phase-rail" aria-label="Onboarding gates">
    {phaseOrder.map((phase, index) => {
      const status = statusFor(state, phase)
      const copy = phaseCopy[phase]
      return <div key={phase} className={status}>
        <span>{status === 'complete' ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span>
        <b>{copy.label}</b>
        <small>{copy.detail}</small>
      </div>
    })}
  </aside>
}

function OnboardingFrame({ state, children }: { state: PublicOnboardingState; children: React.ReactNode }) {
  return <div className="page onboarding-page enterprise-onboarding-page">
    <Header state={state} />
    <div className="enterprise-onboarding-grid">
      <PhaseRail state={state} />
      <main>{children}</main>
    </div>
  </div>
}

function SystemStatus({ state }: { state: PublicOnboardingState }) {
  return <section className="onboarding-system-grid">
    <article className="card onboarding-system-card">
      <UserRound size={18} />
      <span>Employee record</span>
      <b>{state.profileConfirmed ? 'Confirmed' : 'Pending confirmation'}</b>
    </article>
    <article className="card onboarding-system-card">
      <ShieldCheck size={18} />
      <span>Policy status</span>
      <b>{state.policies.filter((policy) => policy.acknowledged).length}/{state.policies.length} acknowledged</b>
    </article>
    <article className="card onboarding-system-card">
      <KeyRound size={18} />
      <span>Access status</span>
      <b>{state.access.filter((item) => item.status === 'granted').length}/{state.access.length} systems granted</b>
    </article>
    <article className="card onboarding-system-card">
      <FileCheck2 size={18} />
      <span>Manager review</span>
      <b>{state.managerReview.status === 'approved' ? 'Approved' : 'Pending evidence'}</b>
    </article>
  </section>
}

function StartView({ state, submit }: { state: PublicOnboardingState; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  return <OnboardingFrame state={state}>
    <section className="onboarding-command-center">
      <div>
        <p className="eyebrow">PRE-BOARDING RECORD</p>
        <h2>Complete the gates required before project access.</h2>
        <p>This workflow confirms identity, compliance, system access, role enablement, and readiness evidence before you enter the main SignalDesk project environment.</p>
        <button className="primary-button" onClick={() => void submit({ action: 'start' })}><Play size={15} /> Activate onboarding record</button>
      </div>
      <SystemStatus state={state} />
    </section>
  </OnboardingFrame>
}

function ProfileView({ state, submit }: { state: PublicOnboardingState; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  const rows = [
    ['Employee ID', state.profile.employeeId],
    ['Role', state.profile.role],
    ['Department', state.profile.department],
    ['Location', state.profile.location],
    ['Manager', state.profile.manager],
    ['Onboarding buddy', state.profile.buddy],
    ['Start date', state.profile.startDate],
    ['Cohort', state.profile.cohort],
    ['Engagement', state.profile.employmentType],
  ]
  return <OnboardingFrame state={state}>
    <section className="card profile-confirmation-card">
      <div className="enterprise-section-head">
        <div><p className="eyebrow">IDENTITY AND REPORTING LINE</p><h2>Confirm employee profile</h2><p>Project access depends on a verified learner identity, reporting line, and assigned role scope.</p></div>
        <span className="private-badge"><Lock size={14} /> Internal record</span>
      </div>
      <div className="profile-record-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
      <button className="primary-button" onClick={() => void submit({ action: 'confirm_profile' })}><Check size={15} /> Confirm profile</button>
    </section>
  </OnboardingFrame>
}

function PolicyView({ state, submit }: { state: PublicOnboardingState; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  return <OnboardingFrame state={state}>
    <section className="enterprise-section-head">
      <div><p className="eyebrow">COMPLIANCE GATES</p><h2>Required policy acknowledgements</h2><p>Each acknowledgement is recorded as onboarding evidence before systems access is granted.</p></div>
      <span className="private-badge"><ShieldCheck size={14} /> Audit logged</span>
    </section>
    <div className="policy-list">{state.policies.map((policy) => <article className={`card policy-card ${policy.acknowledged ? 'complete' : ''}`} key={policy.id}>
      <div>
        <span className="policy-owner">{policy.owner} - {policy.due}</span>
        <h3>{policy.title}</h3>
        <p>{policy.description}</p>
        <small>{policy.evidence}</small>
      </div>
      <button className={policy.acknowledged ? 'ghost-button acknowledged-button' : 'primary-button'} disabled={policy.acknowledged} onClick={() => void submit({ action: 'acknowledge_policy', policyId: policy.id })}>{policy.acknowledged ? <><Check size={15} /> Acknowledged</> : <><ClipboardCheck size={15} /> Acknowledge</>}</button>
    </article>)}</div>
  </OnboardingFrame>
}

function AccessView({ state, submit }: { state: PublicOnboardingState; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  return <OnboardingFrame state={state}>
    <section className="enterprise-section-head">
      <div><p className="eyebrow">SYSTEMS ACCESS</p><h2>Provision workspace access</h2><p>Required systems must be granted before role enablement starts. Optional systems are visible for operational context.</p></div>
      <span className="private-badge"><KeyRound size={14} /> Least privilege</span>
    </section>
    <div className="access-table card">
      {state.access.map((item) => <div className={item.status === 'granted' ? 'granted' : ''} key={item.id}>
        <span className="access-state">{item.status === 'granted' ? 'Granted' : item.requiredForProject ? 'Required' : 'Optional'}</span>
        <b>{item.system}</b>
        <p>{item.purpose}</p>
        <small>Owner: {item.owner}</small>
        <button className={item.status === 'granted' ? 'ghost-button acknowledged-button' : 'primary-button'} disabled={item.status === 'granted'} onClick={() => void submit({ action: 'provision_access', accessId: item.id })}>{item.status === 'granted' ? <><Check size={15} /> Active</> : <><KeyRound size={15} /> Provision</>}</button>
      </div>)}
    </div>
  </OnboardingFrame>
}

function TrainingSession({ state, slide, slides, answer, setAnswer, submit, feedback }: { state: PublicOnboardingState; slide: ClientSlide; slides: ClientSlide[]; answer: number | null; setAnswer: (value: number | null) => void; submit: (payload: Record<string, unknown>) => Promise<void>; feedback: string }) {
  const currentPhase = trainingPhases.findIndex((phase) => phase.id === slide.phase)
  const slidesInPhase = slides.filter((item) => item.phase === slide.phase)
  const completedInPhase = slidesInPhase.filter((item) => state.completedSlideIds.includes(item.id)).length
  const slideNumber = slides.findIndex((item) => item.id === slide.id) + 1
  return <OnboardingFrame state={state}>
    <section className="learning-header enterprise-learning-header">
      <div><p className="eyebrow">ROLE ENABLEMENT MODULE</p><h1>{slide.title}</h1><p>{slide.section} - Module {slideNumber} of {slides.length}</p></div>
      <span className="private-badge"><Lock size={14} /> Main project locked</span>
    </section>
    <section className="learning-progress enterprise-learning-progress" aria-label="Onboarding curriculum progress">{trainingPhases.map((phase, index) => <div key={phase.id} className={index < currentPhase ? 'complete' : index === currentPhase ? 'active' : ''}><span>{index < currentPhase ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><b>{phase.label}</b><small>{phase.description}</small></div>)}</section>
    <section className="training-layout comprehensive-training">
      <article className="card training-slide">
        <div className="training-slide-kicker"><Layers3 size={16} /><span>Session {currentPhase + 1} of {trainingPhases.length}</span><em>{completedInPhase + 1}/{slidesInPhase.length} in this session</em></div>
        <p>{slide.body}</p>
        <div className="training-highlights"><b>Expected workplace behavior</b><ul>{slide.highlights.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></div>
        {slide.resources && <div className="training-resources"><div><BookOpen size={15} /><b>Reference material</b><span>Official references for deeper study.</span></div>{slide.resources.map((resource) => <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer"><span><b>{resource.label}</b><small>{resource.description}</small></span><ExternalLink size={14} /></a>)}</div>}
      </article>
      <aside className="card quiz-card">
        <span className="eyebrow">CONTROL CHECK</span>
        <span className="quiz-score">Pass this control to unlock the next module</span>
        <h2>{slide.question}</h2>
        {slide.options.map((option, index) => <button key={option} aria-pressed={answer === index} className={answer === index ? 'selected-answer' : ''} onClick={() => setAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}
        <button className="primary-button" disabled={answer === null} onClick={() => { if (answer !== null) { void submit({ action: 'submit_quiz', slideId: slide.id, answer }); setAnswer(null) } }}><Check size={15} /> Check response</button>
        {feedback && <p className="onboarding-feedback"><CircleAlert size={14} /> {feedback}</p>}
      </aside>
    </section>
  </OnboardingFrame>
}

function QuizAnswerReview({ review, continueLearning, state }: { review: QuizReview; continueLearning: () => void; state: PublicOnboardingState }) {
  return <OnboardingFrame state={state}>
    <section className="card quiz-answer-review">
      <div className="quiz-review-mark"><Check size={22} /></div>
      <div><span className="eyebrow">CONTROL CHECK COMPLETE</span><h2>{review.selectedAnswer}</h2></div>
      <div className="quiz-correct-answer"><span className="eyebrow">EXPECTED RESPONSE</span><b>{review.correctAnswer}</b></div>
      <div className="quiz-rationale"><b>Why this matters</b><p>{review.feedback.replace(/^Correct\.\s*/, '')}</p></div>
      <button className="primary-button" onClick={continueLearning}>Continue onboarding <Play size={15} /></button>
    </section>
  </OnboardingFrame>
}

function RemediationView({ state, submit }: { state: PublicOnboardingState; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  return <OnboardingFrame state={state}>
    <section className="card readiness-card enterprise-readiness-card">
      <p className="eyebrow">READINESS REMEDIATION</p>
      <h2>Close the evidence gaps before manager approval</h2>
      <p>Your readiness plan needs stronger workplace evidence. Review the rubric and return when the implementation, risk, and validation story is complete.</p>
      <div className="readiness-rubric">
        <div><span>REQUIRED SCORE</span><b>80 / 100</b><small>All production-risk criteria must be addressed.</small></div>
        <ul>
          <li><Check size={14} /><span><b>Permission boundary</b><small>Name canManageBilling and server enforcement.</small></span></li>
          <li><Check size={14} /><span><b>Legacy state</b><small>Preserve older workspace behavior.</small></span></li>
          <li><Check size={14} /><span><b>Security</b><small>Protect data, secrets, and authorization.</small></span></li>
          <li><Check size={14} /><span><b>Validation</b><small>Cover allowed and restricted roles.</small></span></li>
        </ul>
      </div>
      <p className="onboarding-feedback"><RotateCcw size={14} /> {state.readinessFeedback || 'Review the feedback and continue when your evidence is ready.'}</p>
      <button className="primary-button" onClick={() => void submit({ action: 'resume_readiness' })}><Play size={15} /> Return to readiness task</button>
    </section>
  </OnboardingFrame>
}

function ReadinessView({ state, questions, answers, setAnswers, submit, feedback }: { state: PublicOnboardingState; questions: ClientReadinessQuestion[]; answers: Record<string, number>; setAnswers: (answers: Record<string, number>) => void; submit: (payload: Record<string, unknown>) => Promise<void>; feedback: string }) {
  const allAnswered = questions.length > 0 && questions.every((question) => Number.isInteger(answers[question.id]))
  return <OnboardingFrame state={state}>
    <section className="card readiness-card enterprise-readiness-card">
      <div className="enterprise-section-head">
        <div><p className="eyebrow">MANAGER READINESS REVIEW</p><h2>Complete the project-access assessment</h2><p>Choose the most appropriate response for each production-work scenario. Your manager review will show the result for every criterion.</p></div>
        <span className="private-badge"><UsersRound size={14} /> Reviewer: {state.managerReview.reviewer}</span>
      </div>
      <div className="readiness-assessment-summary"><span><b>5 scenarios</b><small>One decision per scenario</small></span><span><b>80 / 100</b><small>Passing score</small></span><span><b>{Object.keys(answers).filter((id) => Number.isInteger(answers[id])).length} / {questions.length}</b><small>Responses selected</small></span></div>
      <div className="readiness-mcq-list">
        {questions.map((question, questionIndex) => <fieldset key={question.id}>
          <legend><span>{String(questionIndex + 1).padStart(2, '0')}</span>{question.prompt}</legend>
          <div>{question.options.map((option, optionIndex) => <label className={answers[question.id] === optionIndex ? 'selected-readiness-answer' : ''} key={option}>
            <input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} />
            <span>{String.fromCharCode(65 + optionIndex)}</span><b>{option}</b>
          </label>)}</div>
        </fieldset>)}
      </div>
      <div><button className="primary-button" disabled={!allAnswered} onClick={() => void submit({ action: 'submit_readiness', answers })}><FileCheck2 size={15} /> Submit assessment for manager review</button><span>Attempt {state.readinessAttempts + 1}</span></div>
      {(feedback || state.readinessFeedback) && <p className="onboarding-feedback"><RotateCcw size={14} /> {feedback || state.readinessFeedback}</p>}
    </section>
  </OnboardingFrame>
}

function ReadinessResultView({ state, evaluation, retry, openProject }: { state: PublicOnboardingState; evaluation: ReadinessEvaluation; retry: () => void; openProject: () => void }) {
  return <OnboardingFrame state={state}>
    <section className={`card readiness-result ${evaluation.passed ? 'approved' : 'needs-work'}`}>
      <div className="readiness-result-head">
        <span className="readiness-result-icon">{evaluation.passed ? <Check size={22} /> : <CircleAlert size={22} />}</span>
        <div><p className="eyebrow">MANAGER REVIEW RESULT</p><h2>{evaluation.passed ? 'Project access approved' : 'Strengthen the evidence before approval'}</h2><p>{evaluation.feedback}</p></div>
        <div className="readiness-score"><span>SCORE</span><b>{evaluation.score}<small>/100</small></b><small>Pass threshold: 80</small></div>
      </div>
      <div className="readiness-result-criteria">
        {evaluation.criteria.map((criterion) => <article className={criterion.met ? 'met' : 'missing'} key={criterion.label}>
          {criterion.met ? <Check size={16} /> : <CircleAlert size={16} />}
          <div><b>{criterion.label}</b><span>{criterion.met ? 'Your selected response is correct.' : criterion.evidence}</span></div>
        </article>)}
      </div>
      <div className="readiness-result-actions">
        {evaluation.passed
          ? <button className="primary-button" onClick={openProject}>Join introduction meeting <ArrowRight size={15} /></button>
          : <button className="primary-button" onClick={retry}>Review selections and try again <RotateCcw size={15} /></button>}
      </div>
    </section>
  </OnboardingFrame>
}

function QualifiedView({ state, openProject, updateSchedule, feedback, welcome }: { state: PublicOnboardingState; openProject: () => void; updateSchedule: (action: 'complete' | 'request_extension' | 'check_deadlines', scheduleId?: string) => Promise<void>; feedback: string; welcome: { started: boolean; introduced: boolean; concluded: boolean } | null }) {
  return <OnboardingFrame state={state}>
    <section className="qualified-command-center">
      <div>
        <p className="eyebrow">PROJECT ACCESS APPROVED</p>
        <h2>Your SignalDesk work calendar is active</h2>
        <p>{state.managerReview.summary} Deadlines use your local timezone. Communicate risk early and keep evidence attached to the work.</p>
      </div>
      <button className="primary-button" onClick={openProject}>Join introduction meeting <ArrowRight size={15} /></button>
    </section>
    <SystemStatus state={state} />
    <section className="calendar-summary">
      <div><Check size={17} /><span><b>Readiness approved</b><small>{state.quizScore}% control pass rate - {state.readinessAttempts} review attempt{state.readinessAttempts === 1 ? '' : 's'}</small></span></div>
      <div><CalendarDays size={17} /><span><b>{state.missedDeadlines}/2 grace events used</b><small>{state.penalties ? `${state.penalties} reliability deduction${state.penalties === 1 ? '' : 's'} applied` : 'No deadline deductions'}</small></span></div>
      <button className="ghost-button" onClick={() => void updateSchedule('check_deadlines')}>Refresh deadline status</button>
    </section>
    {welcome && !welcome.concluded && <section className="card welcome-ceremony">
      <span className="eyebrow">TEAM WELCOME CEREMONY</span>
      <h2>{welcome.introduced ? 'The team has your introduction.' : 'Start with the live introduction meeting'}</h2>
      <p>{welcome.introduced ? 'Marcus has concluded the welcome. You can now use Team Spaces for questions and scheduled handoffs.' : 'After onboarding, meet Marcus, Maya, Noah, and Devon in the conference room. Introduce yourself, share what you want to learn, and ask one initial question.'}</p>
      {!welcome.introduced && <button className="primary-button" onClick={openProject}>Open introduction meeting <ArrowRight size={15} /></button>}
    </section>}
    <section className="calendar-list">{state.schedule.map((item) => <article className={`card calendar-item ${item.missed ? 'missed' : item.completed ? 'completed' : ''}`} key={item.id}>
      <div><span className="calendar-kind">{item.kind}</span><h2>{item.title}</h2><p>{new Date(item.startsAt).toLocaleString()} - {new Date(item.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
      <div className="calendar-actions">{item.completed ? <span><Check size={15} /> Complete</span> : item.missed ? <span className="missed-label"><CircleAlert size={15} /> Missed</span> : <><button className="ghost-button" onClick={() => void updateSchedule('complete', item.id)}>Mark complete</button>{item.kind === 'deadline' && <button className="ghost-button" onClick={() => void updateSchedule('request_extension', item.id)} disabled={item.extensionRequested}>{item.extensionRequested ? 'Extension requested' : 'Request reschedule'}</button>}</>}</div>
    </article>)}</section>
    {feedback && <p className="onboarding-feedback"><CircleAlert size={14} /> {feedback}</p>}
  </OnboardingFrame>
}

export default function FunctionalOnboardingView({ organizationId, onQualified, openProject }: Props) {
  const [state, setState] = useState<PublicOnboardingState | null>(null)
  const [slides, setSlides] = useState<ClientSlide[]>([])
  const [answer, setAnswer] = useState<number | null>(null)
  const [quizReview, setQuizReview] = useState<QuizReview | null>(null)
  const [readinessResult, setReadinessResult] = useState<ReadinessEvaluation | null>(null)
  const [readinessQuestions, setReadinessQuestions] = useState<ClientReadinessQuestion[]>([])
  const [readinessAnswers, setReadinessAnswers] = useState<Record<string, number>>({})
  const [welcome, setWelcome] = useState<{ started: boolean; introduced: boolean; concluded: boolean } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const statePhase = state?.phase
  const slide = useMemo(() => state?.currentSlide || (Array.isArray(slides) ? slides : []).find((item) => !state?.completedSlideIds.includes(item.id)), [slides, state?.completedSlideIds, state?.currentSlide])

  const refresh = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/simulation/onboarding?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
      const data = await response.json() as ApiResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || data.feedback || 'Onboarding is unavailable.')
      setState(data.state)
      if (Array.isArray(data.slides)) setSlides(data.slides)
      if (Array.isArray(data.readinessQuestions)) setReadinessQuestions(data.readinessQuestions)
      if (data.state.phase === 'qualified') onQualified()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Onboarding is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const submit = async (payload: Record<string, unknown>) => {
    setFeedback('')
    const response = await fetch('/api/simulation/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone }, body: JSON.stringify({ organizationId, ...payload }) })
    const data = await response.json() as ApiResponse & { error?: string }
    if (!response.ok) { setFeedback(data.error || 'That onboarding action could not be recorded.'); return }
    if (payload.action === 'submit_quiz' && data.correct && typeof payload.slideId === 'string' && typeof payload.answer === 'number') {
      const completedSlide = slides.find((item) => item.id === payload.slideId)
      if (completedSlide) setQuizReview({ slide: completedSlide, selectedAnswer: completedSlide.options[payload.answer], correctAnswer: data.correctAnswer || '', feedback: data.feedback || '' })
    }
    if (payload.action === 'submit_readiness' && data.evaluation) {
      setReadinessResult(data.evaluation)
      // Passing readiness unlocks the project and routes into the introduction meeting room.
      if (data.evaluation.passed && data.state.phase === 'qualified') {
        setState(data.state)
        onQualified()
        openProject()
        return
      }
    }
    setState(data.state)
    if (Array.isArray(data.slides)) setSlides(data.slides)
    if (Array.isArray(data.readinessQuestions)) setReadinessQuestions(data.readinessQuestions)
    setFeedback(data.feedback || '')
    if (data.state.phase === 'qualified') onQualified()
  }

  const updateSchedule = async (action: 'complete' | 'request_extension' | 'check_deadlines', scheduleId?: string) => {
    const response = await fetch('/api/simulation/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, action, scheduleId }) })
    if (!response.ok) { const data = await response.json() as { error?: string }; setFeedback(data.error || 'Schedule update failed.'); return }
    await refresh()
  }

  const refreshWelcome = async (startIfNeeded = false) => {
    const response = await fetch(`/api/simulation/team-welcome?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json() as { state: { started: boolean; introduced: boolean; concluded: boolean } }
    if (startIfNeeded && !data.state.started) {
      const started = await fetch('/api/simulation/team-welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, action: 'start' }) })
      if (started.ok) { const result = await started.json() as { state: { started: boolean; introduced: boolean; concluded: boolean } }; setWelcome(result.state); return }
    }
    setWelcome(data.state)
  }

  useEffect(() => {
    if (statePhase !== 'qualified') return
    void updateSchedule('check_deadlines')
    const timer = window.setInterval(() => { void updateSchedule('check_deadlines') }, 60_000)
    return () => window.clearInterval(timer)
  }, [statePhase])

  useEffect(() => { if (statePhase === 'qualified') void refreshWelcome(true) }, [statePhase])

  if (loading || !state) return <div className="page onboarding-page"><div className="onboarding-loading"><Clock3 size={18} /> Loading organizational onboarding...</div></div>
  if (state.phase === 'not_started') return <StartView state={state} submit={submit} />
  if (quizReview) return <QuizAnswerReview review={quizReview} continueLearning={() => { setQuizReview(null); setFeedback('') }} state={state} />
  if (readinessResult) return <ReadinessResultView state={state} evaluation={readinessResult} retry={() => { setReadinessResult(null); void submit({ action: 'resume_readiness' }) }} openProject={openProject} />
  if (state.phase === 'profile') return <ProfileView state={state} submit={submit} />
  if (state.phase === 'policy') return <PolicyView state={state} submit={submit} />
  if (state.phase === 'access') return <AccessView state={state} submit={submit} />
  if (state.phase === 'training' && slide) return <TrainingSession state={state} slide={slide} slides={slides} answer={answer} setAnswer={setAnswer} submit={submit} feedback={feedback} />
  if (state.phase === 'remediation') return <RemediationView state={state} submit={submit} />
  if (state.phase === 'demo_task') return <ReadinessView state={state} questions={readinessQuestions} answers={readinessAnswers} setAnswers={setReadinessAnswers} submit={submit} feedback={feedback} />
  return <QualifiedView state={state} openProject={openProject} updateSchedule={updateSchedule} feedback={feedback} welcome={welcome} />
}
