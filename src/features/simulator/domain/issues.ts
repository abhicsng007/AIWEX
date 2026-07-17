export type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
export type IssuePriority = 'high' | 'medium' | 'low'

export type WorkIssue = {
  id: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  assignee: 'alex' | 'maya' | 'noah' | 'adele' | 'devon'
  estimate: number
  sprint: string
  acceptanceCriteria: string[]
  dependencyIds: string[]
  updatedAt: string
}

export const seededIssues: WorkIssue[] = [
  { id: 'PROJ-184', title: 'Build the usage alerts empty state', description: 'Give new workspaces a clear, useful first experience when there are no active usage alerts.', status: 'todo', priority: 'high', assignee: 'alex', estimate: 3, sprint: 'Sprint 2', acceptanceCriteria: ['Show a clear title and next step when no alerts exist', 'Do not show a billing CTA to restricted roles', 'Cover legacy workspaces without a threshold'], dependencyIds: ['PROJ-176'], updatedAt: 'Today, 9:12 AM' },
  { id: 'PROJ-191', title: 'Add limit badge to settings nav', description: 'Help workspace owners find their current usage plan at a glance.', status: 'todo', priority: 'medium', assignee: 'maya', estimate: 2, sprint: 'Sprint 2', acceptanceCriteria: ['Badge matches current plan', 'Does not show for restricted roles'], dependencyIds: [], updatedAt: 'Today, 8:48 AM' },
  { id: 'PROJ-176', title: 'Harden billing event mapper', description: 'Normalize legacy billing event payloads before the usage UI consumes them.', status: 'in_progress', priority: 'high', assignee: 'noah', estimate: 5, sprint: 'Sprint 2', acceptanceCriteria: ['Handle missing threshold', 'Add regression coverage'], dependencyIds: [], updatedAt: 'Today, 9:18 AM' },
  { id: 'PROJ-189', title: 'Usage chart tooltips', description: 'Clarify chart values and limits on hover.', status: 'in_progress', priority: 'medium', assignee: 'devon', estimate: 3, sprint: 'Sprint 2', acceptanceCriteria: ['Explain period and usage values'], dependencyIds: [], updatedAt: 'Yesterday' },
  { id: 'PROJ-179', title: 'Loading state for alert rules', description: 'Avoid an abrupt state transition while alert rules load.', status: 'in_review', priority: 'medium', assignee: 'devon', estimate: 2, sprint: 'Sprint 2', acceptanceCriteria: ['Use existing loading primitive', 'Preserve layout'], dependencyIds: [], updatedAt: 'Today, 8:33 AM' },
  { id: 'PROJ-170', title: 'Plan usage API contract', description: 'Document the plan usage API shape for UI consumers.', status: 'done', priority: 'medium', assignee: 'noah', estimate: 2, sprint: 'Sprint 1', acceptanceCriteria: ['Contract reviewed by frontend'], dependencyIds: [], updatedAt: 'Sep 13' },
]
