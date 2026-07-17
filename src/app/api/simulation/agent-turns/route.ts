import { NextRequest, NextResponse } from 'next/server'
import { createAgentTurn } from '@/features/simulator/server/agents/orchestrator'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; channelId?: string; userMessage?: string }
  if (!body.organizationId || !body.channelId || !body.userMessage?.trim()) return NextResponse.json({ error: 'organizationId, channelId, and userMessage are required' }, { status: 400 })
  const turn = await createAgentTurn({ organizationId: body.organizationId, channelId: body.channelId, userMessage: body.userMessage.trim() })
  await inMemoryEventStore.append({ id: crypto.randomUUID(), organizationId: body.organizationId, type: 'agent_reply', createdAt: new Date().toISOString(), metadata: { agentId: turn.agent.id, channelId: turn.channelId, message: turn.message, action: turn.action } })
  return NextResponse.json({ turn }, { status: 201 })
}
