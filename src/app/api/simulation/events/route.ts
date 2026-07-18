import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import type { SimulationEvent, SimulationEventType } from '@/features/simulator/domain/types'
import { deriveWorkflowState, validateWorkflowTransition } from '@/features/simulator/domain/workflow'
import { deriveScenarioProgression, scenarioLevelChangeError, taskCompletionError } from '@/features/simulator/domain/progression'
import { projectAccessError } from '@/features/simulator/domain/onboarding'

const allowedTypes = new Set<SimulationEventType>([
  'standup_posted', 'commit_created', 'pull_request_opened', 'review_addressed',
  'chat_message', 'agent_reply', 'review_reply', 'approval_granted', 'merge_rationale_recorded', 'pull_request_merged',
  'issue_created', 'issue_updated', 'simulation_time_advanced', 'team_space_created', 'team_space_updated',
  'chat_message_edited', 'chat_message_deleted', 'message_pinned', 'message_marked_decision', 'message_marked_risk',
  'message_marked_question', 'message_marked_handoff', 'message_marked_blocker', 'thread_resolved', 'followup_created',
  'followup_completed', 'space_archived', 'space_member_added', 'space_member_removed', 'scenario_level_selected', 'task_completed', 'level_unlocked',
  'load_test_recorded', 'scenario_deployment_recorded', 'workspace_revision_saved', 'agent_task_started',
  'agent_task_completed', 'agent_blocker_raised', 'agent_ceremony_scheduled', 'deadline_extension_decided',
])

function safeMetadata(value: unknown) {
  if (value === undefined) return { metadata: undefined as SimulationEvent['metadata'] | undefined }
  try {
    const serialized = JSON.stringify(value)
    if (serialized.length > 120_000) return { error: 'Event metadata is too large. Store source through the workspace revision endpoint.' }
    const parsed = JSON.parse(serialized) as SimulationEvent['metadata']
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return { error: 'Event metadata must be an object.' }
    return { metadata: parsed }
  } catch {
    return { error: 'Event metadata must be JSON serializable.' }
  }
}

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const events = await inMemoryEventStore.list(identity.runId)
  return NextResponse.json({ events, workflow: deriveWorkflowState(events), progression: deriveScenarioProgression(events), runId: identity.runId })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<SimulationEvent>
  if (!body.type || !allowedTypes.has(body.type)) return NextResponse.json({ error: 'A valid simulation event type is required.' }, { status: 400 })
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const metadataResult = safeMetadata(body.metadata)
  if ('error' in metadataResult) return NextResponse.json({ error: metadataResult.error }, { status: 400 })
  const existingEvents = await inMemoryEventStore.list(identity.runId)
  const transitionError = validateWorkflowTransition(deriveWorkflowState(existingEvents), body.type, metadataResult.metadata)
  if (transitionError) return NextResponse.json({ error: transitionError }, { status: 409 })
  const onboardingError = projectAccessError(existingEvents, body.type)
  if (onboardingError) return NextResponse.json({ error: onboardingError }, { status: 409 })
  if (body.type === 'scenario_level_selected') {
    const level = metadataResult.metadata?.level
    if (level !== 'basic' && level !== 'intermediate' && level !== 'advanced') return NextResponse.json({ error: 'A valid scenario level is required.' }, { status: 400 })
    const progressionError = scenarioLevelChangeError(existingEvents, level)
    if (progressionError) return NextResponse.json({ error: progressionError, progression: deriveScenarioProgression(existingEvents) }, { status: 409 })
  }
  if (body.type === 'task_completed') {
    const completionError = taskCompletionError(existingEvents, metadataResult.metadata)
    if (completionError) return NextResponse.json({ error: completionError }, { status: 409 })
  }
  const event: SimulationEvent = { id: crypto.randomUUID(), organizationId: identity.runId, type: body.type, createdAt: new Date().toISOString(), metadata: metadataResult.metadata }
  await inMemoryEventStore.append(event)
  const events = await inMemoryEventStore.list(identity.runId)
  const progression = deriveScenarioProgression(events)
  const unlock = progression.nextLevel && progression.requirements.every((item) => item.complete) && !events.some((item) => item.type === 'level_unlocked' && item.metadata?.level === progression.nextLevel)
    ? { id: crypto.randomUUID(), organizationId: identity.runId, type: 'level_unlocked' as const, createdAt: new Date().toISOString(), metadata: { level: progression.nextLevel, unlockedFrom: progression.currentLevel, overallScore: progression.overallScore } }
    : null
  if (unlock) await inMemoryEventStore.append(unlock)
  const finalEvents = unlock ? [...events, unlock] : events
  return NextResponse.json({ event, unlock, workflow: deriveWorkflowState(finalEvents), progression: deriveScenarioProgression(finalEvents) }, { status: 201 })
}
