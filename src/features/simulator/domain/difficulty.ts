import { seededIssues, type WorkIssue } from './issues'

export type ScenarioLevel = 'basic' | 'intermediate' | 'advanced'

export type ScenarioPolicy = {
  label: string
  summary: string
  activeTaskTarget: number
  deadlineLabel: string
  agentStyle: string
  enabledChallenges: string[]
}

export const scenarioPolicies: Record<ScenarioLevel, ScenarioPolicy> = {
  basic: { label: 'Basic', summary: 'One focused feature with highly collaborative teammates and clear guidance.', activeTaskTarget: 1, deadlineLabel: 'Tomorrow, 5:00 PM', agentStyle: 'Available and proactive', enabledChallenges: ['light-review-reminder'] },
  intermediate: { label: 'Intermediate', summary: 'Two related priorities, busy teammates, and communication-driven help.', activeTaskTarget: 2, deadlineLabel: 'Tomorrow, 2:00 PM', agentStyle: 'Busy but reachable with clear context', enabledChallenges: ['priority-conflict', 'busy-reviewer'] },
  advanced: { label: 'Advanced', summary: 'Multiple hard commitments, competing responsibilities, and staged organizational disruption.', activeTaskTarget: 3, deadlineLabel: 'Today, 3:00 PM', agentStyle: 'Mixed availability and challenging stakeholders', enabledChallenges: ['coverage-gap', 'scope-change', 'peer-support'] },
}

/** The ordered delivery queue for each level. IDs do not overlap across levels. */
export const taskIdsForScenarioLevel: Record<ScenarioLevel, readonly string[]> = {
  basic: ['PROJ-184'],
  intermediate: ['PROJ-191', 'PROJ-189'],
  advanced: ['PROJ-203', 'PROJ-204', 'PROJ-205'],
}

const clone = (issue: WorkIssue): WorkIssue => ({ ...issue, acceptanceCriteria: [...issue.acceptanceCriteria], dependencyIds: [...issue.dependencyIds] })

export function issuesForScenarioLevel(level: ScenarioLevel): WorkIssue[] {
  const issues = seededIssues.map(clone)
  if (level === 'basic') return issues
  const limitBadge = issues.find((issue) => issue.id === 'PROJ-191')!
  limitBadge.assignee = 'alex'; limitBadge.priority = 'high'; limitBadge.updatedAt = 'Assigned for this scenario'
  const tooltip = issues.find((issue) => issue.id === 'PROJ-189')!
  tooltip.assignee = 'alex'; tooltip.priority = 'medium'; tooltip.status = 'todo'; tooltip.updatedAt = 'Assigned for this scenario'
  if (level === 'intermediate') return issues
  tooltip.priority = 'high'; tooltip.updatedAt = 'Coverage requested for this scenario'
  return [...issues, {
    id: 'PROJ-203', title: 'Prepare the usage-alerts rollout note', description: 'Summarize customer impact, known limits, and the validation plan for the release check-in.', status: 'todo', priority: 'medium', assignee: 'alex', estimate: 2, sprint: 'Sprint 2', acceptanceCriteria: ['State affected users and rollout scope', 'List validation and rollback signals'], dependencyIds: ['PROJ-184'], updatedAt: 'Introduced in advanced scenario',
  }, {
    id: 'PROJ-204', title: 'Add restricted-role release guidance', description: 'Make the release handoff explicit about which billing controls are unavailable to restricted roles.', status: 'todo', priority: 'high', assignee: 'alex', estimate: 2, sprint: 'Sprint 2', acceptanceCriteria: ['Call out the restricted-role constraint', 'Link the validation evidence for support'], dependencyIds: ['PROJ-203'], updatedAt: 'Introduced in advanced scenario',
  }, {
    id: 'PROJ-205', title: 'Capture usage-alerts rollback signals', description: 'Document the small set of customer and reliability signals that should pause the rollout.', status: 'todo', priority: 'high', assignee: 'alex', estimate: 2, sprint: 'Sprint 2', acceptanceCriteria: ['Name measurable pause signals', 'State the rollback owner and communication path'], dependencyIds: ['PROJ-203'], updatedAt: 'Introduced in advanced scenario',
  }]
}

export function scenarioLevelFromEvents(events: Array<{ type: string; metadata?: Record<string, unknown> }>): ScenarioLevel {
  const selected = [...events].reverse().find((event) => event.type === 'scenario_level_selected')?.metadata?.level
  return selected === 'intermediate' || selected === 'advanced' ? selected : 'basic'
}
