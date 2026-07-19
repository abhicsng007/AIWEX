import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { createAgentTurn } from '@/features/simulator/server/agents/orchestrator'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { deriveOnboardingState } from '@/features/simulator/domain/onboarding'

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; channelId?: string; userMessage?: string; channelType?: string; channelPurpose?: string; recentDecisions?: string[]; openFollowUps?: number }
  if (!body.channelId || !body.userMessage?.trim()) return NextResponse.json({ error: 'channelId and userMessage are required' }, { status: 400 })
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const events = await inMemoryEventStore.list(identity.runId)
  if (deriveOnboardingState(events).phase !== 'qualified') return NextResponse.json({ error: 'Complete onboarding before messaging AI teammates.' }, { status: 409 })
  let turn
  try { turn = await createAgentTurn({ organizationId: identity.runId, channelId: body.channelId, userMessage: body.userMessage.trim(), channelType: body.channelType, channelPurpose: body.channelPurpose, recentDecisions: body.recentDecisions, openFollowUps: body.openFollowUps }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No teammate can respond in this channel.' }, { status: 422 }) }
  const event = { id: crypto.randomUUID(), organizationId: identity.runId, type: 'agent_reply' as const, createdAt: new Date().toISOString(), metadata: { agentId: turn.agent.id, channelId: turn.channelId, message: turn.message, action: turn.action } }
  await inMemoryEventStore.append(event)
  return NextResponse.json({ turn, event }, { status: 201 })
}
