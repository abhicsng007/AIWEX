import { scenarioLevelFromEvents, taskIdsForScenarioLevel, type ScenarioLevel } from './difficulty'
import { issuesForScenarioLevel } from './difficulty'
import type { SimulationEvent } from './types'

export type RecruiterSignalStatus = 'verified' | 'partial' | 'needs_evidence'

export type RecruiterSignal = {
  id: 'validated_delivery' | 'review_collaboration' | 'written_communication' | 'ownership_reliability' | 'evidence_integrity'
  label: string
  status: RecruiterSignalStatus
  /** What the ledger shows, in concrete terms (not a resume claim). */
  finding: string
  /** Specific artifacts a reviewer can cite (quotes, IDs, hashes, metrics). */
  artifacts: string[]
  eventIds: string[]
}

export type DeliveryReportTimelineItem = {
  label: string
  detail?: string
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
  /** Concrete accomplishments tied to recorded events. */
  strengths: string[]
  growthArea?: string
  recruiterSignals: RecruiterSignal[]
  timeline: DeliveryReportTimelineItem[]
  /** Short bullets a recruiter can scan without narrative fluff. */
  evidenceHighlights: string[]
}

const workflowEventTypes = new Set([
  'standup_posted', 'checks_passed', 'commit_created', 'pull_request_opened', 'review_addressed',
  'review_reply', 'approval_granted', 'merge_rationale_recorded', 'pull_request_merged', 'task_completed',
  'chat_message', 'load_test_recorded', 'workspace_revision_saved',
])

