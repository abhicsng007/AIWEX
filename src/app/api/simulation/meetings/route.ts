import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { deriveOnboardingState } from '@/features/simulator/domain/onboarding'
import {
  deriveMeetingSessions,
  expressionForMeetingText,
  isOpeningComplete,
  meetingDefinitions,
  meetingOpeningScript,
  nextOpeningScriptLine,
} from '@/features/simulator/domain/meetings'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { createAgentTurn } from '@/features/simulator/server/agents/orchestrator'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

const append = (organizationId: string, type: SimulationEvent['type'], metadata: Record<string, string | number | boolean>) => inMemoryEventStore.append({
  id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata,
})

const meetingFor = (meetingId?: string) => meetingDefinitions.find((meeting) => meeting.id === meetingId)

type MeetingAction = 'start' | 'message' | 'agent_reply' | 'intro_next' | 'reaction' | 'end'

function payload(runId: string, meetingId: string) {
  return inMemoryEventStore.list(runId).then((events) => {
    const meetings = deriveMeetingSessions(events)
    const session = meetings.find((item) => item.id === meetingId)
    const meeting = meetingFor(meetingId)
    const introComplete = meeting && session ? isOpeningComplete(meeting, session.messages) : true
    const nextLine = meeting && session ? nextOpeningScriptLine(meeting, session.messages) : null
    return {
      meetings,
      introComplete,
      nextSpeakerId: nextLine?.authorId || null,
      floorSpeakerId: session?.messages.at(-1)?.authorId || null,
    }
  })
}

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const events = await inMemoryEventStore.list(identity.runId)
  if (deriveOnboardingState(events).phase !== 'qualified') return NextResponse.json({ error: 'Complete onboarding before joining team meetings.' }, { status: 409 })
  return NextResponse.json({ meetings: deriveMeetingSessions(events) })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; meetingId?: string; action?: MeetingAction; message?: string; reaction?: string }
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
      // Convener opens with a single turn; remaining opening lines are paced via intro_next.
      const opening = meetingOpeningScript(meeting)[0]
      if (opening) {
        await append(identity.runId, 'meeting_agent_replied', {
          meetingId: meeting.id,
          channelId: meeting.channelId,
          authorId: opening.authorId,
          message: opening.message,
          expression: opening.expression,
          scriptPhase: 'opening',
          scriptIndex: 0,
        })
      }
    }
  }

  if (body.action === 'intro_next') {
    if (!active || !session) return NextResponse.json({ error: 'Start the meeting before continuing the opening round.' }, { status: 409 })
    const next = nextOpeningScriptLine(meeting, session.messages)
    if (next) {
      const scriptIndex = meetingOpeningScript(meeting).findIndex((line) => line.authorId === next.authorId && line.message === next.message)
      await append(identity.runId, 'meeting_agent_replied', {
        meetingId: meeting.id,
        channelId: meeting.channelId,
        authorId: next.authorId,
        message: next.message,
        expression: next.expression,
        scriptPhase: 'opening',
        scriptIndex: scriptIndex < 0 ? session.messages.length : scriptIndex,
      })
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
        organizationId: identity.runId,
        channelId: meeting.channelId,
        userMessage: message,
        channelType: 'meeting',
        channelPurpose: meeting.title + '. Agenda: ' + meeting.agenda.join('; ') + '. Participants: ' + meeting.participantIds.join(', ') + '. Convener: ' + meeting.facilitatorId + '.',
        // Route @mentions to the tagged attendee; otherwise the convener holds the floor.
        allowedAgentIds: meeting.participantIds,
        fallbackAgentId: meeting.facilitatorId,
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

  const result = await payload(identity.runId, meeting.id)
  return NextResponse.json(result, { status: 201 })
}
