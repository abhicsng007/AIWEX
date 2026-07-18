import type { SimulationEvent } from './types'

export type TrainingPhase = 'company' | 'security' | 'technology' | 'project' | 'delivery'
export type TrainingResource = { label: string; href: string; description: string }
export type TrainingSlide = {
  id: string
  phase: TrainingPhase
  section: string
  title: string
  body: string
  highlights: string[]
  resources?: TrainingResource[]
  question: string
  options: string[]
  correctOption: number
}

export type EmployeeProfile = {
  employeeId: string
  name: string
  role: string
  department: string
  location: string
  manager: string
  buddy: string
  startDate: string
  cohort: string
  employmentType: string
}

export type PolicyRequirement = {
  id: string
  title: string
  owner: string
  due: string
  description: string
  evidence: string
}

export type AccessItem = {
  id: string
  system: string
  owner: string
  purpose: string
  status: 'pending' | 'granted'
  requiredForProject: boolean
}

export type ManagerReview = {
  reviewer: string
  status: 'pending' | 'approved'
  summary: string
}

export const employeeProfile: EmployeeProfile = {
  employeeId: 'EMP-SD-2048',
  name: 'Alex Morgan',
  role: 'Full-stack Engineer',
  department: 'Product Engineering',
  location: 'Remote - APAC',
  manager: 'Marcus Reed',
  buddy: 'Devon Reeves',
  startDate: '2026-07-22',
  cohort: 'Engineering onboarding cohort 27',
  employmentType: 'Contract-to-hire simulation',
}

export const policyRequirements: PolicyRequirement[] = [
  {
    id: 'security-baseline',
    title: 'Security and acceptable use',
    owner: 'Security Operations',
    due: 'Day 1',
    description: 'Confirm MFA, secret-handling, workstation hygiene, and approved-tool expectations before accessing project systems.',
    evidence: 'Policy acknowledgement and security baseline recorded.',
  },
  {
    id: 'data-protection',
    title: 'Customer data protection',
    owner: 'Legal and Privacy',
    due: 'Day 1',
    description: 'Acknowledge that customer screenshots, credentials, private conversations, and production data stay inside approved systems.',
    evidence: 'Privacy attestation recorded for the learner profile.',
  },
  {
    id: 'engineering-operating-model',
    title: 'Engineering operating model',
    owner: 'Engineering Enablement',
    due: 'Day 2',
    description: 'Confirm expectations for written decisions, escalation, review evidence, incident awareness, and release discipline.',
    evidence: 'Operating model acknowledgement attached to onboarding record.',
  },
]

export const accessCatalog: Omit<AccessItem, 'status'>[] = [
  { id: 'workspace', system: 'SignalDesk workspace', owner: 'People Ops', purpose: 'Employee profile, onboarding record, and private coaching area.', requiredForProject: true },
  { id: 'scenario-repo', system: 'Scenario repository', owner: 'Engineering Enablement', purpose: 'Disposable codebase for role-readiness delivery work.', requiredForProject: true },
  { id: 'team-space', system: 'Team spaces', owner: 'Product Engineering', purpose: 'Async team communication, handoffs, and escalation trail.', requiredForProject: true },
  { id: 'staging', system: 'Staging environment', owner: 'Platform Operations', purpose: 'Validation target for safe implementation checks.', requiredForProject: true },
  { id: 'docs', system: 'Internal knowledge base', owner: 'Operations', purpose: 'Architecture, runbooks, security standards, and product context.', requiredForProject: true },
]

export const trainingPhases: { id: TrainingPhase; label: string; description: string }[] = [
  { id: 'company', label: '01 Company', description: 'Mission, operating principles, and team expectations.' },
  { id: 'security', label: '02 Risk', description: 'Security, privacy, and customer data handling.' },
  { id: 'technology', label: '03 Engineering', description: 'Stack, boundaries, and technical standards.' },
  { id: 'project', label: '04 Product', description: 'SignalDesk customer context and current initiative.' },
  { id: 'delivery', label: '05 Delivery', description: 'Review, validation, communication, and release readiness.' },
]