function metaString(event: SimulationEvent | undefined, key: string) {
  const value = event?.metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function metaNumber(event: SimulationEvent | undefined, key: string) {
  const value = event?.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function clip(text: string, max = 160) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

function formatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
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

function lastOf(events: SimulationEvent[], type: SimulationEvent['type']) {
  return eventByType(events, type).at(-1)
}

function contextualMessages(events: SimulationEvent[]) {
  const meaningful = /(risk|test|validat|because|scope|trade.?off|customer|blocked|api|rollback|assumption|canManageBilling|legacy)/i
  return events.filter((event) => event.type === 'chat_message' && typeof event.metadata?.message === 'string' && meaningful.test(String(event.metadata.message)))
}

function timelineDetail(event: SimulationEvent): string | undefined {
  switch (event.type) {
    case 'standup_posted':
      return metaString(event, 'text') || metaString(event, 'message') || undefined
    case 'checks_passed': {
      const hash = metaString(event, 'sourceHash')
      const duration = metaNumber(event, 'durationMs')
      const parts = [
        event.metadata?.verified === true ? 'server-verified' : 'recorded',
        hash ? `source ${hash.slice(0, 12)}…` : '',
        duration !== undefined ? `${duration}ms` : '',
        metaString(event, 'command') ? `via ${metaString(event, 'command')}` : '',
      ].filter(Boolean)
      return parts.join(' · ') || undefined
    }
    case 'commit_created':
      return [
        metaString(event, 'message'),
        metaString(event, 'branch') ? `branch ${metaString(event, 'branch')}` : '',
      ].filter(Boolean).join(' · ') || undefined
    case 'pull_request_opened':
      return [
        metaString(event, 'title'),
        metaNumber(event, 'prNumber') !== undefined ? `PR #${metaNumber(event, 'prNumber')}` : '',
        metaString(event, 'branch') ? `from ${metaString(event, 'branch')}` : '',
      ].filter(Boolean).join(' · ') || undefined
    case 'review_addressed':
      return metaString(event, 'summary') || undefined
    case 'review_reply':
      return metaString(event, 'response') || undefined
    case 'approval_granted':
      return metaString(event, 'reviewer') ? `Reviewer: ${metaString(event, 'reviewer')}` : undefined
    case 'merge_rationale_recorded':
      return metaString(event, 'rationale') || undefined
    case 'pull_request_merged':
      return [
        metaString(event, 'issueId') ? `issue ${metaString(event, 'issueId')}` : '',
        metaNumber(event, 'prNumber') !== undefined ? `PR #${metaNumber(event, 'prNumber')}` : '',
        metaString(event, 'level') ? `${metaString(event, 'level')} scenario` : '',
      ].filter(Boolean).join(' · ') || undefined
    case 'chat_message':
      return [
        metaString(event, 'channelId') ? `#${metaString(event, 'channelId')}` : '',
        metaString(event, 'message'),
      ].filter(Boolean).join(' · ') || undefined
    case 'workspace_revision_saved':
      return metaString(event, 'path') || undefined
    case 'load_test_recorded':
      return [
        metaNumber(event, 'concurrency') !== undefined ? `${metaNumber(event, 'concurrency')} concurrent users` : '',
        metaNumber(event, 'p95Ms') !== undefined ? `p95 ${metaNumber(event, 'p95Ms')}ms` : '',
        metaNumber(event, 'errorRatePercent') !== undefined ? `${metaNumber(event, 'errorRatePercent')}% errors` : '',
        metaNumber(event, 'requestsPerSecond') !== undefined ? `${metaNumber(event, 'requestsPerSecond')} req/s` : '',
      ].filter(Boolean).join(' · ') || undefined
    case 'task_completed':
      return [
        metaString(event, 'issueId'),
        metaString(event, 'level') ? `${metaString(event, 'level')} level` : '',
      ].filter(Boolean).join(' · ') || undefined
    default:
      return undefined
  }
}

function timelineLabel(event: SimulationEvent) {
  const labels: Partial<Record<SimulationEvent['type'], string>> = {
    standup_posted: 'Stand-up posted',
    checks_passed: 'Scenario checks passed',
    commit_created: 'Commit created',
    pull_request_opened: 'Pull request opened',
    review_addressed: 'Review feedback addressed',
    review_reply: 'Written review response recorded',
    approval_granted: 'Reviewer approval recorded',
    merge_rationale_recorded: 'Merge rationale recorded',
    pull_request_merged: 'Pull request merged',
    task_completed: 'Task completion recorded',
    chat_message: 'Team-space message posted',
    workspace_revision_saved: 'Workspace revision saved',
    load_test_recorded: 'Load-test evidence recorded',
    deadline_missed: 'Simulated deadline missed',
    deadline_extension_requested: 'Recovery window requested',
    followup_completed: 'Follow-up closed',
  }
  return labels[event.type] || event.type.replace(/_/g, ' ')
}

function signalsForCycle(events: SimulationEvent[], context: { taskId?: string; level?: ScenarioLevel | 'project' }): RecruiterSignal[] {
  const checks = lastOf(events, 'checks_passed')
  const commit = lastOf(events, 'commit_created')
  const pullRequest = lastOf(events, 'pull_request_opened')
  const merged = lastOf(events, 'pull_request_merged')
  const reviewed = lastOf(events, 'review_addressed')
  const reviewReply = lastOf(events, 'review_reply')
  const approval = lastOf(events, 'approval_granted')
  const rationale = lastOf(events, 'merge_rationale_recorded')
  const standup = lastOf(events, 'standup_posted')
  const revision = lastOf(events, 'workspace_revision_saved')
  const messages = contextualMessages(events)
  const missed = eventByType(events, 'deadline_missed')
  const recovery = [...eventByType(events, 'deadline_extension_requested'), ...eventByType(events, 'followup_completed')]
  const loadTest = lastOf(events, 'load_test_recorded')
  const scope = context.taskId ? `${context.taskId}` : 'this project'

  const deliveryArtifacts = [
    checks ? `Checks: verified=${String(checks.metadata?.verified === true)}${metaString(checks, 'sourceHash') ? `, sourceHash=${metaString(checks, 'sourceHash').slice(0, 16)}…` : ''}${metaNumber(checks, 'durationMs') !== undefined ? `, duration=${metaNumber(checks, 'durationMs')}ms` : ''}` : '',
    revision ? `Workspace file: ${metaString(revision, 'path') || 'revision saved'}` : '',
    commit ? `Commit: ${clip(metaString(commit, 'message') || 'recorded', 120)}${metaString(commit, 'branch') ? ` on ${metaString(commit, 'branch')}` : ''}` : '',
    pullRequest ? `PR: ${clip(metaString(pullRequest, 'title') || scope, 120)}${metaNumber(pullRequest, 'prNumber') !== undefined ? ` (#${metaNumber(pullRequest, 'prNumber')})` : ''}` : '',
    merged ? `Merged at ${formatTime(merged.createdAt)}${metaString(merged, 'level') ? ` · ${metaString(merged, 'level')}` : ''}` : '',
  ].filter(Boolean)

  const reviewArtifacts = [
    reviewed ? `Addressed: ${clip(metaString(reviewed, 'summary') || 'review change marked addressed', 140)}` : '',
    reviewReply ? `Response: “${clip(metaString(reviewReply, 'response'), 180)}”` : '',
    approval ? `Approval by ${metaString(approval, 'reviewer') || 'required reviewer'} at ${formatTime(approval.createdAt)}` : '',
    rationale ? `Merge rationale: “${clip(metaString(rationale, 'rationale'), 180)}”` : '',
  ].filter(Boolean)

  const communicationArtifacts = [
    standup ? `Stand-up (${formatTime(standup.createdAt)}): “${clip(metaString(standup, 'text') || metaString(standup, 'message') || 'plan posted', 180)}”` : '',
    ...messages.slice(-3).map((message) => {
      const channel = metaString(message, 'channelId')
      return `Message${channel ? ` in #${channel}` : ''} (${formatTime(message.createdAt)}): “${clip(metaString(message, 'message'), 160)}”`
    }),
  ].filter(Boolean)

  const reliabilityArtifacts = [
    missed.length === 0 ? 'No deadline_missed events in this evidence window' : `${missed.length} deadline_missed event(s)`,
    ...recovery.map((event) => `${event.type} at ${formatTime(event.createdAt)}`),
    loadTest
      ? `Load test: concurrency=${metaNumber(loadTest, 'concurrency')}, p95=${metaNumber(loadTest, 'p95Ms')}ms, errors=${metaNumber(loadTest, 'errorRatePercent')}%, rps=${metaNumber(loadTest, 'requestsPerSecond')}`
      : '',
  ].filter(Boolean)

  const integrityArtifacts = [
    `Evidence window: ${events.length} ledger events`,
    `Workflow events present: ${events.filter((event) => workflowEventTypes.has(event.type)).length}`,
    context.taskId ? `Task id: ${context.taskId}` : 'Project-level aggregation across all tasks',
    context.level ? `Scenario level: ${context.level}` : '',
  ].filter(Boolean)

  const deliveryComplete = Boolean(checks && commit && pullRequest && merged)
  const reviewComplete = Boolean(reviewed && reviewReply && approval && merged)
  const communicationComplete = Boolean(standup && messages.length)

  return [
    {
      id: 'validated_delivery',
      label: 'Validated delivery trail',
      status: deliveryComplete ? 'verified' : (checks || commit || pullRequest || merged) ? 'partial' : 'needs_evidence',
      finding: deliveryComplete
        ? `For ${scope}, the ledger shows a closed path: server-verified checks → commit → pull request → merge${revision ? ', with a recorded workspace revision' : ''}.`
        : `For ${scope}, delivery evidence is incomplete. Missing: ${[
          !checks ? 'checks_passed' : '',
          !commit ? 'commit_created' : '',
          !pullRequest ? 'pull_request_opened' : '',
          !merged ? 'pull_request_merged' : '',
        ].filter(Boolean).join(', ') || 'delivery steps'}.`,
      artifacts: deliveryArtifacts,
      eventIds: eventIds([checks, commit, pullRequest, revision, merged].filter(Boolean) as SimulationEvent[]),
    },
    {
      id: 'review_collaboration',
      label: 'Code review collaboration',
      status: reviewComplete ? 'verified' : (reviewed || reviewReply || approval) ? 'partial' : 'needs_evidence',
      finding: reviewComplete
        ? `Review for ${scope} includes an addressed change, a written response, approval, and merge. A recruiter can inspect the exact response text and rationale in the linked events.`
        : `Review collaboration for ${scope} is only partially recorded. Missing: ${[
          !reviewed ? 'review_addressed' : '',
          !reviewReply ? 'review_reply' : '',
          !approval ? 'approval_granted' : '',
          !merged ? 'pull_request_merged' : '',
        ].filter(Boolean).join(', ') || 'review steps'}.`,
      artifacts: reviewArtifacts,
      eventIds: eventIds([reviewed, reviewReply, approval, rationale, merged].filter(Boolean) as SimulationEvent[]),
    },
    {
      id: 'written_communication',
      label: 'Written team communication',
      status: communicationComplete ? 'verified' : (standup || messages.length) ? 'partial' : 'needs_evidence',
      finding: communicationComplete
        ? `A stand-up and ${messages.length} context-rich team message${messages.length === 1 ? '' : 's'} were recorded with validation/risk/scope language a teammate could act on.`
        : standup
          ? 'A stand-up is recorded, but no context-rich teammate message (risk, validation, scope, or assumption) was found in this window.'
          : messages.length
            ? 'Context-rich messages exist, but no stand-up plan was recorded in this window.'
            : 'No stand-up or context-rich chat evidence was recorded in this window.',
      artifacts: communicationArtifacts,
      eventIds: eventIds([standup, ...messages].filter(Boolean) as SimulationEvent[]),
    },
    {
      id: 'ownership_reliability',
      label: 'Ownership & deadline reliability',
      status: missed.length === 0 ? 'verified' : recovery.length ? 'partial' : 'needs_evidence',
      finding: missed.length === 0
        ? `No missed-deadline events appear in this evidence window for ${scope}.`
        : recovery.length
          ? `${missed.length} missed deadline event(s) were recorded, and recovery actions were also recorded.`
          : `${missed.length} missed deadline event(s) were recorded without a recovery action in this window.`,
      artifacts: reliabilityArtifacts,
      eventIds: eventIds([...missed, ...recovery, ...(loadTest ? [loadTest] : [])]),
    },
    {
      id: 'evidence_integrity',
      label: 'Auditability of the work trail',
      status: deliveryComplete || reviewComplete ? 'verified' : events.some((event) => workflowEventTypes.has(event.type)) ? 'partial' : 'needs_evidence',
      finding: 'Every bullet below is taken from append-only simulation events (ids, timestamps, and metadata), not from free-form self-description.',
      artifacts: integrityArtifacts,
      eventIds: eventIds(events.filter((event) => workflowEventTypes.has(event.type)).slice(-8)),
    },
  ]
}

function timelineFor(events: SimulationEvent[]) {
  return events
    .filter((event) => workflowEventTypes.has(event.type) || event.type.startsWith('deadline_') || event.type === 'followup_completed')
    .map((event) => ({
      label: timelineLabel(event),
      detail: (() => {
        const detail = timelineDetail(event)
        return detail ? clip(detail, 220) : undefined
      })(),
      at: event.createdAt,
      eventId: event.id,
    }))
    .slice(-16)
}

function strengthsFromSignals(signals: RecruiterSignal[], events: SimulationEvent[], taskId?: string) {
  const strengths: string[] = []
  const checks = lastOf(events, 'checks_passed')
  const commit = lastOf(events, 'commit_created')
  const pr = lastOf(events, 'pull_request_opened')
  const reply = lastOf(events, 'review_reply')
  const rationale = lastOf(events, 'merge_rationale_recorded')
  const merge = lastOf(events, 'pull_request_merged')
  const standup = lastOf(events, 'standup_posted')

  if (checks) strengths.push(`Server-verified scenario checks passed${metaString(checks, 'sourceHash') ? ` (source ${metaString(checks, 'sourceHash').slice(0, 12)}…)` : ''}.`)
  if (commit) strengths.push(`Commit recorded${metaString(commit, 'message') ? `: “${clip(metaString(commit, 'message'), 100)}”` : ''}${metaString(commit, 'branch') ? ` on ${metaString(commit, 'branch')}` : ''}.`)
  if (pr) strengths.push(`Pull request opened${metaString(pr, 'title') ? `: “${clip(metaString(pr, 'title'), 100)}”` : ''}${metaNumber(pr, 'prNumber') !== undefined ? ` (#${metaNumber(pr, 'prNumber')})` : ''}.`)
  if (reply) strengths.push(`Review response captured with validation detail: “${clip(metaString(reply, 'response'), 110)}”.`)
  if (rationale && merge) strengths.push(`Merge rationale and merge event recorded for ${taskId || 'the task'}.`)
  if (standup) strengths.push(`Async stand-up made the plan visible before implementation.`)
  if (!strengths.length) {
    const verified = signals.filter((signal) => signal.status === 'verified').map((signal) => signal.label)
    return verified.length ? verified : ['Delivery gate events were recorded for this snapshot.']
  }
  return strengths
}

function evidenceHighlights(events: SimulationEvent[], taskId?: string, level?: ScenarioLevel | 'project') {
  const highlights: string[] = []
  const issue = taskId && level && level !== 'project' ? issuesForScenarioLevel(level).find((item) => item.id === taskId) : undefined
  if (taskId) highlights.push(`Task: ${taskId}${issue ? ` — ${issue.title}` : ''}`)
  if (level) highlights.push(`Scenario level: ${level}`)
  const checks = lastOf(events, 'checks_passed')
  if (checks?.metadata?.verified === true) highlights.push('Checks: verified=true on server boundary')
  const commit = lastOf(events, 'commit_created')
  if (commit) highlights.push(`Commit branch: ${metaString(commit, 'branch') || 'recorded'}`)
  const pr = lastOf(events, 'pull_request_opened')
  if (pr) highlights.push(`PR title: ${clip(metaString(pr, 'title') || 'opened', 90)}`)
  const approval = lastOf(events, 'approval_granted')
  if (approval) highlights.push(`Approver: ${metaString(approval, 'reviewer') || 'recorded'}`)
  const merge = lastOf(events, 'pull_request_merged')
  if (merge) highlights.push(`Merged at ${formatTime(merge.createdAt)}`)
  const messages = contextualMessages(events)
  if (messages.length) highlights.push(`${messages.length} context-rich chat message(s) with validation/risk language`)
  return highlights
}

export function createTaskDeliveryReport(events: SimulationEvent[], input: { taskId: string; level: ScenarioLevel; createdAt: string; id: string }): DeliveryReport {
  const cycleEvents = eventsForCycle(events, input.taskId, input.level)
  const signals = signalsForCycle(cycleEvents, { taskId: input.taskId, level: input.level })
  const verifiedCount = signals.filter((signal) => signal.status === 'verified').length
  const growth = signals.find((signal) => signal.status !== 'verified')
  const issue = issuesForScenarioLevel(input.level).find((item) => item.id === input.taskId)
  const merge = lastOf(cycleEvents, 'pull_request_merged')
  const pr = lastOf(cycleEvents, 'pull_request_opened')

  return {
    id: input.id,
    kind: 'task',
    taskId: input.taskId,
    taskTitle: taskTitle(input.taskId, input.level),
    scenarioLevel: input.level,
    createdAt: input.createdAt,
    outcome: 'completed',
    summary: [
      `${input.taskId} (${input.level}) closed through the delivery gate.`,
      issue ? `Work item: ${issue.title}.` : '',
      pr ? `PR evidence: ${clip(metaString(pr, 'title') || 'opened', 90)}.` : '',
      merge ? `Merged ${formatTime(merge.createdAt)}.` : '',
      `${verifiedCount}/${signals.length} recruiter-evidence dimensions fully verified from ledger events.`,
    ].filter(Boolean).join(' '),
    strengths: strengthsFromSignals(signals, cycleEvents, input.taskId),
    growthArea: growth
      ? `${growth.label} still needs stronger ledger evidence. ${growth.finding}${growth.artifacts[0] ? ` Next artifact to capture: ${growth.artifacts[0]}` : ''}`
      : undefined,
    recruiterSignals: signals,
    timeline: timelineFor(cycleEvents),
    evidenceHighlights: evidenceHighlights(cycleEvents, input.taskId, input.level),
  }
}

function allProjectTasksComplete(events: SimulationEvent[]) {
  const completed = new Set(events.filter((event) => event.type === 'task_completed').map((event) => String(event.metadata?.issueId || '')))
  return Object.values(taskIdsForScenarioLevel).flat().every((id) => completed.has(id))
}

export function createProjectDeliveryReport(events: SimulationEvent[], input: { createdAt: string; id: string }): DeliveryReport | null {
  if (!allProjectTasksComplete(events)) return null
  const signals = signalsForCycle(events, { level: 'project' })
  const verifiedCount = signals.filter((signal) => signal.status === 'verified').length
  const growth = signals.find((signal) => signal.status !== 'verified')
  const completedTasks = events
    .filter((event) => event.type === 'task_completed')
    .map((event) => `${String(event.metadata?.level || '')}:${String(event.metadata?.issueId || '')}`)
  const taskCount = Object.values(taskIdsForScenarioLevel).flat().length

  return {
    id: input.id,
    kind: 'project',
    taskTitle: 'SignalDesk usage-alerts project',
    scenarioLevel: 'project',
    createdAt: input.createdAt,
    outcome: 'project_completed',
    summary: [
      `Project complete: all ${taskCount} assigned tasks across Basic, Intermediate, and Advanced were merged and marked complete.`,
      `Completed set: ${completedTasks.join(', ')}.`,
      `${verifiedCount}/${signals.length} project-level evidence dimensions fully verified from the aggregate ledger.`,
    ].join(' '),
    strengths: [
      ...strengthsFromSignals(signals, events),
      `Task completions recorded: ${completedTasks.join(', ')}.`,
    ],
    growthArea: growth
      ? `${growth.label}: ${growth.finding}`
      : undefined,
    recruiterSignals: signals,
    timeline: timelineFor(events),
    evidenceHighlights: [
      ...evidenceHighlights(events, undefined, 'project'),
      `Tasks completed: ${completedTasks.length}/${taskCount}`,
      `Total ledger events: ${events.length}`,
    ],
  }
}

function isReport(value: unknown): value is DeliveryReport {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DeliveryReport>
  return typeof candidate.id === 'string'
    && (candidate.kind === 'task' || candidate.kind === 'project')
    && Array.isArray(candidate.recruiterSignals)
    && Array.isArray(candidate.timeline)
}

function normalizeReport(report: DeliveryReport): DeliveryReport {
  return {
    ...report,
    strengths: Array.isArray(report.strengths) ? report.strengths : [],
    evidenceHighlights: Array.isArray(report.evidenceHighlights) ? report.evidenceHighlights : [],
    recruiterSignals: report.recruiterSignals.map((signal) => {
      // Drop legacy resume-style `claim` field if older snapshots still contain it.
      const { claim: _legacyClaim, ...rest } = signal as RecruiterSignal & { claim?: string }
      return {
        ...rest,
        artifacts: Array.isArray(rest.artifacts) ? rest.artifacts : [],
      }
    }),
  }
}

export function deliveryReportsFromEvents(events: SimulationEvent[]): DeliveryReport[] {
  return events
    .filter((event) => event.type === 'task_report_created' || event.type === 'project_report_created')
    .map((event) => event.metadata?.report)
    .filter(isReport)
    .map(normalizeReport)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
}

export function currentScenarioLevel(events: SimulationEvent[]): ScenarioLevel {
  return scenarioLevelFromEvents(events)
}
