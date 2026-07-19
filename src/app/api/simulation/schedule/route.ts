import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { deriveOnboardingState, scheduleCompletionError, simulationNow } from '@/features/simulator/domain/onboarding'
import type { FollowUpRequirement } from '@/features/simulator/domain/accountability'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { releaseSimulationWork } from '@/features/simulator/server/simulation-director'
import type { SimulationEvent } from '@/features/simulator/domain/types'

const append = (organizationId: string, type: SimulationEvent['type'], metadata: SimulationEvent['metadata'] = {}): SimulationEvent => ({ id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata })

function requirementForSchedule(itemId: string): FollowUpRequirement {
  if (itemId === 'manager-checkin-day-1') return 'standup'
  if (itemId === 'focus-proj-184') return 'checks'
  if (itemId === 'review-window' || itemId === 'deadline-proj-184') return 'pull_request'
  if (itemId === 'release-check') return 'merge'
  return 'recovery_plan'
}

async function recordCompletionFollowUp(organizationId: string, events: SimulationEvent[], scheduleId: string, title: string, requirement: FollowUpRequirement) {
  const trigger = `schedule-evidence-${scheduleId}`
  if (events.some((event) => event.type === 'agent_reply' && event.metadata?.trigger === trigger)) return
  const reply = append(organizationId, 'agent_reply', { agentId: 'maya', channelId: scheduleId.includes('deadline') ? 'releases' : 'product-usage', trigger, action: 'raise_blocker', message: `@alex, I cannot record "${title}" as complete without the required delivery evidence. Complete the work or post a recovery plan with the impact and next commitment.` })
  const followUp = { id: `followup-${trigger}`, sourceMessageId: Date.parse(reply.createdAt) + 1, title: `Provide completion evidence for ${title}`, ownerId: 'you', status: 'open' as const, createdAt: reply.createdAt }
  const tracked = append(organizationId, 'followup_created', { followUpId: followUp.id, messageId: followUp.sourceMessageId, spaceId: reply.metadata?.channelId, ownerId: 'you', requirement, followUp })
  await inMemoryEventStore.append(reply)
  await inMemoryEventStore.append(tracked)
}

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const events = await inMemoryEventStore.list(identity.runId)
  const state = deriveOnboardingState(events)
  return NextResponse.json({ schedule: state.schedule, missedDeadlines: state.missedDeadlines, penalties: state.penalties, qualified: state.phase === 'qualified', simulationNow: simulationNow(events).toISOString() })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; action?: 'complete' | 'request_extension' | 'check_deadlines'; scheduleId?: string }
  if (!body.action) return NextResponse.json({ error: 'A schedule action is required.' }, { status: 400 })
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const organizationId = identity.runId
  const events = await inMemoryEventStore.list(organizationId)
  const state = deriveOnboardingState(events)
  if (state.phase !== 'qualified') return NextResponse.json({ error: 'Pass onboarding before using the work calendar.' }, { status: 409 })
  const scheduleItem = body.scheduleId ? state.schedule.find((item) => item.id === body.scheduleId) : undefined
  if (body.action !== 'check_deadlines' && !scheduleItem) return NextResponse.json({ error: 'A valid schedule event is required.' }, { status: 400 })
  const now = simulationNow(events)
  if (body.action === 'complete' && scheduleItem) {
    if (scheduleItem.missed) return NextResponse.json({ error: 'This schedule item has already been missed.' }, { status: 409 })
    if (now.getTime() < Date.parse(scheduleItem.startsAt)) return NextResponse.json({ error: 'This work block has not started yet.' }, { status: 409 })
    if (now.getTime() > Date.parse(scheduleItem.endsAt)) return NextResponse.json({ error: 'This work block has ended. Record a recovery plan instead.' }, { status: 409 })
    const evidenceError = scheduleCompletionError(scheduleItem, events)
    if (evidenceError) {
      await recordCompletionFollowUp(organizationId, events, scheduleItem.id, scheduleItem.title, requirementForSchedule(scheduleItem.id))
      return NextResponse.json({ error: evidenceError }, { status: 409 })
    }
    await inMemoryEventStore.append(append(organizationId, 'schedule_event_completed', { scheduleId: scheduleItem.id }))
  }
  if (body.action === 'request_extension' && scheduleItem) {
    if (scheduleItem.kind !== 'deadline' || scheduleItem.completed || scheduleItem.missed || scheduleItem.extensionDecision === 'approved') return NextResponse.json({ error: 'This deadline cannot be rescheduled.' }, { status: 409 })
    if (now.getTime() < Date.parse(scheduleItem.startsAt)) return NextResponse.json({ error: 'Request a reschedule after the deadline work has started.' }, { status: 409 })
    await inMemoryEventStore.append(append(organizationId, 'deadline_extension_requested', { scheduleId: scheduleItem.id }))
    const endsAt = new Date(Date.parse(scheduleItem.endsAt) + 2 * 3_600_000).toISOString()
    await inMemoryEventStore.append(append(organizationId, 'deadline_extension_decided', { scheduleId: scheduleItem.id, decision: 'approved', endsAt }))
    await inMemoryEventStore.append(append(organizationId, 'agent_reply', { agentId: 'marcus', channelId: 'releases', trigger: `extension-${scheduleItem.id}`, message: `I approved a two-hour recovery window for ${scheduleItem.title}. Post the revised plan and the risk you are containing.` }))
  }
  if (body.action === 'check_deadlines') {
    await releaseSimulationWork(organizationId)
  }
  const finalEvents = await inMemoryEventStore.list(organizationId)
  const nextState = deriveOnboardingState(finalEvents)
  return NextResponse.json({ schedule: nextState.schedule, missedDeadlines: nextState.missedDeadlines, penalties: nextState.penalties, simulationNow: simulationNow(finalEvents).toISOString() })
}
