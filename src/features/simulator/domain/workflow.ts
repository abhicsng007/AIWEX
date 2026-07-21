import type { SimulationEvent, SimulationEventType, WorkflowState } from './types'

export type ActiveDeliveryCycle = {
  level: 'basic' | 'intermediate' | 'advanced'
  taskId: string
  sequence: number
  startedAt: string
}

export const initialWorkflowState: WorkflowState = {
  standupPosted: false,
  checksPassed: false,
  committed: false,
  pullRequestOpened: false,
  reviewAddressed: false,
  reviewReplied: false,
  approvalGranted: false,
  mergeRationaleRecorded: false,
  merged: false,
}

/**
 * Returns the task currently being delivered. A delivery cycle is deliberately
 * represented in the immutable event ledger, so a refresh or another browser
 * cannot accidentally reopen a completed pull request.
 */
export function activeDeliveryCycle(events: SimulationEvent[]): ActiveDeliveryCycle | null {
  const event = [...events].reverse().find((item) => item.type === 'delivery_cycle_started')
  if (!event) return null
  const level = event.metadata?.level
  const taskId = event.metadata?.taskId
  if ((level !== 'basic' && level !== 'intermediate' && level !== 'advanced') || typeof taskId !== 'string' || !taskId) return null
  const sequence = Number(event.metadata?.sequence)
  return { level, taskId, sequence: Number.isFinite(sequence) && sequence > 0 ? sequence : 1, startedAt: event.createdAt }
}

function workflowStartIndex(events: SimulationEvent[]) {
  // Older runs do not have delivery-cycle events. Their latest level selection
  // remains a safe compatibility boundary and prevents a Basic merge from
  // contaminating a later Intermediate or Advanced task.
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === 'delivery_cycle_started' || events[index].type === 'scenario_level_selected') return index + 1
  }
  return 0
}

export function deriveWorkflowState(events: SimulationEvent[]): WorkflowState {
  return events.slice(workflowStartIndex(events)).reduce<WorkflowState>((state, event) => {
    switch (event.type) {
      case 'standup_posted': return { ...state, standupPosted: true }
      case 'checks_passed': return { ...state, checksPassed: true }
      case 'commit_created': return { ...state, committed: true }
      case 'pull_request_opened': return { ...state, pullRequestOpened: true }
      case 'review_addressed': return { ...state, reviewAddressed: true }
      case 'review_reply': return { ...state, reviewReplied: true }
      case 'approval_granted': return { ...state, approvalGranted: true }
      case 'merge_rationale_recorded': return { ...state, mergeRationaleRecorded: true }
      case 'pull_request_merged': return { ...state, merged: true }
      default: return state
    }
  }, initialWorkflowState)
}

export function validateWorkflowTransition(state: WorkflowState, type: SimulationEventType, metadata?: SimulationEvent['metadata']): string | null {
  // Board, calendar, and collaboration events remain open after merge so a
  // completed showcase (or a real workday after ship) can still close issues,
  // advance time, and record post-merge operational evidence.
  if (state.merged && !['chat_message', 'agent_reply', 'simulation_time_advanced', 'team_space_created', 'team_space_updated', 'chat_message_edited', 'chat_message_deleted', 'message_pinned', 'message_marked_decision', 'message_marked_risk', 'message_marked_question', 'message_marked_handoff', 'message_marked_blocker', 'thread_resolved', 'followup_created', 'followup_completed', 'space_archived', 'space_member_added', 'space_member_removed', 'scenario_level_selected', 'delivery_cycle_started', 'task_completed', 'level_unlocked', 'load_test_recorded', 'scenario_deployment_recorded', 'issue_created', 'issue_updated'].includes(type)) return 'This pull request is already merged.'
  if (type === 'standup_posted' && state.standupPosted) return 'Today’s stand-up was already posted.'
  if (type === 'checks_passed' && state.committed) return 'Create a new branch change before running checks again.'
  if (type === 'commit_created' && !state.checksPassed) return 'Pass the branch checks before committing.'
  if (type === 'pull_request_opened' && (!state.committed || !state.standupPosted)) return 'Post your stand-up and commit passing work before opening a pull request.'
  if (type === 'review_addressed' && !state.pullRequestOpened) return 'Open a pull request before responding to review.'
  if (type === 'review_reply' && !state.reviewAddressed) return 'Address the review before posting a response.'
  if (type === 'approval_granted' && !state.reviewReplied) return 'A reviewer can approve only after you respond to the requested changes.'
  if (type === 'merge_rationale_recorded' && (!state.approvalGranted || String(metadata?.rationale || '').trim().length < 20)) return 'Record a clear merge rationale after approval.'
  if (type === 'pull_request_merged' && (!state.approvalGranted || !state.mergeRationaleRecorded)) return 'Approval and a merge rationale are both required before merge.'
  return null
}