export const trainingSlides: TrainingSlide[] = [
  {
    id: 'company-mandate',
    phase: 'company',
    section: 'Company orientation',
    title: 'SignalDesk operating mandate',
    body: 'SignalDesk helps revenue and operations teams understand product usage before customers are surprised by limits, billing changes, or broken workflows. Engineers are expected to protect customer trust, make assumptions visible, and connect every change to a customer outcome.',
    highlights: ['Customer trust is a product requirement, not a final review step.', 'Decisions belong in durable systems: issues, pull requests, and team spaces.', 'Escalation is expected when scope, evidence, risk, or timing changes.'],
    question: 'Which outcome should guide an unclear implementation trade-off?',
    options: ['Ship the largest visible change', 'Create a trustworthy customer decision surface', 'Mirror a competitor without validating fit'],
    correctOption: 1,
  },
  {
    id: 'security-privacy',
    phase: 'security',
    section: 'Risk and compliance',
    title: 'Customer data and secrets handling',
    body: 'The simulator represents a professional organization. Credentials, customer data, private conversations, and production screenshots must never be pasted into unapproved places. Privileged operations stay server-side, and every protected action needs an enforceable boundary.',
    highlights: ['Never expose service-role credentials to browser code.', 'Treat API responses, route input, and form data as untrusted until validated.', 'Use synthetic or approved scenario data for learning and testing.'],
    resources: [{ label: 'Supabase auth overview', href: 'https://supabase.com/docs/guides/auth', description: 'Authentication concepts and boundary design.' }],
    question: 'Where should privileged service-role credentials live?',
    options: ['In a client component for convenience', 'Only in server-side environment and route handler code', 'In a teammate message during debugging'],
    correctOption: 1,
  },
  {
    id: 'next-contracts',
    phase: 'technology',
    section: 'Engineering standards',
    title: 'Next.js, React, and typed contracts',
    body: 'SignalDesk uses Next.js route handlers for server contracts and React for product interaction. Browser components own transient UI state; server routes validate input, enforce permission, and preserve event history.',
    highlights: ['Route handlers are the boundary for request validation and protected writes.', 'UI hiding is not authorization; enforce permission at the action boundary.', 'Model nullable legacy values honestly instead of hiding them with casts.'],
    resources: [{ label: 'Next.js App Router', href: 'https://nextjs.org/docs/app', description: 'Official routing and rendering reference.' }, { label: 'TypeScript handbook', href: 'https://www.typescriptlang.org/docs/', description: 'Types, narrowing, and contract design.' }],
    question: 'Where must an authorization rule for a protected action be enforced?',
    options: ['Only by hiding the button', 'At the server boundary that performs the action', 'In a team reminder after release'],
    correctOption: 1,
  },
  {
    id: 'product-legacy-context',
    phase: 'project',
    section: 'Product and project context',
    title: 'Usage alerts and legacy workspace states',
    body: 'The current initiative improves usage-alerts for workspaces with incomplete legacy configuration. The customer still needs a helpful empty state when no threshold exists, and restricted roles must not receive billing-management actions.',
    highlights: ['Usage signals are evidence for a human decision, not an absolute verdict.', 'Legacy workspaces are real production states that deserve first-class handling.', 'The billing action must be protected by canManageBilling and not only by visual presentation.'],
    question: 'What must remain available for a legacy workspace with no usage threshold?',
    options: ['An explanatory empty state', 'A billing-management action for every role', 'A blank page until migration finishes'],
    correctOption: 0,
  },
  {
    id: 'delivery-readiness',
    phase: 'delivery',
    section: 'Delivery readiness',
    title: 'Evidence expected before project access',
    body: 'Before entering the main project, you need to show implementation judgment, security awareness, validation planning, and communication discipline. The readiness task is a workplace gate: it checks whether you can explain a safe change before you make it.',
    highlights: ['Name the permission guard, preserved legacy behavior, and focused validation.', 'Explain where the rule is enforced, not only what the UI looks like.', 'Record risk and review evidence so the next teammate can follow the decision.'],
    question: 'What evidence must your readiness plan include?',
    options: ['Only the file name to edit', 'Permission guard, legacy behavior, validation, and communication plan', 'A promise to ask someone else later'],
    correctOption: 1,
  },
]

