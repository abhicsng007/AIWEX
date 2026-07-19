import type { SimulationEvent } from '../domain/types'
import { scenarioLevelFromEvents, type ScenarioLevel } from '../domain/difficulty'
import { activeDeliveryCycle, deriveWorkflowState } from '../domain/workflow'

export type ScenarioChallenge = {
  trigger: string
  agentId: string
  agentName: string
  role: string
  channelId: string
  message: string
  title: string
  severity: 'info' | 'warning' | 'critical'
  level: ScenarioLevel
}

/**
 * Returns at most one contextual prompt for the active task cycle. Trigger
 * IDs include the task and sequence, so the same learning moment can recur
 * for the next task without duplicating it for the current one.
 */
export function nextScenarioChallenge(events: SimulationEvent[]): ScenarioChallenge | null {
  const level = scenarioLevelFromEvents(events)
  const workflow = deriveWorkflowState(events)
  const cycle = activeDeliveryCycle(events)
  const taskId = cycle?.level === level ? cycle.taskId : level === 'basic' ? 'PROJ-184' : level === 'intermediate' ? 'PROJ-191' : 'PROJ-203'
  const cycleKey = `${level}-${taskId}-${cycle?.sequence || 1}`
  const released = new Set(events.filter((event) => event.type === 'agent_reply').map((event) => String(event.metadata?.trigger || '')))

  if (level === 'basic') {
    const trigger = `basic-review-prep-${cycleKey}`
    if (workflow.checksPassed && !workflow.pullRequestOpened && !released.has(trigger)) {
      return { trigger, agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'product-usage', title: 'Light review preparation', severity: 'info', level, message: `@alex, ${taskId} checks are passing. When you open the PR, include one sentence about the restricted-role behavior so review stays quick.` }
    }
    return null
  }

  if (level === 'intermediate') {
    const priorityTrigger = `intermediate-priority-conflict-${cycleKey}`
    if (workflow.standupPosted && !workflow.checksPassed && !released.has(priorityTrigger)) {
      return { trigger: priorityTrigger, agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'product-usage', title: 'A second priority needs a plan', severity: 'warning', level, message: `@alex, ${taskId} is now your active priority. Post the order you will tackle the remaining work, plus the decision or help you need from the team.` }
    }
    const reviewerTrigger = `intermediate-busy-reviewer-${cycleKey}`
    if (workflow.pullRequestOpened && !workflow.reviewAddressed && !released.has(reviewerTrigger)) {
      return { trigger: reviewerTrigger, agentId: 'noah', agentName: 'Noah Patel', role: 'tech_lead', channelId: 'engineering', title: 'Reviewer focus window is limited', severity: 'warning', level, message: `@alex, I have a short review window for ${taskId}. Send the exact file, risk, and validation you want me to assess so I can help without context switching.` }
    }
    return null
  }

  const coverageTrigger = `advanced-coverage-gap-${cycleKey}`
  if (workflow.checksPassed && !workflow.pullRequestOpened && !released.has(coverageTrigger)) {
    return { trigger: coverageTrigger, agentId: 'marcus', agentName: 'Marcus Hall', role: 'engineering_manager', channelId: 'engineering', title: 'Peer coverage gap', severity: 'critical', level, message: `@alex, Devon is unexpectedly unavailable while you own ${taskId}. State what you can cover, what must wait, and any risk you need me to own.` }
  }
  const scopeTrigger = `advanced-scope-change-${cycleKey}`
  if (workflow.pullRequestOpened && !workflow.reviewAddressed && !released.has(scopeTrigger)) {
    return { trigger: scopeTrigger, agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'product-usage', title: 'Stakeholder scope change', severity: 'critical', level, message: `@alex, the stakeholder has a scope question about ${taskId}. Propose the smallest safe response, impact on timing, and a decision owner.` }
  }
  const supportTrigger = `advanced-peer-support-${cycleKey}`
  if (workflow.approvalGranted && !workflow.merged && !released.has(supportTrigger)) {
    return { trigger: supportTrigger, agentId: 'marcus', agentName: 'Marcus Hall', role: 'engineering_manager', channelId: 'releases', title: 'Release responsibility tradeoff', severity: 'warning', level, message: `@alex, before merging ${taskId}, capture the release evidence. If that threatens the deadline, escalate the tradeoff with evidence rather than absorbing the work silently.` }
  }
  return null
}
