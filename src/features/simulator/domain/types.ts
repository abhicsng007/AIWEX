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
  | 'issue_created'
  | 'issue_updated'
  | 'simulation_time_advanced'
  | 'team_space_created'
  | 'team_space_updated'
  | 'chat_message_edited'
  | 'chat_message_deleted'
  | 'message_pinned'
  | 'message_marked_decision'
  | 'message_marked_risk'
  | 'message_marked_question'
  | 'message_marked_handoff'
  | 'message_marked_blocker'
  | 'thread_resolved'
  | 'followup_created'
  | 'followup_completed'
  | 'space_archived'
  | 'space_member_added'
  | 'space_member_removed'
  | 'scenario_level_selected'
  | 'task_completed'
  | 'level_unlocked'
  | 'onboarding_started'
  | 'onboarding_profile_confirmed'
  | 'policy_acknowledged'
  | 'access_provisioned'
  | 'training_slide_completed'
  | 'quiz_attempted'
  | 'quiz_passed'
  | 'readiness_task_started'
  | 'readiness_task_passed'
  | 'readiness_task_retry_required'
  | 'readiness_training_resumed'
  | 'manager_signoff_recorded'
  | 'schedule_created'
  | 'schedule_event_completed'
  | 'deadline_missed'
  | 'deadline_extension_requested'
  | 'deadline_extension_approved'
  | 'reliability_penalty_applied'
  | 'team_welcome_started'
  | 'learner_introduction_posted'
  | 'team_welcome_concluded'
  | 'load_test_recorded'
  | 'scenario_deployment_recorded'
  | 'workspace_revision_saved'
  | 'agent_task_started'
  | 'agent_task_completed'
  | 'agent_blocker_raised'
  | 'agent_ceremony_scheduled'
  | 'deadline_extension_decided'

export type SimulationMetadata = Record<string, unknown>

export type SimulationEvent = {
  id: string
  organizationId: string
  type: SimulationEventType
  createdAt: string
  metadata?: SimulationMetadata
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