const quizRationales: Record<string, string> = {
  'company-mandate': 'SignalDesk measures success by whether customers can make a trustworthy next decision, not by raw output volume.',
  'security-privacy': 'Service-role credentials are privileged and must remain server-side behind protected routes.',
  'next-contracts': 'Authorization must be enforced where the protected action runs. Hiding a control does not stop direct requests.',
  'product-legacy-context': 'Legacy workspaces still need useful guidance, so the empty state remains a supported product state.',
  'delivery-readiness': 'The readiness gate checks implementation safety, preserved behavior, validation proof, and communication quality.',
}

export function quizAnswerFeedback(slide: TrainingSlide, correct: boolean) {
  const correctAnswer = slide.options[slide.correctOption]
  return `${correct ? 'Correct.' : `Not quite. The correct answer is: "${correctAnswer}".`} ${quizRationales[slide.id] || 'This is the expected response based on the module content.'}`
}

export type OnboardingPhase = 'not_started' | 'profile' | 'policy' | 'access' | 'training' | 'remediation' | 'demo_task' | 'qualified'
export type ScheduleItem = { id: string; title: string; startsAt: string; endsAt: string; kind: 'ceremony' | 'focus' | 'deadline'; completed: boolean; missed: boolean; extensionRequested: boolean; extensionDecision?: 'pending' | 'approved' | 'declined' }
export type ReadinessEvaluation = { score: number; passed: boolean; feedback: string; criteria: { label: string; met: boolean; evidence: string }[] }
export type OnboardingState = {
  phase: OnboardingPhase
  profile: EmployeeProfile
  profileConfirmed: boolean
  acknowledgedPolicyIds: string[]
  policies: (PolicyRequirement & { acknowledged: boolean })[]
  access: AccessItem[]
  completedSlideIds: string[]
  currentSlide: TrainingSlide | null
  quizScore: number
  readinessAttempts: number
  readinessFeedback: string | null
  readinessEvaluation: ReadinessEvaluation | null
  managerReview: ManagerReview
  schedule: ScheduleItem[]
  missedDeadlines: number
  penalties: number
}
export type PublicOnboardingState = Omit<OnboardingState, 'currentSlide'> & { currentSlide: Omit<TrainingSlide, 'correctOption'> | null }

const eventOf = (events: SimulationEvent[], type: SimulationEvent['type']) => events.filter((event) => event.type === type)
const eventMetadata = (events: SimulationEvent[], type: SimulationEvent['type']) => eventOf(events, type).map((event) => event.metadata || {})
const idsFor = (events: SimulationEvent[], type: SimulationEvent['type'], key: string) => [...new Set(eventMetadata(events, type).map((metadata) => String(metadata[key] || '')).filter(Boolean))]

function scheduleStart(events: SimulationEvent[]) {
  const created = eventOf(events, 'schedule_created').at(-1)
  return created?.metadata?.startAt ? String(created.metadata.startAt) : null
}

export function scheduleFromEvents(events: SimulationEvent[]): ScheduleItem[] {
  const startAt = scheduleStart(events)
  if (!startAt) return []
  const base = Date.parse(startAt)
  if (!Number.isFinite(base)) return []
  const completed = new Set(eventMetadata(events, 'schedule_event_completed').map((metadata) => String(metadata.scheduleId || '')))
  const missed = new Set(eventMetadata(events, 'deadline_missed').map((metadata) => String(metadata.scheduleId || '')))
  const extensions = new Set(eventMetadata(events, 'deadline_extension_requested').map((metadata) => String(metadata.scheduleId || '')))
  const decisions = new Map(eventMetadata(events, 'deadline_extension_decided').map((metadata) => [String(metadata.scheduleId || ''), metadata]))
  const item = (id: string, title: string, hours: number, durationHours: number, kind: ScheduleItem['kind']): ScheduleItem => {
    const decision = decisions.get(id)
    const approved = decision?.decision === 'approved'
    const declined = decision?.decision === 'declined'
    const overriddenEnd = typeof decision?.endsAt === 'string' && Number.isFinite(Date.parse(decision.endsAt)) ? decision.endsAt : null
    return { id, title, startsAt: new Date(base + hours * 3_600_000).toISOString(), endsAt: overriddenEnd || new Date(base + (hours + durationHours) * 3_600_000).toISOString(), kind, completed: completed.has(id), missed: missed.has(id), extensionRequested: extensions.has(id), extensionDecision: extensions.has(id) ? approved ? 'approved' : declined ? 'declined' : 'pending' : undefined }
  }
  return [
    item('manager-checkin-day-1', 'Manager check-in and working agreement', 0, .5, 'ceremony'),
    item('focus-proj-184', 'Focus block - PROJ-184', 1, 3, 'focus'),
    item('review-window', 'Review window - PR #482', 5, 1, 'ceremony'),
    item('deadline-proj-184', 'Deadline - PROJ-184 implementation plan', 8, .25, 'deadline'),
    item('standup-day-2', 'Day 2 async stand-up', 24, .25, 'ceremony'),
    item('deadline-proj-191', 'Deadline - PROJ-191 assessment', 32, .25, 'deadline'),
    item('release-check', 'Release readiness check', 48, 1, 'ceremony'),
    item('deadline-release-note', 'Deadline - rollout note', 56, .25, 'deadline'),
    item('retro-day-3', 'Sprint retro and next-task planning', 57, 1, 'ceremony'),
  ]
}

