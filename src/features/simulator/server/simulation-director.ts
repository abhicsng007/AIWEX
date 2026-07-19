import { deriveOnboardingState, scheduleFromEvents, simulationClockMinutes, simulationNow } from '@/features/simulator/domain/onboarding'
import type { FollowUpRequirement } from '@/features/simulator/domain/accountability'
import { activeDeliveryCycle, deriveWorkflowState } from '@/features/simulator/domain/workflow'
import { scenarioLevelFromEvents } from '@/features/simulator/domain/difficulty'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { inMemoryEventStore } from './event-store'
import { nextScenarioChallenge } from './scenario-director'

type DirectorResult = { released: SimulationEvent[]; missedDeadlines: number }
type Candidate = {
  trigger: string
  agentId: string
  channelId: string
  action: 'post_message' | 'request_review' | 'raise_blocker' | 'schedule_ceremony'
  message: string
  title?: string
  severity?: 'info' | 'warning' | 'critical'
  followUp?: { title: string; requirement: FollowUpRequirement }
}

const append = (organizationId: string, type: SimulationEvent['type'], metadata: SimulationEvent['metadata'] = {}): SimulationEvent => ({
  id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata,
})

async function releaseCandidate(organizationId: string, candidate: Candidate, released: SimulationEvent[]) {
  const action = append(organizationId, 'agent_task_started', {
    agentId: candidate.agentId, action: candidate.action, trigger: candidate.trigger, channelId: candidate.channelId,
    ...(candidate.title ? { title: candidate.title } : {}), ...(candidate.severity ? { severity: candidate.severity } : {}),
  })
  const reply = append(organizationId, 'agent_reply', {
    agentId: candidate.agentId, channelId: candidate.channelId, trigger: candidate.trigger, message: candidate.message, action: candidate.action,
    ...(candidate.title ? { title: candidate.title } : {}), ...(candidate.severity ? { severity: candidate.severity } : {}),
  })
  await inMemoryEventStore.append(action)
  await inMemoryEventStore.append(reply)
  released.push(action, reply)
  if (!candidate.followUp) return
  const followUpId = `followup-${candidate.trigger}`
  const followUp = { id: followUpId, sourceMessageId: Date.parse(reply.createdAt) + 1, title: candidate.followUp.title, ownerId: 'you', status: 'open' as const, createdAt: reply.createdAt }
  const tracked = append(organizationId, 'followup_created', {
    followUpId, messageId: followUp.sourceMessageId, spaceId: candidate.channelId, ownerId: 'you', requirement: candidate.followUp.requirement, followUp,
  })
  await inMemoryEventStore.append(tracked)
  released.push(tracked)
}

function timeBasedFollowUp(clockMinutes: number, cycleKey: string, taskId: string, workflow: ReturnType<typeof deriveWorkflowState>): Candidate | null {
  const nextRequirement: FollowUpRequirement = !workflow.checksPassed ? 'checks' : !workflow.committed ? 'commit' : !workflow.pullRequestOpened ? 'pull_request' : !workflow.reviewReplied ? 'review_response' : 'merge'
  if (clockMinutes >= 16 * 60 && !workflow.merged) return {
    trigger: `delivery-escalation-${cycleKey}`, agentId: 'marcus', channelId: 'releases', action: 'raise_blocker', title: 'Delivery status is overdue', severity: 'critical',
    message: `@alex, ${taskId} is still not through the delivery gate. What changed, what is the customer or release impact, and what is your next committed time? Record the evidence before closing the day.`,
    followUp: { title: `Provide a delivery status and finish the ${taskId} gate`, requirement: nextRequirement },
  }
  if (clockMinutes >= 15 * 60 && !workflow.pullRequestOpened) return {
    trigger: `stakeholder-checkin-${cycleKey}`, agentId: 'maya', channelId: 'releases', action: 'raise_blocker', title: 'Stakeholder check-in needs a status', severity: 'warning',
    message: `@alex, the stakeholder check-in is here and ${taskId} is not review-ready. Tell us the current evidence, the blocker, and whether you need a recovery window.`,
    followUp: { title: `Make ${taskId} review-ready or escalate the delivery risk`, requirement: nextRequirement },
  }
  if (clockMinutes >= 13 * 60 && !workflow.checksPassed) return {
    trigger: `implementation-followup-${cycleKey}`, agentId: 'devon', channelId: 'engineering', action: 'post_message', title: 'Implementation check-in', severity: 'warning',
    message: `@alex, I do not see verified checks for ${taskId}. What changed in the implementation, and what is preventing you from running the scenario validation?`,
    followUp: { title: `Run server-verified checks for ${taskId}`, requirement: 'checks' },
  }
  if (clockMinutes >= 10 * 60 && !workflow.standupPosted) return {
    trigger: `standup-reminder-${cycleKey}`, agentId: 'maya', channelId: 'product-usage', action: 'post_message', title: 'Stand-up is overdue', severity: 'warning',
    message: `@alex, please post the ${taskId} stand-up now. I need your plan, current risk, and any dependency before the team can sequence the work.`,
    followUp: { title: `Post the ${taskId} stand-up with plan and blockers`, requirement: 'standup' },
  }
  return null
}

