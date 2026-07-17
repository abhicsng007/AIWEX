import { NextRequest, NextResponse } from 'next/server'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import type { SimulationEvent, SimulationEventType } from '@/features/simulator/domain/types'
import { deriveWorkflowState, validateWorkflowTransition } from '@/features/simulator/domain/workflow'

const allowedTypes = new Set<SimulationEventType>([
  'standup_posted', 'checks_passed', 'commit_created', 'pull_request_opened', 'review_addressed',
  'chat_message', 'agent_reply', 'review_reply', 'approval_granted', 'merge_rationale_recorded', 'pull_request_merged',
  'issue_created', 'issue_updated', 'simulation_time_advanced', 'team_space_created', 'team_space_updated',
  'chat_message_edited', 'chat_message_deleted', 'scenario_level_selected',
])

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  const events = await inMemoryEventStore.list(organizationId)
  return NextResponse.json({ events, workflow: deriveWorkflowState(events) })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<SimulationEvent>
  if (!body.organizationId || !body.type || !allowedTypes.has(body.type)) {
    return NextResponse.json({ error: 'organizationId and a valid type are required' }, { status: 400 })
  }
  const existingEvents = await inMemoryEventStore.list(body.organizationId)
  const transitionError = validateWorkflowTransition(deriveWorkflowState(existingEvents), body.type, body.metadata)
  if (transitionError) return NextResponse.json({ error: transitionError }, { status: 409 })
  const event: SimulationEvent = {
    id: crypto.randomUUID(), organizationId: body.organizationId, type: body.type,
    createdAt: new Date().toISOString(), metadata: body.metadata,
  }
  await inMemoryEventStore.append(event)
  const events = await inMemoryEventStore.list(body.organizationId)
  return NextResponse.json({ event, workflow: deriveWorkflowState(events) }, { status: 201 })
}