export function deriveOnboardingState(events: SimulationEvent[]): OnboardingState {
  const profileConfirmed = eventOf(events, 'onboarding_profile_confirmed').length > 0
  const acknowledgedPolicyIds = idsFor(events, 'policy_acknowledged', 'policyId')
  const provisionedAccessIds = idsFor(events, 'access_provisioned', 'accessId')
  const completedSlideIds = idsFor(events, 'training_slide_completed', 'slideId')
  const qualified = eventOf(events, 'readiness_task_passed').length > 0
  const allPoliciesComplete = policyRequirements.every((policy) => acknowledgedPolicyIds.includes(policy.id))
  const allRequiredAccessGranted = accessCatalog.filter((item) => item.requiredForProject).every((item) => provisionedAccessIds.includes(item.id))
  const allSlidesComplete = trainingSlides.every((slide) => completedSlideIds.includes(slide.id))
  const attempts = eventOf(events, 'readiness_task_started').length
  const retries = eventMetadata(events, 'readiness_task_retry_required')
  const latestRetry = retries.at(-1)
  const quizAttempts = eventOf(events, 'quiz_attempted').length
  const quizPasses = eventOf(events, 'quiz_passed').length
  const missedDeadlines = eventOf(events, 'deadline_missed').length
  const penalties = eventOf(events, 'reliability_penalty_applied').length
  const remediationRequired = retries.length > eventOf(events, 'readiness_training_resumed').length
  const managerApproved = eventOf(events, 'manager_signoff_recorded').length > 0
  const phase: OnboardingPhase = qualified
    ? 'qualified'
    : !eventOf(events, 'onboarding_started').length
      ? 'not_started'
      : !profileConfirmed
        ? 'profile'
        : !allPoliciesComplete
          ? 'policy'
          : !allRequiredAccessGranted
            ? 'access'
            : !allSlidesComplete
              ? 'training'
              : remediationRequired
                ? 'remediation'
                : 'demo_task'

  return {
    phase,
    profile: employeeProfile,
    profileConfirmed,
    acknowledgedPolicyIds,
    policies: policyRequirements.map((policy) => ({ ...policy, acknowledged: acknowledgedPolicyIds.includes(policy.id) })),
    access: accessCatalog.map((item) => ({ ...item, status: provisionedAccessIds.includes(item.id) ? 'granted' : 'pending' })),
    completedSlideIds,
    currentSlide: trainingSlides.find((slide) => !completedSlideIds.includes(slide.id)) || null,
    quizScore: quizAttempts ? Math.round((quizPasses / quizAttempts) * 100) : 0,
    readinessAttempts: attempts,
    readinessFeedback: typeof latestRetry?.feedback === 'string' ? latestRetry.feedback : null,
    readinessEvaluation: null,
    managerReview: {
      reviewer: employeeProfile.manager,
      status: managerApproved ? 'approved' : 'pending',
      summary: managerApproved ? 'Role-readiness evidence accepted. Project calendar and team access are active.' : 'Manager signoff is recorded automatically after readiness evidence passes.',
    },
    schedule: scheduleFromEvents(events),
    missedDeadlines,
    penalties,
  }
}

