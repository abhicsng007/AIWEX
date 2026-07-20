import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { deriveOnboardingState } from '@/features/simulator/domain/onboarding'
import { deriveMeetingSessions, expressionForMeetingText, meetingDefinitions } from '@/features/simulator/domain/meetings'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { createAgentTurn } from '@/features/simulator/server/agents/orchestrator'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

const append = (organizationId: string, type: SimulationEvent['type'], metadata: Record<string, string | number | boolean>) => inMemoryEventStore.append({
  id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata,
})

const meetingFor = (meetingId?: string) => meetingDefinitions.find((meeting) => meeting.id === meetingId)

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const events = await inMemoryEventStore.list(identity.runId)
  if (deriveOnboardingState(events).phase !== 'qualified') return NextResponse.json({ error: 'Complete onboarding before joining team meetings.' }, { status: 409 })
  return NextResponse.json({ meetings: deriveMeetingSessions(events) })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; meetingId?: string; action?: 'start' | 'message' | 'agent_reply' | 'reaction' | 'end'; message?: string; reaction?: string }
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const meeting = meetingFor(body.meetingId)
  if (!body.action || !meeting) return NextResponse.json({ error: 'A valid meeting and meeting action are required.' }, { status: 400 })
  let events = await inMemoryEventStore.list(identity.runId)
  if (deriveOnboardingState(events).phase !== 'qualified') return NextResponse.json({ error: 'Complete onboarding before joining team meetings.' }, { status: 409 })
  const session = deriveMeetingSessions(events).find((item) => item.id === meeting.id)
  const active = Boolean(session?.startedAt && !session.endedAt)

  if (body.action === 'start') {
    if (!active) {
      await append(identity.runId, 'meeting_started', { meetingId: meeting.id, scheduleId: meeting.scheduleId, channelId: meeting.channelId })
      // First-day manager check-in is the introduction ceremony after onboarding.
      if (meeting.id === 'manager-checkin') {
        const introSequence: Array<{ authorId: string; message: string; expression: string }> = [
          { authorId: 'marcus', message: 'Welcome to SignalDesk, Alex. This is our first working check-in — introduce yourself, then we will agree how we collaborate.', expression: 'happy' },
          { authorId: 'maya', message: 'Hi Alex. I own product outcomes for usage alerts. Bring me context early when a change could affect what we ship.', expression: 'speaking' },
          { authorId: 'noah', message: 'Welcome. Keep assumptions written down, cover legacy behavior with tests, and use the PR to explain why a change is safe.', expression: 'speaking' },
          { authorId: 'devon', message: 'I surface integration risks directly. A useful handoff includes the reproduction, affected surface, and the test that creates confidence.', expression: 'speaking' },
          { authorId: 'marcus', message: 'Your turn, Alex. Introduce yourself, say what you want to learn, and ask one initial question before we return to scheduled work.', expression: 'thinking' },
        ]
        for (const item of introSequence) {
          await append(identity.runId, 'meeting_agent_replied', {
            meetingId: meeting.id, channelId: meeting.channelId, authorId: item.authorId, message: item.message, expression: item.expression,
          })
        }
      } else {
        const facilitator = meeting.facilitatorId
        await append(identity.runId, 'meeting_agent_replied', {
          meetingId: meeting.id, channelId: meeting.channelId, authorId: facilitator,
          message: 'Welcome, everyone. Let us keep this focused: share the decision or risk you need help with, then we will agree a clear next step.',
          expression: 'happy',
        })
      }
    }
  }

  // Persist the learner message immediately so dialogue bubbles/transcript update without waiting on the agent.
  if (body.action === 'message') {
    const message = body.message?.trim().slice(0, 900)
    if (!message) return NextResponse.json({ error: 'Write a message before sending it to the room.' }, { status: 400 })
    if (!active) return NextResponse.json({ error: 'Start the meeting before sending a message.' }, { status: 409 })
    await append(identity.runId, 'meeting_message_posted', {
      meetingId: meeting.id, channelId: meeting.channelId, authorId: 'you', message, expression: expressionForMeetingText(message),
    })
  }

  // Agent reply is a separate step so the room can show the learner bubble first (same pattern as team spaces).
  if (body.action === 'agent_reply') {
    const message = body.message?.trim().slice(0, 900)
    if (!message) return NextResponse.json({ error: 'A meeting message is required before requesting a teammate reply.' }, { status: 400 })
    if (!active) return NextResponse.json({ error: 'Start the meeting before requesting a teammate reply.' }, { status: 409 })
    try {
      const turn = await createAgentTurn({
        organizationId: identity.runId, channelId: meeting.channelId, userMessage: message,
        channelType: 'meeting', channelPurpose: meeting.title + '. Agenda: ' + meeting.agenda.join('; '),
      })
      await append(identity.runId, 'meeting_agent_replied', {
        meetingId: meeting.id, channelId: meeting.channelId, authorId: turn.agent.id, message: turn.message, expression: expressionForMeetingText(turn.message),
      })
    } catch {
      await append(identity.runId, 'meeting_agent_replied', {
        meetingId: meeting.id, channelId: meeting.channelId, authorId: meeting.facilitatorId,
        message: 'I have captured that point. Let us name the owner, the evidence needed, and the next check-in before we close this item.', expression: 'thinking',
      })
    }
  }

  if (body.action === 'reaction') {
    const reaction = body.reaction === 'question' || body.reaction === 'concern' || body.reaction === 'thumbs_up' ? body.reaction : null
    if (!reaction) return NextResponse.json({ error: 'Choose a valid meeting reaction.' }, { status: 400 })
    if (!active) return NextResponse.json({ error: 'Start the meeting before adding a reaction.' }, { status: 409 })
    await append(identity.runId, 'meeting_reaction_added', { meetingId: meeting.id, authorId: 'you', reaction })
  }

  if (body.action === 'end') {
    if (!active) return NextResponse.json({ error: 'This meeting is not currently active.' }, { status: 409 })
    await append(identity.runId, 'meeting_decision_recorded', { meetingId: meeting.id, channelId: meeting.channelId, summary: 'Meeting closed with working context and next steps recorded.' })
    await append(identity.runId, 'meeting_ended', { meetingId: meeting.id, channelId: meeting.channelId })
  }

  events = await inMemoryEventStore.list(identity.runId)
  return NextResponse.json({ meetings: deriveMeetingSessions(events) }, { status: 201 })
}
