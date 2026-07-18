import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { deriveOnboardingState, simulationNow } from '@/features/simulator/domain/onboarding'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import type { SimulationEvent } from '@/features/simulator/domain/types'

const append = (organizationId: string, type: SimulationEvent['type'], metadata: Record<string, string | number | boolean> = {}): SimulationEvent => ({ id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata })

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
    const freshEvents = await inMemoryEventStore.list(organizationId)
    const fresh = deriveOnboardingState(freshEvents)
    const current = simulationNow(freshEvents)
    for (const item of fresh.schedule.filter((entry) => entry.kind === 'deadline' && !entry.completed && !entry.missed && Date.parse(entry.endsAt) < current.getTime())) {
      await inMemoryEventStore.append(append(organizationId, 'deadline_missed', { scheduleId: item.id }))
      const misses = deriveOnboardingState(await inMemoryEventStore.list(organizationId)).missedDeadlines
      if (misses > 2) await inMemoryEventStore.append(append(organizationId, 'reliability_penalty_applied', { scheduleId: item.id, points: 5, reason: 'deadline_missed_after_two_grace_events' }))
    }
  }
  const finalEvents = await inMemoryEventStore.list(organizationId)
  const nextState = deriveOnboardingState(finalEvents)
  return NextResponse.json({ schedule: nextState.schedule, missedDeadlines: nextState.missedDeadlines, penalties: nextState.penalties, simulationNow: simulationNow(finalEvents).toISOString() })
}
