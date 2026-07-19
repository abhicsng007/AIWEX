import type { SimulationEvent } from './types'
import { deriveWorkflowState } from './workflow'

export type FollowUpRequirement = 'standup' | 'checks' | 'commit' | 'pull_request' | 'review_response' | 'merge' | 'recovery_plan'

function requirementError(requirement: FollowUpRequirement, events: SimulationEvent[]) {
  const workflow = deriveWorkflowState(events)
  if (requirement === 'standup' && !workflow.standupPosted) return 'Post your stand-up before closing this follow-up.'
  if (requirement === 'checks' && !workflow.checksPassed) return 'Run and pass the server-verified scenario checks before closing this follow-up.'
  if (requirement === 'commit' && !workflow.committed) return 'Create the verified commit before closing this follow-up.'
  if (requirement === 'pull_request' && !workflow.pullRequestOpened) return 'Open the pull request with validation evidence before closing this follow-up.'
  if (requirement === 'review_response' && !workflow.reviewReplied) return 'Send the review response before closing this follow-up.'
  if (requirement === 'merge' && !workflow.merged) return 'Complete approval, rationale, and merge before closing this follow-up.'
  if (requirement === 'recovery_plan') {
    const recoveryMessage = events.some((event) => event.type === 'chat_message' && event.metadata?.channelId === 'releases' && /recovery|revised plan|impact|risk/i.test(String(event.metadata?.message || '')))
    if (!recoveryMessage) return 'Post a recovery plan with impact or risk in #releases before closing this follow-up.'
  }
  return null
}

export function followUpCompletionError(events: SimulationEvent[], followUpId: string) {
  const source = [...events].reverse().find((event) => {
    if (event.type !== 'followup_created') return false
    const embeddedFollowUp = event.metadata?.followUp
    const embeddedId = embeddedFollowUp && typeof embeddedFollowUp === 'object' ? (embeddedFollowUp as { id?: unknown }).id : undefined
    return String(event.metadata?.followUpId || embeddedId || '') === followUpId
  })
  if (!source) return 'This follow-up was not found in the simulation ledger.'
  const requirement = source.metadata?.requirement
  if (requirement !== 'standup' && requirement !== 'checks' && requirement !== 'commit' && requirement !== 'pull_request' && requirement !== 'review_response' && requirement !== 'merge' && requirement !== 'recovery_plan') return null
  return requirementError(requirement, events)
}
