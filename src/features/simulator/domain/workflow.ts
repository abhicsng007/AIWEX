import type { SimulationEvent, SimulationEventType, WorkflowState } from './types'

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

export function deriveWorkflowState(events: SimulationEvent[]): WorkflowState {
  return events.reduce<WorkflowState>((state, event) => {
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
  if (state.merged && type !== 'chat_message' && type !== 'agent_reply') return 'This pull request is already merged.'
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
