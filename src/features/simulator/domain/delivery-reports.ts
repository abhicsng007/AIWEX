import { assessSimulation } from './assessment'
import { scenarioLevelFromEvents, taskIdsForScenarioLevel, type ScenarioLevel } from './difficulty'
import { issuesForScenarioLevel } from './difficulty'
import { meetsPerformanceTarget, loadTestResultsFromEvents } from './performance'
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

/** Qualitative end-of-project write-up. Grounded in ledger facts, without scores or raw metrics. */
export type PerformanceNarrative = {
  technicalExecution: string
  collaboration: string
  ownershipReliability: string
  processFit: string
  workReadiness: string
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
  /** Final project only: prose assessment of how the learner fared. */
  performanceNarrative?: PerformanceNarrative
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

/**
 * Qualitative tier used only to choose prose. Numbers never appear in the output.
 */
function qualitativeBand(score: number): 'strong' | 'solid' | 'developing' | 'early' {
  if (score >= 85) return 'strong'
  if (score >= 70) return 'solid'
  if (score >= 55) return 'developing'
  return 'early'
}

function has(events: SimulationEvent[], type: SimulationEvent['type']) {
  return events.some((event) => event.type === type)
}

function hasVerifiedChecks(events: SimulationEvent[]) {
  return events.some((event) => event.type === 'checks_passed' && event.metadata?.verified === true)
}

function hasRichReviewReply(events: SimulationEvent[]) {
  return events.some((event) => {
    if (event.type !== 'review_reply') return false
    const text = String(event.metadata?.response || '')
    return text.length >= 40 && /(test|validat|because|canManageBilling|legacy|role)/i.test(text)
  })
}

function hasContextRichChat(events: SimulationEvent[]) {
  return events.some((event) => {
    if (event.type !== 'chat_message') return false
    const text = String(event.metadata?.message || '')
    return /@[a-z0-9-]+/i.test(text) && /(risk|test|validat|because|scope|legacy|canManageBilling)/i.test(text)
  })
}

/**
 * Prose-only project narratives. Internally uses assessment + event presence;
 * the text itself avoids scores, counts, percentages, and metric dumps.
 */
export function buildPerformanceNarrative(events: SimulationEvent[]): PerformanceNarrative {
  const assessment = assessSimulation(events)
  const { technicalExecution, collaboration, ownershipReliability, processFit } = assessment.scores
  const readiness = Math.round((technicalExecution + collaboration + ownershipReliability + processFit) / 4)
  const tech = qualitativeBand(technicalExecution)
  const collab = qualitativeBand(collaboration)
  const ownership = qualitativeBand(ownershipReliability)
  const process = qualitativeBand(processFit)
  const overall = qualitativeBand(readiness)

  const checks = hasVerifiedChecks(events)
  const commit = has(events, 'commit_created')
  const pr = has(events, 'pull_request_opened')
  const merge = has(events, 'pull_request_merged')
  const standup = has(events, 'standup_posted')
  const reviewReply = has(events, 'review_reply')
  const richReply = hasRichReviewReply(events)
  const approval = has(events, 'approval_granted')
  const rationale = has(events, 'merge_rationale_recorded')
  const richChat = hasContextRichChat(events)
  const missedDeadlines = has(events, 'deadline_missed')
  const recovery = has(events, 'deadline_extension_requested') || has(events, 'followup_completed')
  const loadTests = loadTestResultsFromEvents(events)
  const latestLoad = loadTests.at(-1)
  const loadMet = latestLoad ? meetsPerformanceTarget(latestLoad) : false
  const completedAll = allProjectTasksComplete(events)

  const technicalExecutionNarrative = (() => {
    if (tech === 'strong' && checks && commit && pr && merge) {
      return completedAll
        ? 'Across the full Basic through Advanced path, technical work consistently cleared a closed delivery loop. Changes were validated before commit, carried through pull request and merge, and the learner treated verification as part of shipping rather than an afterthought. The overall trail reads as careful implementation discipline rather than ad-hoc patching.'
        : 'Technical work shows a mature delivery habit: validation before commit, a clear pull-request trail, and merge only after the change was reviewable. The pattern suggests the learner can take a feature from workspace edit to a defensible ship without skipping the engineering safety net.'
    }
    if (tech === 'solid' && checks && merge) {
      return 'Technical execution is credible and mostly complete. Server-side validation and merge evidence are present, so a reviewer can trust that the change was not just asserted but exercised. Some parts of the technical trail are thinner than the strongest runs, yet the core habit of validating and shipping is visible.'
    }
    if (checks && !merge) {
      return 'Technical work is underway with real validation in place, but the trail does not yet close cleanly through review and merge. The learner has shown they can prove a change works; the remaining growth is finishing the full engineering close-out so the work is fully shippable on the record.'
    }
    if (!checks) {
      return 'Technical execution is still forming. Without a clear validation-before-commit pattern, a recruiter cannot yet see whether the learner routinely protects quality before sharing work. Completing server-verified checks and then committing would make this dimension far more persuasive.'
    }
    return 'Technical execution shows partial evidence of delivery practice. Strengthening the path from verified checks through commit, reviewable change, and merge would turn isolated actions into a coherent engineering story.'
  })()

  const collaborationNarrative = (() => {
    if (collab === 'strong' && richChat && richReply) {
      return 'Collaboration is one of the clearer strengths in this run. The learner directed questions to teammates, used specific product and validation language, and answered review with enough written context that a reviewer could decide without chasing missing detail. Communication reads as working partnership, not status noise.'
    }
    if (collab === 'solid' && (richChat || reviewReply)) {
      return 'Collaboration is solid. There is evidence of teammate-facing communication and review dialogue, even if not every exchange is equally rich. The learner can operate inside a team channel and review loop; deepening specificity in questions and review responses would make the collaboration trail even more recruiter-ready.'
    }
    if (reviewReply && !richChat) {
      return 'Collaboration shows up most clearly in the review loop, where the learner responded in writing. Team-space conversation is thinner, so the story of day-to-day partnership is less visible than the review exchange. More directed, context-rich teammate messages would balance this dimension.'
    }
    if (richChat && !reviewReply) {
      return 'The learner communicates in team spaces with useful context, which is a positive collaboration signal. Review collaboration is less complete, so the record does not fully show how feedback is absorbed and answered. Closing the review conversation in writing would complete that picture.'
    }
    return 'Collaboration evidence is still light. A recruiter looking for partnership habits would want to see directed teammate questions and a substantive written response to review. Those actions turn silent solo work into visible teamwork.'
  })()

  const ownershipNarrative = (() => {
    if (ownership === 'strong' && standup && merge && !missedDeadlines) {
      return 'Ownership and reliability come through as consistent follow-through. Plans were made visible early, work moved to completion, and the ledger does not show missed commitments left unattended. The learner appears able to hold a delivery thread from intention to close without disappearing mid-cycle.'
    }
    if (ownership === 'solid' && standup) {
      return 'Ownership is credible. Stand-up and completion signals show the learner can declare intent and finish work. Reliability is generally intact, with only limited signs of slippage. This is the profile of someone who can be trusted with a scoped assignment and still improve how tightly they manage intermediate commitments.'
    }
    if (missedDeadlines && recovery) {
      return 'Ownership is mixed but recoverable. There is evidence of missed timing pressure, yet recovery actions were also recorded. That combination matters: the learner did not only slip—they re-entered the commitment and left a trail of how they handled it.'
    }
    if (missedDeadlines && !recovery) {
      return 'Ownership is weakened by missed timing without a clear recovery trail. Completing the work is not enough here; a recruiter looking for reliability wants to see that pressure was acknowledged and re-planned, not only that the task eventually finished.'
    }
    if (!standup) {
      return 'Ownership is harder to defend because the early commitment signal is missing. Without a visible plan before implementation, the work can look reactive even when the eventual delivery is fine. Making intent explicit at the start would strengthen this dimension immediately.'
    }
    return 'Ownership and reliability are partially visible. There are signs of initiative and completion, but the full arc from declared commitment through controlled close-out is not yet consistently evidenced.'
  })()

  const processNarrative = (() => {
    if (process === 'strong' && standup && checks && pr && approval && rationale && merge) {
      return 'Process fit is strong. The learner moved through the organization’s expected gate sequence—planning, validation, reviewable change, approval, rationale, and merge—without treating process as optional paperwork. The trail suggests comfort with professional delivery norms that a hiring manager can recognize.'
    }
    if (process === 'solid' && pr && merge) {
      return 'Process fit is solid. Pull request and merge discipline are present, so the work entered the team’s review surface rather than staying private. A few process steps are less complete than the ideal path, but the overall behavior aligns with how engineering teams actually ship.'
    }
    if (pr && !approval) {
      return 'Process awareness is emerging: the change was opened for review, which is the right institutional move. The gate is not fully closed, though, because approval and merge rationale are incomplete. Finishing those steps would convert “used the process” into “completed the process.”'
    }
    if (!pr) {
      return 'Process fit is still early. Without a pull-request and review gate on the record, the work looks more like individual progress than team-ready delivery. Using the formal review path would make this dimension much more convincing.'
    }
    return 'Process fit shows partial alignment with team delivery norms. Strengthening the end-to-end gate—from plan and checks through review, approval, rationale, and merge—would make the process story as clear as the technical one.'
  })()

  const readinessNarrative = (() => {
    const loadClause = latestLoad
      ? loadMet
        ? ' Performance evidence was also captured and met the intended staging target, which reinforces operational maturity.'
        : ' Performance evidence was recorded but did not fully meet the intended staging target, so there is still room to tighten validation under load.'
      : ''
    if (overall === 'strong' && completedAll) {
      return `Overall work readiness is high. Across the full project path, the learner combined technical close-out, teammate communication, ownership of commitments, and respect for delivery process into one coherent body of evidence. A recruiter can follow the story from plan to merge without having to trust unsupported self-description.${loadClause}`
    }
    if (overall === 'solid') {
      return `Overall work readiness is solid. The learner can operate inside a realistic delivery environment and leave a verifiable trail. The profile is already useful for discussion with a hiring manager, with the main growth edge being consistency across every dimension rather than a single missing skill.${loadClause}`
    }
    if (overall === 'developing') {
      return `Overall work readiness is developing. Important pieces of professional practice appear in the ledger, but the full combination of technical proof, collaboration, ownership, and process close-out is not yet evenly strong. Continued runs that finish every gate would raise confidence quickly.${loadClause}`
    }
    return `Overall work readiness is still early. The simulation has begun to capture how the learner works, yet a recruiter would currently see more potential than a complete professional delivery story. Completing stand-up, validation, review, and merge as one habit is the fastest way to change that impression.${loadClause}`
  })()

  // Strip any accidental digits so narratives stay prose-only even if future edits slip.
  const stripData = (text: string) => text
    .replace(/\b\d+(\.\d+)?%?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

  return {
    technicalExecution: stripData(technicalExecutionNarrative),
    collaboration: stripData(collaborationNarrative),
    ownershipReliability: stripData(ownershipNarrative),
    processFit: stripData(processNarrative),
    workReadiness: stripData(readinessNarrative),
  }
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
    performanceNarrative: buildPerformanceNarrative(events),
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

function normalizeReport(report: DeliveryReport, events: SimulationEvent[]): DeliveryReport {
  const normalized: DeliveryReport = {
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
  // Older project snapshots may lack prose narratives; rebuild from the full ledger.
  if (normalized.kind === 'project' && !normalized.performanceNarrative && allProjectTasksComplete(events)) {
    normalized.performanceNarrative = buildPerformanceNarrative(events)
  }
  return normalized
}

export function deliveryReportsFromEvents(events: SimulationEvent[]): DeliveryReport[] {
  return events
    .filter((event) => event.type === 'task_report_created' || event.type === 'project_report_created')
    .map((event) => event.metadata?.report)
    .filter(isReport)
    .map((report) => normalizeReport(report, events))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
}

export function currentScenarioLevel(events: SimulationEvent[]): ScenarioLevel {
  return scenarioLevelFromEvents(events)
}
