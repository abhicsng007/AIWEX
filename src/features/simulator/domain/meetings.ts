import type { SimulationEvent } from './types'

export type MeetingExpression = 'neutral' | 'speaking' | 'thinking' | 'concerned' | 'happy'

export type MeetingDefinition = {
  id: string
  scheduleId: string
  title: string
  channelId: string
  facilitatorId: string
  participantIds: string[]
  agenda: string[]
}

export type MeetingMessage = {
  id: string
  meetingId: string
  authorId: string
  text: string
  createdAt: string
  expression: MeetingExpression
}

export type MeetingSession = MeetingDefinition & {
  startedAt: string | null
  endedAt: string | null
  messages: MeetingMessage[]
  reactions: Partial<Record<string, string>>
}

export const meetingDefinitions: MeetingDefinition[] = [
  {
    id: 'manager-checkin',
    scheduleId: 'manager-checkin-day-1',
    title: 'Manager check-in and working agreement',
    channelId: 'product-usage',
    facilitatorId: 'marcus',
    participantIds: ['marcus', 'maya', 'noah', 'devon'],
    agenda: ['Set working agreements', 'Align on the usage-alerts outcome', 'Surface one dependency or learning goal'],
  },
  {
    id: 'implementation-review',
    scheduleId: 'review-window',
    title: 'Implementation review - PR #482',
    channelId: 'engineering',
    facilitatorId: 'noah',
    participantIds: ['noah', 'devon', 'adele', 'maya'],
    agenda: ['Review the role boundary', 'Check the legacy empty state', 'Agree validation and review follow-up'],
  },
  {
    id: 'release-readiness',
    scheduleId: 'release-check',
    title: 'Release readiness check',
    channelId: 'releases',
    facilitatorId: 'marcus',
    participantIds: ['marcus', 'maya', 'noah', 'devon'],
    agenda: ['Confirm customer impact', 'Review validation and release risk', 'Assign rollout ownership'],
  },
  {
    id: 'sprint-retro',
    scheduleId: 'retro-day-3',
    title: 'Sprint retro and next-task planning',
    channelId: 'product-usage',
    facilitatorId: 'maya',
    participantIds: ['maya', 'noah', 'adele', 'devon'],
    agenda: ['Reflect on delivery evidence', 'Capture one improvement', 'Plan the next smallest safe task'],
  },
]

export function meetingForSchedule(scheduleId: string) {
  return meetingDefinitions.find((meeting) => meeting.scheduleId === scheduleId)
}

export function expressionForMeetingText(text: string): MeetingExpression {
  const normalized = text.toLowerCase()
  if (/(blocker|blocked|risk|concern|deadline|incident)/.test(normalized)) return 'concerned'
  if (/(approve|great|thanks|ready|ship|complete)/.test(normalized)) return 'happy'
  if (/(question|clarify|how|why|what)/.test(normalized)) return 'thinking'
  return 'speaking'
}

export function deriveMeetingSessions(events: SimulationEvent[]): MeetingSession[] {
  const eventMetadata = (type: SimulationEvent['type']) => events.filter((event) => event.type === type).map((event) => ({ event, metadata: event.metadata || {} }))
  const starts = eventMetadata('meeting_started')
  const ends = eventMetadata('meeting_ended')
  const reactions = eventMetadata('meeting_reaction_added')
  const messageEvents = [...eventMetadata('meeting_message_posted'), ...eventMetadata('meeting_agent_replied')]
  return meetingDefinitions.map((meeting) => {
    const started = starts.filter(({ metadata }) => metadata.meetingId === meeting.id).at(-1)?.event
    const ended = ends.filter(({ metadata }) => metadata.meetingId === meeting.id).at(-1)?.event
    const messages = messageEvents
      .filter(({ event, metadata }) => metadata.meetingId === meeting.id && (!started || event.createdAt >= started.createdAt) && typeof metadata.message === 'string' && typeof metadata.authorId === 'string')
      .sort((left, right) => left.event.createdAt.localeCompare(right.event.createdAt))
      .map(({ event, metadata }) => ({
        id: event.id,
        meetingId: meeting.id,
        authorId: String(metadata.authorId),
        text: String(metadata.message),
        createdAt: event.createdAt,
        expression: metadata.expression === 'thinking' || metadata.expression === 'concerned' || metadata.expression === 'happy' || metadata.expression === 'neutral' ? metadata.expression : 'speaking' as MeetingExpression,
      }))
    const latestReactions = reactions
      .filter(({ metadata }) => metadata.meetingId === meeting.id && typeof metadata.authorId === 'string' && typeof metadata.reaction === 'string')
      .reduce<Partial<Record<string, string>>>((all, { metadata }) => ({ ...all, [String(metadata.authorId)]: String(metadata.reaction) }), {})
    const endedAfterStart = Boolean(started && ended && ended.createdAt >= started.createdAt)
    return { ...meeting, startedAt: started?.createdAt || null, endedAt: endedAfterStart ? ended?.createdAt || null : null, messages, reactions: latestReactions }
  })
}
