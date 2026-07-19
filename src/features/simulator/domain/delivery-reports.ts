import { scenarioLevelFromEvents, taskIdsForScenarioLevel, type ScenarioLevel } from './difficulty'
import { issuesForScenarioLevel } from './difficulty'
import type { SimulationEvent } from './types'

export type RecruiterSignalStatus = 'verified' | 'partial' | 'needs_evidence'

export type RecruiterSignal = {
  id: 'validated_delivery' | 'review_collaboration' | 'written_communication' | 'ownership_reliability' | 'evidence_integrity'
  label: string
  status: RecruiterSignalStatus
  claim: string
  finding: string
  eventIds: string[]
}

export type DeliveryReportTimelineItem = {
  label: string
  at: string
  eventId: string
}

export type DeliveryReport = {
  id: string
  kind: 'task' | 'project'
  taskId?: string
  taskTitle: string
  scenarioLevel: ScenarioLevel | 'project'
  createdAt: string
  outcome: 'completed' | 'project_completed'
  summary: string
  strengths: string[]
  growthArea?: string
  recruiterSignals: RecruiterSignal[]
  timeline: DeliveryReportTimelineItem[]
}

const workflowEventTypes = new Set([
  'standup_posted', 'checks_passed', 'commit_created', 'pull_request_opened', 'review_addressed',
  'review_reply', 'approval_granted', 'merge_rationale_recorded', 'pull_request_merged', 'task_completed',
])

const timelineLabels: Partial<Record<SimulationEvent['type'], string>> = {
  standup_posted: 'Posted a stand-up plan',
  checks_passed: 'Passed server-verified scenario checks',
  commit_created: 'Created a commit after checks',
  pull_request_opened: 'Opened a pull request',
  review_addressed: 'Addressed reviewer feedback',
  review_reply: 'Explained the review response',
  approval_granted: 'Received reviewer approval',
  merge_rationale_recorded: 'Recorded merge rationale',
  pull_request_merged: 'Merged the pull request',
  task_completed: 'Completed the delivery task',
  deadline_missed: 'Missed a simulated deadline',
  deadline_extension_requested: 'Requested recovery time',
  followup_completed: 'Closed an accountability follow-up',
}

function eventIds(events: SimulationEvent[]) {
  return events.map((event) => event.id)
}

function eventsForCycle(events: SimulationEvent[], taskId: string, level: ScenarioLevel) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type === 'delivery_cycle_started' && event.metadata?.taskId === taskId && event.metadata?.level === level) return events.slice(index + 1)
    if (event.type === 'scenario_level_selected' && event.metadata?.level === level) return events.slice(index + 1)
  }
  return events
}

function taskTitle(taskId: string, level: ScenarioLevel) {
  return issuesForScenarioLevel(level).find((issue) => issue.id === taskId)?.title || taskId
}

function eventByType(events: SimulationEvent[], type: SimulationEvent['type']) {
  return events.filter((event) => event.type === type)
}

function contextualMessages(events: SimulationEvent[]) {
  const meaningful = /(risk|test|validat|because|scope|trade.?off|customer|blocked|api|rollback|assumption)/i
  return events.filter((event) => event.type === 'chat_message' && typeof event.metadata?.message === 'string' && meaningful.test(event.metadata.message))
}

function signalsForCycle(events: SimulationEvent[]): RecruiterSignal[] {
  const checks = eventByType(events, 'checks_passed')
  const commit = eventByType(events, 'commit_created')
  const pullRequest = eventByType(events, 'pull_request_opened')
  const merged = eventByType(events, 'pull_request_merged')
  const reviewed = eventByType(events, 'review_addressed')
  const reviewReply = eventByType(events, 'review_reply')
  const approval = eventByType(events, 'approval_granted')
  const standup = eventByType(events, 'standup_posted')
  const messages = contextualMessages(events)
  const missed = eventByType(events, 'deadline_missed')
  const recovery = [...eventByType(events, 'deadline_extension_requested'), ...eventByType(events, 'followup_completed')]
  const verifiedDelivery = [...checks, ...commit, ...pullRequest, ...merged]
  const reviewEvidence = [...reviewed, ...reviewReply, ...approval, ...merged]
  const communicationEvidence = [...standup, ...messages]
  const reliabilityEvidence = [...missed, ...recovery]

  return [
    {
      id: 'validated_delivery', label: 'Validated delivery',
      status: checks.length && commit.length && pullRequest.length && merged.length ? 'verified' : verifiedDelivery.length ? 'partial' : 'needs_evidence',
      claim: '“I shipped a change safely.”',
      finding: checks.length && commit.length && pullRequest.length && merged.length
        ? 'The change has an evidence trail from server-verified checks through commit, PR, and merge.'
        : 'Some delivery steps were recorded, but the full checks-to-merge trail is incomplete.',
      eventIds: eventIds(verifiedDelivery),
    },
    {
      id: 'review_collaboration', label: 'Review collaboration',
      status: reviewed.length && reviewReply.length && approval.length && merged.length ? 'verified' : reviewEvidence.length ? 'partial' : 'needs_evidence',
      claim: '“I worked productively through code review.”',
      finding: reviewed.length && reviewReply.length && approval.length && merged.length
        ? 'Feedback was addressed, explained in writing, approved, and carried through to merge.'
        : 'The review process has evidence, but one or more response, approval, or merge steps are absent.',
      eventIds: eventIds(reviewEvidence),
    },
    {
      id: 'written_communication', label: 'Written communication',
      status: standup.length && messages.length ? 'verified' : communicationEvidence.length ? 'partial' : 'needs_evidence',
      claim: '“I made plans, risks, and decisions visible to teammates.”',
      finding: standup.length && messages.length
        ? 'A stand-up and context-rich team update make the working plan visible in the ledger.'
        : 'Add a stand-up and a specific message about validation, risk, scope, or an assumption to strengthen this signal.',
      eventIds: eventIds(communicationEvidence),
    },
    {
      id: 'ownership_reliability', label: 'Ownership and reliability',
      status: missed.length === 0 ? 'verified' : recovery.length ? 'partial' : 'needs_evidence',
      claim: '“I owned commitments and surfaced delivery risk.”',
      finding: missed.length === 0
        ? 'No missed simulated deadline was recorded during this delivery cycle.'
        : recovery.length ? 'A missed deadline was recorded together with a recovery action.' : 'A missed deadline was recorded without a recovery action yet.',
      eventIds: eventIds(reliabilityEvidence),
    },
    {
      id: 'evidence_integrity', label: 'Evidence integrity',
      status: verifiedDelivery.length ? 'verified' : 'needs_evidence',
      claim: '“I can show how I worked, not only describe it.”',
      finding: verifiedDelivery.length
        ? 'This card is a timestamped snapshot of route-recorded simulation events, not a self-written achievement statement.'
        : 'Complete a workflow action so the report has recorded evidence to reference.',
      eventIds: eventIds(verifiedDelivery),
    },
  ]
}

