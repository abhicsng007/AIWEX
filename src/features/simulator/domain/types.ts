export type SimulationEventType =
  | 'standup_posted'
  | 'checks_passed'
  | 'commit_created'
  | 'pull_request_opened'
  | 'review_addressed'
  | 'chat_message'
  | 'agent_reply'
  | 'review_reply'
  | 'approval_granted'
  | 'merge_rationale_recorded'
  | 'pull_request_merged'

export type SimulationEvent = {
  id: string
  organizationId: string
  type: SimulationEventType
  createdAt: string
  metadata?: Record<string, string | number | boolean>
}

export type WorkflowState = {
  standupPosted: boolean
  checksPassed: boolean
  committed: boolean
  pullRequestOpened: boolean
  reviewAddressed: boolean
  reviewReplied: boolean
  approvalGranted: boolean
  mergeRationaleRecorded: boolean
  merged: boolean
}

export type WorkItem = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
  priority: 'high' | 'medium' | 'low'
  acceptanceCriteria: string[]
  dependencyIds: string[]
}