/**
 * Deterministic, idempotent manager and teammate follow-ups. The director is
 * invoked by the browser pulse and the secure scheduler, so accountability is
 * based on the event ledger and simulated clock rather than on a page being open.
 */
export async function releaseSimulationWork(organizationId: string): Promise<DirectorResult> {
  const events = await inMemoryEventStore.list(organizationId)
  if (deriveOnboardingState(events).phase !== 'qualified') return { released: [], missedDeadlines: 0 }
  const released: SimulationEvent[] = []
  const triggers = new Set(events.filter((event) => event.type === 'agent_reply').map((event) => String(event.metadata?.trigger || '')))
  const workflow = deriveWorkflowState(events)
  const cycle = activeDeliveryCycle(events)
  const level = scenarioLevelFromEvents(events)
  const taskId = cycle?.level === level ? cycle.taskId : level === 'basic' ? 'PROJ-184' : level === 'intermediate' ? 'PROJ-191' : 'PROJ-203'
  const cycleKey = `${level}-${taskId}-${cycle?.sequence || 1}`
  const timed = timeBasedFollowUp(simulationClockMinutes(events), cycleKey, taskId, workflow)
  const scenario = nextScenarioChallenge(events)
  const workflowPrompt = workflow.checksPassed && !workflow.pullRequestOpened ? {
    trigger: `review-prep-${cycleKey}`, agentId: 'noah', channelId: 'engineering', action: 'request_review' as const,
    message: `@alex, ${taskId} checks are green. Open the PR with validation evidence so I can use the scheduled review window effectively.`,
    followUp: { title: `Open the ${taskId} pull request with validation evidence`, requirement: 'pull_request' as const },
  } : workflow.pullRequestOpened && !workflow.reviewAddressed ? {
    trigger: `review-reminder-${cycleKey}`, agentId: 'noah', channelId: 'engineering', action: 'raise_blocker' as const,
    message: `@alex, the ${taskId} review concern is blocking approval. Resolve it and explain the validation before the review window closes.`,
    followUp: { title: `Address and respond to the ${taskId} review`, requirement: 'review_response' as const },
  } : workflow.approvalGranted && !workflow.merged ? {
    trigger: `merge-reminder-${cycleKey}`, agentId: 'maya', channelId: 'releases', action: 'schedule_ceremony' as const,
    message: `The ${taskId} review gate is clear. Record the merge rationale so the release train has a durable decision trail.`,
    followUp: { title: `Record the ${taskId} rationale and merge`, requirement: 'merge' as const },
  } : null
  const candidate: Candidate | null = timed || (scenario ? { ...scenario, action: 'raise_blocker', followUp: { title: scenario.title, requirement: workflow.checksPassed ? 'pull_request' : 'checks' } } : null) || workflowPrompt
  if (candidate && !triggers.has(candidate.trigger)) await releaseCandidate(organizationId, candidate, released)

  const refreshed = await inMemoryEventStore.list(organizationId)
  const now = simulationNow(refreshed)
  let missedDeadlines = 0
  const refreshedTriggers = new Set(refreshed.filter((event) => event.type === 'agent_reply').map((event) => String(event.metadata?.trigger || '')))
  for (const item of scheduleFromEvents(refreshed).filter((entry) => entry.kind === 'deadline' && !entry.completed && !entry.missed && Date.parse(entry.endsAt) < now.getTime())) {
    const missed = append(organizationId, 'deadline_missed', { scheduleId: item.id })
    await inMemoryEventStore.append(missed)
    released.push(missed)
    missedDeadlines += 1
    const deadlineTrigger = `deadline-followup-${item.id}`
    if (!refreshedTriggers.has(deadlineTrigger)) await releaseCandidate(organizationId, {
      trigger: deadlineTrigger, agentId: 'maya', channelId: 'releases', action: 'raise_blocker', title: 'Delivery commitment missed', severity: 'critical',
      message: `@alex, ${item.title} has passed without completion evidence. What changed, what is the impact, and what recovery plan can the team rely on?`,
      followUp: { title: `Post a recovery plan for ${item.title}`, requirement: 'recovery_plan' },
    }, released)
    const currentEvents = await inMemoryEventStore.list(organizationId)
    const misses = deriveOnboardingState(currentEvents).missedDeadlines
    const penaltyRecorded = currentEvents.some((event) => event.type === 'reliability_penalty_applied' && event.metadata?.scheduleId === item.id)
    if (misses > 2 && !penaltyRecorded) {
      const penalty = append(organizationId, 'reliability_penalty_applied', { scheduleId: item.id, points: 5, reason: 'deadline_missed_after_two_grace_events' })
      await inMemoryEventStore.append(penalty)
      released.push(penalty)
    }
  }
  return { released, missedDeadlines }
}