export function publicOnboardingState(state: OnboardingState): PublicOnboardingState {
  const { currentSlide, ...rest } = state
  if (!currentSlide) return { ...rest, currentSlide: null }
  const { correctOption, ...safeSlide } = currentSlide
  return { ...rest, currentSlide: safeSlide }
}

export function evaluateReadinessSubmission(submission: string): ReadinessEvaluation {
  const normalized = submission.toLowerCase()
  const criteria = [
    {
      label: 'Permission boundary',
      met: /canmanagebilling|can manage billing|billing guard/.test(normalized) && /(server|route|api|handler|boundary)/.test(normalized),
      evidence: 'Names canManageBilling and explains where the protected action is enforced.',
    },
    {
      label: 'Legacy customer state',
      met: /(legacy|older workspace|existing workspace|empty state|usage threshold|threshold)/.test(normalized),
      evidence: 'Preserves the empty state or threshold context for legacy workspaces.',
    },
    {
      label: 'Security and data handling',
      met: /(customer data|credential|secret|privacy|service-role|service role|authorization|permission)/.test(normalized),
      evidence: 'Shows awareness of protected data, credentials, or authorization risk.',
    },
    {
      label: 'Validation evidence',
      met: /(test|check|validat|regression|role coverage|restricted role|allowed role)/.test(normalized),
      evidence: 'States focused validation for allowed and restricted role behavior.',
    },
    {
      label: 'Communication and delivery',
      met: submission.trim().length >= 160 && /(pr|pull request|review|risk|handoff|acceptance criteria|release)/.test(normalized),
      evidence: 'Explains review communication, risk, handoff, or acceptance evidence.',
    },
  ]
  const score = criteria.filter((criterion) => criterion.met).length * 20
  const missing = criteria.filter((criterion) => !criterion.met).map((criterion) => criterion.label)
  return {
    score,
    passed: score >= 80,
    criteria,
    feedback: missing.length ? `Readiness score: ${score}/100. Strengthen: ${missing.join(', ')}.` : `Readiness score: ${score}/100. Your evidence covers permission safety, legacy behavior, security, validation, and delivery communication.`,
  }
}

export function readinessSubmissionError(submission: string) {
  const evaluation = evaluateReadinessSubmission(submission)
  return evaluation.passed ? null : evaluation.feedback
}

export function simulationNow(events: SimulationEvent[], actualNow = new Date()) {
  const created = eventOf(events, 'schedule_created').at(-1)
  if (!created) return actualNow
  const base = Date.parse(String(created.metadata?.startAt || created.createdAt))
  const advancedMinutes = eventMetadata(events, 'simulation_time_advanced').reduce((total, metadata) => total + Math.max(0, Number(metadata.minutes) || 0), 0)
  return new Date(Math.max(actualNow.getTime(), base + advancedMinutes * 60_000))
}

export function nextScheduleStart(now = new Date()) {
  const start = new Date(now)
  start.setSeconds(0, 0)
  return start.toISOString()
}

export function projectAccessError(events: SimulationEvent[], type: SimulationEvent['type']) {
  const onboarding = deriveOnboardingState(events)
  const projectActions: SimulationEvent['type'][] = ['standup_posted', 'checks_passed', 'commit_created', 'pull_request_opened', 'review_addressed', 'review_reply', 'approval_granted', 'merge_rationale_recorded', 'pull_request_merged', 'task_completed', 'load_test_recorded', 'workspace_revision_saved', 'chat_message', 'chat_message_edited', 'chat_message_deleted', 'message_pinned', 'message_marked_decision', 'message_marked_risk', 'message_marked_question', 'message_marked_handoff', 'message_marked_blocker', 'thread_resolved', 'followup_created', 'followup_completed', 'space_archived', 'space_member_added', 'space_member_removed', 'team_space_created', 'team_space_updated']
  return projectActions.includes(type) && onboarding.phase !== 'qualified' ? 'Complete organizational onboarding, required access, and manager-approved readiness before working on the main project.' : null
}