function timelineFor(events: SimulationEvent[]) {
  return events
    .filter((event) => workflowEventTypes.has(event.type) || Boolean(timelineLabels[event.type]))
    .map((event) => ({ label: timelineLabels[event.type] || event.type.replace(/_/g, ' '), at: event.createdAt, eventId: event.id }))
    .slice(-12)
}

export function createTaskDeliveryReport(events: SimulationEvent[], input: { taskId: string; level: ScenarioLevel; createdAt: string; id: string }): DeliveryReport {
  const cycleEvents = eventsForCycle(events, input.taskId, input.level)
  const signals = signalsForCycle(cycleEvents)
  const verified = signals.filter((signal) => signal.status === 'verified').map((signal) => signal.label)
  const growth = signals.find((signal) => signal.status !== 'verified')
  return {
    id: input.id,
    kind: 'task',
    taskId: input.taskId,
    taskTitle: taskTitle(input.taskId, input.level),
    scenarioLevel: input.level,
    createdAt: input.createdAt,
    outcome: 'completed',
    summary: `Completed ${input.taskId} with ${verified.length} of ${signals.length} recruiter-relevant signals verified from the simulation ledger.`,
    strengths: verified.length ? verified : ['The delivery gate was completed and the report captured the available evidence.'],
    growthArea: growth ? `${growth.label}: ${growth.finding}` : undefined,
    recruiterSignals: signals,
    timeline: timelineFor(cycleEvents),
  }
}

function allProjectTasksComplete(events: SimulationEvent[]) {
  const completed = new Set(events.filter((event) => event.type === 'task_completed').map((event) => String(event.metadata?.issueId || '')))
  return Object.values(taskIdsForScenarioLevel).flat().every((id) => completed.has(id))
}

export function createProjectDeliveryReport(events: SimulationEvent[], input: { createdAt: string; id: string }): DeliveryReport | null {
  if (!allProjectTasksComplete(events)) return null
  const signals = signalsForCycle(events)
  const verified = signals.filter((signal) => signal.status === 'verified').map((signal) => signal.label)
  const growth = signals.find((signal) => signal.status !== 'verified')
  return {
    id: input.id,
    kind: 'project',
    taskTitle: 'SignalDesk project',
    scenarioLevel: 'project',
    createdAt: input.createdAt,
    outcome: 'project_completed',
    summary: `Final evidence report for all ${Object.values(taskIdsForScenarioLevel).flat().length} delivery tasks across Basic, Intermediate, and Advanced scenarios.`,
    strengths: verified.length ? verified : ['All planned delivery tasks were completed.'],
    growthArea: growth ? `${growth.label}: ${growth.finding}` : undefined,
    recruiterSignals: signals,
    timeline: timelineFor(events),
  }
}

function isReport(value: unknown): value is DeliveryReport {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DeliveryReport>
  return typeof candidate.id === 'string' && (candidate.kind === 'task' || candidate.kind === 'project') && Array.isArray(candidate.recruiterSignals) && Array.isArray(candidate.timeline)
}

export function deliveryReportsFromEvents(events: SimulationEvent[]): DeliveryReport[] {
  return events
    .filter((event) => event.type === 'task_report_created' || event.type === 'project_report_created')
    .map((event) => event.metadata?.report)
    .filter(isReport)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
}

export function currentScenarioLevel(events: SimulationEvent[]): ScenarioLevel {
  return scenarioLevelFromEvents(events)
}
