import { deriveOnboardingState, scheduleFromEvents, simulationNow } from '@/features/simulator/domain/onboarding'
import { deriveWorkflowState } from '@/features/simulator/domain/workflow'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { inMemoryEventStore } from './event-store'
import { nextScenarioChallenge } from './scenario-director'

type DirectorResult = { released: SimulationEvent[]; missedDeadlines: number }

const append = (organizationId: string, type: SimulationEvent['type'], metadata: Record<string, string | number | boolean>): SimulationEvent => ({
  id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata,
})

/**
 * A deterministic, idempotent work director. It can be invoked by a secure
 * cron job or by the learner's live session; browser activity is no longer
 * the source of truth for when simulated coworkers act.
 */
export async function releaseSimulationWork(organizationId: string): Promise<DirectorResult> {
  const events = await inMemoryEventStore.list(organizationId)
  if (deriveOnboardingState(events).phase !== 'qualified') return { released: [], missedDeadlines: 0 }
  const released: SimulationEvent[] = []
  const triggers = new Set(events.filter((event) => event.type === 'agent_reply').map((event) => String(event.metadata?.trigger || '')))
  const workflow = deriveWorkflowState(events)
  const scenario = nextScenarioChallenge(events)
  const fallback = !workflow.standupPosted && !triggers.has('standup-reminder')
    ? { trigger: 'standup-reminder', agentId: 'maya', channelId: 'product-usage', action: 'post_message', message: '@alex, please post your stand-up before implementation so I can keep the dependency plan accurate.' }
    : workflow.checksPassed && !workflow.pullRequestOpened && !triggers.has('review-prep')
      ? { trigger: 'review-prep', agentId: 'noah', channelId: 'engineering', action: 'request_review', message: '@alex, checks are green. Open the PR with the restricted-role validation so I can use the scheduled review window effectively.' }
      : workflow.pullRequestOpened && !workflow.reviewAddressed && !triggers.has('review-reminder')
        ? { trigger: 'review-reminder', agentId: 'noah', channelId: 'engineering', action: 'raise_blocker', message: '@alex, the role-guard concern is blocking approval. Resolve it and explain the validation before the review window closes.' }
        : workflow.approvalGranted && !workflow.merged && !triggers.has('merge-reminder')
          ? { trigger: 'merge-reminder', agentId: 'maya', channelId: 'releases', action: 'schedule_ceremony', message: 'The review gate is clear. Record the merge rationale so the release train has a durable decision trail.' }
          : null
  const candidate = scenario ? { ...scenario, action: 'raise_blocker' } : fallback
  if (candidate && !triggers.has(candidate.trigger)) {
    const action = append(organizationId, 'agent_task_started', { agentId: candidate.agentId, action: candidate.action, trigger: candidate.trigger, channelId: candidate.channelId })
    const reply = append(organizationId, 'agent_reply', { agentId: candidate.agentId, channelId: candidate.channelId, trigger: candidate.trigger, message: candidate.message, action: candidate.action })
    await inMemoryEventStore.append(action); await inMemoryEventStore.append(reply)
    released.push(action, reply)
  }
  const refreshed = await inMemoryEventStore.list(organizationId)
  const now = simulationNow(refreshed)
  let missedDeadlines = 0
  for (const item of scheduleFromEvents(refreshed).filter((entry) => entry.kind === 'deadline' && !entry.completed && !entry.missed && Date.parse(entry.endsAt) < now.getTime())) {
    const missed = append(organizationId, 'deadline_missed', { scheduleId: item.id })
    await inMemoryEventStore.append(missed)
    released.push(missed); missedDeadlines += 1
  }
  return { released, missedDeadlines }
}
