import type { AgentTurn, OrganizationContext, TeamAgent } from '@/features/simulator/domain/agents'

export interface AgentTextProvider {
  createTurn(input: { agent: TeamAgent; context: OrganizationContext; userMessage: string }): Promise<Pick<AgentTurn, 'message' | 'reasoningSummary'>>
}

/**
 * Local development provider. Its explicit policy keeps the simulator usable
 * without credentials while exercising the same orchestration contract as a
 * production LLM provider.
 */
export class RuleBasedTeamProvider implements AgentTextProvider {
  async createTurn({ agent, context, userMessage }: { agent: TeamAgent; context: OrganizationContext; userMessage: string }) {
    const text = userMessage.toLowerCase()
    if (agent.role === 'product_manager') {
      return { message: context.workflow.merged ? 'Thanks for closing the loop. Please post the customer-facing release note and pick up the next highest-priority item.' : 'Thanks for the update. Keep the customer outcome visible, call out any scope trade-off, and flag a risk before it becomes a deadline problem.', reasoningSummary: 'PM responded with scope and delivery guidance based on the current workflow state.' }
    }
    if (agent.role === 'product_designer') {
      return { message: 'Before implementation, confirm the empty state still explains what happens next for a user who cannot manage billing. I’ll review the final copy and hierarchy once you have a draft.', reasoningSummary: 'Designer focused on clarity, accessibility, and the active product surface.' }
    }
    if (agent.role === 'peer_engineer') {
      return { message: 'I’ve added that to the engineering context. Please include the reproduction, affected surface, and the test that gives us confidence before handing this off.', reasoningSummary: 'Peer engineer requested implementation evidence for collaboration.' }
    }
    if (text.includes('canmanagebilling') || text.includes('billing') || text.includes('guard')) {
      return { message: 'Yes — use the existing canManageBilling guard. Preserve the explanatory empty state when the CTA is unavailable, then run the contract check and include that validation in your PR response.', reasoningSummary: 'Tech lead recognized the legacy billing-role constraint and connected it to the review workflow.' }
    }
    return { message: `I saw your update. The next organization gate is ${context.workflow.checksPassed ? context.workflow.pullRequestOpened ? context.workflow.reviewAddressed ? 'a clear review response with the validation you ran.' : 'addressing the review comment.' : 'opening the pull request for team review.' : 'running the branch checks before you commit.'} Keep your assumptions visible so the rest of the team can act on them.`, reasoningSummary: 'Tech lead used recent workflow state to identify the next collaboration action.' }
  }
}
