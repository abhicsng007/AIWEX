import type { AgentTurn, OrganizationContext } from '@/features/simulator/domain/agents'
import { deriveWorkflowState } from '@/features/simulator/domain/workflow'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { scenarioLevelFromEvents } from '@/features/simulator/domain/difficulty'
import { createConfiguredTeamProvider } from './provider'
import { selectAgent } from './registry'

const provider = createConfiguredTeamProvider()

export async function createAgentTurn(input: { organizationId: string; channelId: string; userMessage: string; channelType?: string; channelPurpose?: string; recentDecisions?: string[]; openFollowUps?: number }): Promise<AgentTurn> {
  const events = await inMemoryEventStore.list(input.organizationId)
  const workflow = deriveWorkflowState(events)
  const context: OrganizationContext = {
    organizationId: input.organizationId,
    channelId: input.channelId,
    workflow,
    recentActions: events.slice(-8).map((event) => event.type),
    scenarioLevel: scenarioLevelFromEvents(events),
    channelType: input.channelType,
    channelPurpose: input.channelPurpose,
    recentDecisions: input.recentDecisions,
    openFollowUps: input.openFollowUps,
  }
  const agent = selectAgent(input.channelId, input.userMessage)
  const response = await provider.createTurn({ agent, context, userMessage: input.userMessage })
  const action = /review|approve|validation|test/.test(input.userMessage.toLowerCase()) && agent.permittedActions.includes('request_review')
    ? 'request_review'
    : /blocker|blocked|escalat/.test(input.userMessage.toLowerCase()) && agent.permittedActions.includes('raise_blocker')
      ? 'raise_blocker'
      : 'post_message'
  return {
    agent: { id: agent.id, name: agent.name, role: agent.role },
    action, channelId: input.channelId, message: response.message,
    dueAt: new Date(Date.now() + 700).toISOString(), reasoningSummary: response.reasoningSummary,
  }
}
