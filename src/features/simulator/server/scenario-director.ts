import type { SimulationEvent } from '../domain/types'
import { scenarioLevelFromEvents, type ScenarioLevel } from '../domain/difficulty'
import { deriveWorkflowState } from '../domain/workflow'

export type ScenarioChallenge = { trigger: string; agentId: string; agentName: string; role: string; channelId: string; message: string; title: string; severity: 'info' | 'warning' | 'critical'; level: ScenarioLevel }

export function nextScenarioChallenge(events: SimulationEvent[]): ScenarioChallenge | null {
  const level = scenarioLevelFromEvents(events)
  const workflow = deriveWorkflowState(events)
  const released = new Set(events.filter((event) => event.type === 'agent_reply').map((event) => String(event.metadata?.trigger || '')))
  if (level === 'basic') {
    if (workflow.checksPassed && !workflow.pullRequestOpened && !released.has('basic-review-prep')) return { trigger: 'basic-review-prep', agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'product-usage', title: 'Light review preparation', severity: 'info', level, message: '@alex, great—checks are passing. When you open the PR, include one sentence about the restricted-role behavior so review stays quick.' }
    return null
  }
  if (level === 'intermediate') {
    if (workflow.standupPosted && !workflow.checksPassed && !released.has('intermediate-priority-conflict')) return { trigger: 'intermediate-priority-conflict', agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'product-usage', title: 'A second priority needs a plan', severity: 'warning', level, message: '@alex, PROJ-191 also matters for the Pro review. Please post the order you will tackle PROJ-184 and PROJ-191, plus what you need from the team.' }
    if (workflow.pullRequestOpened && !workflow.reviewAddressed && !released.has('intermediate-busy-reviewer')) return { trigger: 'intermediate-busy-reviewer', agentId: 'noah', agentName: 'Noah Patel', role: 'tech_lead', channelId: 'engineering', title: 'Reviewer focus window is limited', severity: 'warning', level, message: '@alex, I have a short review window. Send the exact file, risk, and validation you want me to assess so I can help without context switching.' }
    return null
  }
  if (workflow.checksPassed && !workflow.pullRequestOpened && !released.has('advanced-coverage-gap')) return { trigger: 'advanced-coverage-gap', agentId: 'marcus', agentName: 'Marcus Hall', role: 'engineering_manager', channelId: 'engineering', title: 'Peer coverage gap', severity: 'critical', level, message: '@alex, Devon is unexpectedly unavailable and PROJ-189 needs a first response. Protect your PROJ-184 deadline: state what you can cover, what must wait, and any risk you need me to own.' }
  if (workflow.pullRequestOpened && !workflow.reviewAddressed && !released.has('advanced-scope-change')) return { trigger: 'advanced-scope-change', agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'product-usage', title: 'Stakeholder scope change', severity: 'critical', level, message: '@alex, the stakeholder asked whether the empty state explains restricted-role access. Do not silently expand scope—propose the smallest safe response, impact on timing, and a decision owner.' }
  if (workflow.approvalGranted && !workflow.merged && !released.has('advanced-peer-support')) return { trigger: 'advanced-peer-support', agentId: 'marcus', agentName: 'Marcus Hall', role: 'engineering_manager', channelId: 'releases', title: 'Release responsibility tradeoff', severity: 'warning', level, message: '@alex, before merging, help the release by capturing the rollout note in PROJ-203. If that threatens the deadline, escalate the tradeoff with evidence rather than absorbing the work silently.' }
  return null
}
