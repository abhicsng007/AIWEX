import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { deriveOnboardingState } from '@/features/simulator/domain/onboarding'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import type { SimulationEvent } from '@/features/simulator/domain/types'

const channelId = 'product-usage'
const append = (organizationId: string, type: SimulationEvent['type'], metadata: Record<string, string | number | boolean> = {}): SimulationEvent => ({ id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata })
const reply = (organizationId: string, agentId: string, message: string) => append(organizationId, 'agent_reply', { agentId, channelId, message, trigger: 'team-welcome' })

function state(events: SimulationEvent[]) {
  return { started: events.some((event) => event.type === 'team_welcome_started'), introduced: events.some((event) => event.type === 'learner_introduction_posted'), concluded: events.some((event) => event.type === 'team_welcome_concluded') }
}

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  return NextResponse.json({ state: state(await inMemoryEventStore.list(identity.runId)) })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; action?: 'start' | 'introduce'; introduction?: string }
  if (!body.action) return NextResponse.json({ error: 'A welcome action is required.' }, { status: 400 })
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const organizationId = identity.runId
  const events = await inMemoryEventStore.list(organizationId)
  if (deriveOnboardingState(events).phase !== 'qualified') return NextResponse.json({ error: 'Pass onboarding before joining Team Spaces.' }, { status: 409 })
  const welcome = state(events)
  if (body.action === 'start' && !welcome.started) {
    const sequence = [
      append(organizationId, 'team_welcome_started', { channelId }),
      reply(organizationId, 'marcus', 'Welcome to SignalDesk, @alex. I care about clear ownership, sustainable delivery, and asking for help before a small risk becomes a larger one.'),
      reply(organizationId, 'maya', 'Hi Alex. I protect the customer outcome and make scope trade-offs visible, so bring me context early when a change could affect what we ship.'),
      reply(organizationId, 'noah', 'Welcome. Keep assumptions written down, cover legacy behavior with tests, and use the PR to explain why a change is safe.'),
      reply(organizationId, 'adele', 'Glad you are here. I focus on clear customer states, especially when a user cannot take the obvious action.'),
      reply(organizationId, 'devon', 'I will surface integration risks directly. A useful handoff includes the reproduction, affected surface, and the test that creates confidence.'),
      reply(organizationId, 'marcus', 'Your turn, Alex. Introduce yourself, say what you want to learn, and ask one initial question before we return to scheduled work.'),
    ]
    for (const event of sequence) await inMemoryEventStore.append(event)
  }
  if (body.action === 'introduce') {
    if (!welcome.started || welcome.introduced) return NextResponse.json({ error: 'The introduction ceremony is not ready for another learner introduction.' }, { status: 409 })
    const introduction = String(body.introduction || '').trim()
    if (introduction.length < 45) return NextResponse.json({ error: 'Write at least 45 characters so the team has a meaningful introduction.' }, { status: 400 })
    await inMemoryEventStore.append(append(organizationId, 'chat_message', { channelId, message: introduction, ceremony: true }))
    await inMemoryEventStore.append(append(organizationId, 'learner_introduction_posted', { channelId }))
    await inMemoryEventStore.append(reply(organizationId, 'marcus', 'Thanks, Alex. Ask when context is missing; nobody expects you to guess. Keep your next handoff and calendar risk visible.'))
    await inMemoryEventStore.append(append(organizationId, 'team_welcome_concluded', { channelId }))
  }
  return NextResponse.json({ state: state(await inMemoryEventStore.list(organizationId)) }, { status: 201 })
}
