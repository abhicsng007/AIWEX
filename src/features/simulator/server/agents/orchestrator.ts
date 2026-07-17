import type { AgentTurn, OrganizationContext } from '@/features/simulator/domain/agents'
import { deriveWorkflowState } from '@/features/simulator/domain/workflow'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { RuleBasedTeamProvider } from './provider'
import { selectAgent } from './registry'

const provider = new RuleBasedTeamProvider()

export async function createAgentTurn(input: { organizationId: string; channelId: string; userMessage: string }): Promise<AgentTurn> {
  const events = await inMemoryEventStore.list(input.organizationId)
  const workflow = deriveWorkflowState(events)
  const context: OrganizationContext = {
    organizationId: input.organizationId,
    channelId: input.channelId,
    workflow,
    recentActions: events.slice(-8).map((event) => event.type),
  }
  const agent = selectAgent(input.channelId, input.userMessage)
  const response = await provider.createTurn({ agent, context, userMessage: input.userMessage })
  return {
    agent: { id: agent.id, name: agent.name, role: agent.role },
    action: 'post_message', channelId: input.channelId, message: response.message,
    dueAt: new Date(Date.now() + 700).toISOString(), reasoningSummary: response.reasoningSummary,
  }
}
