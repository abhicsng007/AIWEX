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
  advanced: { label: 'Advanced', summary: 'Multiple hard commitments, competing responsibilities, and staged organizational disruption.', activeTaskTarget: 4, deadlineLabel: 'Today, 3:00 PM', agentStyle: 'Mixed availability and challenging stakeholders', enabledChallenges: ['coverage-gap', 'scope-change', 'peer-support'] },
}

const clone = (issue: WorkIssue): WorkIssue => ({ ...issue, acceptanceCriteria: [...issue.acceptanceCriteria], dependencyIds: [...issue.dependencyIds] })

export function issuesForScenarioLevel(level: ScenarioLevel): WorkIssue[] {
  const issues = seededIssues.map(clone)
  if (level === 'basic') return issues
  const limitBadge = issues.find((issue) => issue.id === 'PROJ-191')!
  limitBadge.assignee = 'alex'; limitBadge.priority = 'high'; limitBadge.updatedAt = 'Assigned for this scenario'
  if (level === 'intermediate') return issues
  const tooltip = issues.find((issue) => issue.id === 'PROJ-189')!
  tooltip.assignee = 'alex'; tooltip.priority = 'high'; tooltip.status = 'todo'; tooltip.updatedAt = 'Coverage requested for this scenario'
  return [...issues, {
    id: 'PROJ-203', title: 'Prepare the usage-alerts rollout note', description: 'Summarize customer impact, known limits, and the validation plan for the release check-in.', status: 'todo', priority: 'medium', assignee: 'alex', estimate: 2, sprint: 'Sprint 2', acceptanceCriteria: ['State affected users and rollout scope', 'List validation and rollback signals'], dependencyIds: ['PROJ-184'], updatedAt: 'Introduced in advanced scenario',
  }]
}

export function scenarioLevelFromEvents(events: Array<{ type: string; metadata?: Record<string, string | number | boolean> }>): ScenarioLevel {
  const selected = [...events].reverse().find((event) => event.type === 'scenario_level_selected')?.metadata?.level
  return selected === 'intermediate' || selected === 'advanced' ? selected : 'basic'
}
