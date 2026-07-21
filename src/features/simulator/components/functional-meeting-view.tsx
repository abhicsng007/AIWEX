'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, CircleAlert, CircleHelp, Clock3, Maximize2, MessageSquare, Play, Send, Square, ThumbsUp, UsersRound, X } from 'lucide-react'
import { parseAddressedAgentId } from '@/features/simulator/domain/agents'
import { agentPortfolios } from '@/features/simulator/domain/agent-profiles'
import {
  expressionForMeetingText,
  isOpeningComplete,
  nextOpeningScriptLine,
  type MeetingExpression,
  type MeetingMessage,
  type MeetingSession,
} from '@/features/simulator/domain/meetings'

type MeetingResponse = {
  meetings?: MeetingSession[]
  introComplete?: boolean
  nextSpeakerId?: string | null
  floorSpeakerId?: string | null
  error?: string
}
type MeetingAction = 'start' | 'message' | 'agent_reply' | 'intro_next' | 'reaction' | 'end'

type Props = {
  organizationId: string
  selectedMeetingId: string | null
  onMeetingSelected: (meetingId: string) => void
  /** When true, start the selected meeting once it is loaded (used after onboarding). */
  autoStart?: boolean
  onAutoStarted?: () => void
}

const reactionIcons = { thumbs_up: '👍', question: '❓', concern: '⚠️' }
const expressionFaces: Record<MeetingExpression, string> = { neutral: '•‿•', speaking: '◉‿◉', thinking: '◔_◔', concerned: '◕︵◕', happy: '◕‿◕' }
const OPENING_TURN_MS = 1700

function participant(id: string) {
  if (id === 'you') return { id: 'you', name: 'Alex Morgan', initials: 'A', role: 'Full-stack Engineer', tone: 'blue' as const }
  return agentPortfolios[id] || agentPortfolios.noah
}

function timeLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'now' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function wait(ms: number) {
  return new Promise<void>((resolve) => { window.setTimeout(resolve, ms) })
}

/** Who should show the thinking bubble for this message (tagged person, else convener). */
function resolveReplyTargetId(message: string, meeting: MeetingSession) {
  const candidates = meeting.participantIds.map((id) => {
    const profile = agentPortfolios[id]
    return { id, name: profile?.name || id }
  })
  return parseAddressedAgentId(message, candidates) || meeting.facilitatorId
}

export default function FunctionalMeetingView({ organizationId, selectedMeetingId, onMeetingSelected, autoStart = false, onAutoStarted }: Props) {
  const [meetings, setMeetings] = useState<MeetingSession[]>([])
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [awaitingAgent, setAwaitingAgent] = useState(false)
  const [convening, setConvening] = useState(false)
  const [upcomingSpeakerId, setUpcomingSpeakerId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [autoStartAttempted, setAutoStartAttempted] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [roomMenuOpen, setRoomMenuOpen] = useState(false)
  const openingRunId = useRef(0)
  const openingActiveRef = useRef(false)
  const roomMenuRef = useRef<HTMLDivElement | null>(null)

  const refresh = async () => {
    try {
      const response = await fetch('/api/simulation/meetings?organizationId=' + encodeURIComponent(organizationId), { cache: 'no-store' })
      const data = await response.json() as MeetingResponse
      if (!response.ok) { setNotice(data.error || 'Meetings are unavailable right now.'); return }
      setMeetings(data.meetings || [])
    } catch { setNotice('Meetings are unavailable right now.') }
  }

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 15_000)
    return () => window.clearInterval(timer)
  }, [organizationId])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('meeting-stage-open')
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (roomMenuOpen) setRoomMenuOpen(false)
        else setExpanded(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.classList.remove('meeting-stage-open')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [expanded, roomMenuOpen])

  useEffect(() => {
    if (!roomMenuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!roomMenuRef.current?.contains(event.target as Node)) setRoomMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [roomMenuOpen])

  useEffect(() => {
    if (autoStart) setAutoStartAttempted(false)
  }, [autoStart, selectedMeetingId])

  const meeting = meetings.find((item) => item.id === selectedMeetingId) || meetings[0]
  const live = Boolean(meeting?.startedAt && !meeting.endedAt)
  const attendeeIds = useMemo(() => meeting ? [...meeting.participantIds, 'you'] : [], [meeting])
  const floorMessage = meeting?.messages.at(-1) || null
  const typingSpeakerId = upcomingSpeakerId || (awaitingAgent ? meeting?.facilitatorId || null : null)
  const floorSpeakerId = typingSpeakerId || floorMessage?.authorId || null

  const update = async (action: MeetingAction, extra: Record<string, string> = {}, options: { managePending?: boolean } = {}) => {
    if (!meeting) return null
    const managePending = options.managePending !== false
    if (managePending) {
      setPending(true)
      setNotice('')
    }
    try {
      const response = await fetch('/api/simulation/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, meetingId: meeting.id, action, ...extra }),
      })
      const data = await response.json() as MeetingResponse
      if (!response.ok) {
        setNotice(data.error || 'The meeting could not be updated.')
        return null
      }
      setMeetings(data.meetings || [])
      if (action === 'start') {
        setNotice(meeting.id === 'manager-checkin'
          ? 'Marcus is convening the introduction. Wait for your turn, then introduce yourself.'
          : 'Meeting started. The convener has the floor — share an update when you are ready.')
      }
      if (action === 'end') setNotice('Meeting ended. The working context and next-step record were saved.')
      return data
    } catch {
      setNotice('The meeting could not be updated. Please try again.')
      return null
    } finally {
      if (managePending) setPending(false)
    }
  }

  const playOpeningRound = async (currentMeetingId: string) => {
    if (openingActiveRef.current) return
    openingActiveRef.current = true
    const runId = ++openingRunId.current
    setConvening(true)
    try {
      // Pace remaining opening turns after the convener's first line.
      while (openingRunId.current === runId) {
        const response = await fetch('/api/simulation/meetings?organizationId=' + encodeURIComponent(organizationId), { cache: 'no-store' })
        const data = await response.json() as MeetingResponse
        if (response.ok && data.meetings) setMeetings(data.meetings)
        const current = (data.meetings || []).find((item) => item.id === currentMeetingId) || null
        if (!current || current.endedAt) break
        const next = nextOpeningScriptLine(current, current.messages)
        if (!next) break

        setUpcomingSpeakerId(next.authorId)
        await wait(OPENING_TURN_MS)
        if (openingRunId.current !== runId) break

        const advanced = await update('intro_next', {}, { managePending: false })
        setUpcomingSpeakerId(null)
        if (!advanced) break
        if (advanced.introComplete) break
      }

      if (openingRunId.current === runId) {
        setNotice((current) => current || 'Floor is open. Speak when ready — the room will respond in turn.')
      }
    } finally {
      if (openingRunId.current === runId) {
        setUpcomingSpeakerId(null)
        setConvening(false)
      }
      openingActiveRef.current = false
    }
  }

  const startMeeting = async () => {
    const data = await update('start')
    if (!data) return false
    const session = data.meetings?.find((item) => item.id === meeting?.id)
    if (session && !isOpeningComplete(session, session.messages)) {
      void playOpeningRound(session.id)
    }
    return true
  }

  // After onboarding, open and start the manager check-in introduction automatically.
  useEffect(() => {
    if (!autoStart || autoStartAttempted || !meeting || pending || convening) return
    if (selectedMeetingId && meeting.id !== selectedMeetingId) return
    if (meeting.startedAt || meeting.endedAt) {
      if (meeting.startedAt && !meeting.endedAt && !isOpeningComplete(meeting, meeting.messages)) {
        setAutoStartAttempted(true)
        void playOpeningRound(meeting.id)
      }
      onAutoStarted?.()
      return
    }
    setAutoStartAttempted(true)
    void (async () => {
      const started = await startMeeting()
      if (started) onAutoStarted?.()
      else setAutoStartAttempted(false)
    })()
  }, [autoStart, autoStartAttempted, meeting?.id, meeting?.startedAt, meeting?.endedAt, selectedMeetingId, pending, convening])

  // Resume paced opening if the learner refreshes mid-round.
  useEffect(() => {
    if (!meeting?.startedAt || meeting.endedAt || convening || pending) return
    if (isOpeningComplete(meeting, meeting.messages)) return
    void playOpeningRound(meeting.id)
  }, [meeting?.id, meeting?.startedAt, meeting?.endedAt])

  const sendMessage = async () => {
    const message = draft.trim()
    if (!message || !meeting || pending || convening) return
    setDraft('')
    setNotice('')
    setPending(true)
    openingRunId.current += 1
    setConvening(false)
    setUpcomingSpeakerId(null)

    // Instant bubble + transcript, matching team-space chat behavior.
    const optimistic: MeetingMessage = {
      id: `local-${crypto.randomUUID()}`,
      meetingId: meeting.id,
      authorId: 'you',
      text: message,
      createdAt: new Date().toISOString(),
      expression: expressionForMeetingText(message),
    }
    setMeetings((items) => items.map((item) => item.id === meeting.id
      ? { ...item, messages: [...item.messages, optimistic] }
      : item))

    try {
      const saved = await update('message', { message }, { managePending: false })
      if (!saved) {
        setMeetings((items) => items.map((item) => item.id === meeting.id
          ? { ...item, messages: item.messages.filter((entry) => entry.id !== optimistic.id) }
          : item))
        return
      }

      // Teammate reply can take longer; show thinking on the tagged person (or convener).
      const replyTargetId = resolveReplyTargetId(message, meeting)
      setAwaitingAgent(true)
      setUpcomingSpeakerId(replyTargetId)
      await update('agent_reply', { message }, { managePending: false })
    } finally {
      setAwaitingAgent(false)
      setUpcomingSpeakerId(null)
      setPending(false)
    }
  }

  if (!meeting) return <div className="page meeting-page"><section className="meeting-empty card"><UsersRound size={22} /><h1>No team meetings are scheduled yet.</h1><p>Complete onboarding to activate the SignalDesk working calendar.</p></section></div>

  const statusLabel = convening
    ? 'Convener round'
    : live
      ? 'Live meeting'
      : meeting.endedAt
        ? 'Meeting complete'
        : 'Room ready'
  const convener = participant(meeting.facilitatorId)
  const canSpeak = live && !convening && !pending

  const renderOfficeScene = () => (
    <div className="office-scene" aria-label={'Conference room for ' + meeting.title}>
      <div className="office-window"><i /><i /><i /></div>
      <div className="office-art">SignalDesk</div>
      <div className="conference-table"><span>{meeting.title}</span></div>
      {floorSpeakerId && (
        <div className="meeting-floor-chip">
          <i />
          {awaitingAgent && upcomingSpeakerId
            ? `${participant(upcomingSpeakerId).name.split(' ')[0]} is responding`
            : upcomingSpeakerId
              ? `${participant(upcomingSpeakerId).name.split(' ')[0]} is about to speak`
              : `${participant(floorSpeakerId).name.split(' ')[0]} has the floor`}
        </div>
      )}
      {attendeeIds.map((id, index) => {
        const person = participant(id)
        const isTyping = typingSpeakerId === id
        const showBubble = Boolean(floorMessage && floorMessage.authorId === id && !isTyping)
        const isFloor = isTyping || showBubble || floorSpeakerId === id
        const expression = isTyping
          ? 'thinking'
          : showBubble
            ? (floorMessage?.expression || 'speaking')
            : (id === meeting.facilitatorId && convening ? 'thinking' : 'neutral')
        const reaction = meeting.reactions[id]
        return <article className={'meeting-seat seat-' + index + (isFloor ? ' is-speaking' : '')} key={id}>
          {isTyping
            ? <div className="dialogue-bubble dialogue-typing"><span>{convening ? 'Taking the floor…' : 'Thinking through a response…'}</span><small>{person.name.split(' ')[0]}</small></div>
            : showBubble && floorMessage && <div className="dialogue-bubble"><span>{floorMessage.text.slice(0, 170)}{floorMessage.text.length > 170 ? '...' : ''}</span><small>{floorMessage.authorId === 'you' ? 'You' : person.name.split(' ')[0]}</small></div>}
          <div className={'scene-avatar ' + person.tone + ' expression-' + expression}><span>{person.initials}</span><i>{expressionFaces[expression]}</i></div>
          {reaction && <em className="scene-reaction">{reactionIcons[reaction as keyof typeof reactionIcons]}</em>}
          <b>{id === 'you' ? 'You' : person.name.split(' ')[0]}{id === meeting.facilitatorId ? ' · Convener' : ''}</b>
          <small>{person.role}</small>
        </article>
      })}
    </div>
  )

  const renderRoomControls = () => (
    <div className="meeting-room-controls">
      {!live && !meeting.endedAt && <button className="primary-button" disabled={pending || convening} onClick={() => void startMeeting()}><Play size={15} /> Start meeting</button>}
      {live && <>
        <span className="meeting-convener-label"><UsersRound size={14} /> Convened by {convener.name.split(' ')[0]}</span>
        <button className="reaction-button" disabled={pending || convening} onClick={() => void update('reaction', { reaction: 'thumbs_up' })}><ThumbsUp size={15} /> Agree</button>
        <button className="reaction-button" disabled={pending || convening} onClick={() => void update('reaction', { reaction: 'question' })}><CircleHelp size={15} /> Clarify</button>
        <button className="reaction-button concern" disabled={pending || convening} onClick={() => void update('reaction', { reaction: 'concern' })}><CircleAlert size={15} /> Raise risk</button>
        <button className="end-meeting-button" disabled={pending || convening} onClick={() => void update('end')}><Square size={13} /> End meeting</button>
      </>}
      {meeting.endedAt && <span className="meeting-ended"><Check size={14} /> Working record saved</span>}
    </div>
  )

  const renderComposer = (compact = false) => live ? (
    <section className={'meeting-composer card' + (compact ? ' meeting-composer-room' : '')}>
      <div>
        <MessageSquare size={18} />
        <span>
          <b>{convening ? 'Waiting for the opening round' : 'Speak to the room'}</b>
          <small>
            {convening
              ? 'The convener is giving each teammate a turn. You will be invited when the floor opens.'
              : 'Your message becomes a dialogue bubble and is recorded in the meeting transcript.'}
          </small>
        </span>
      </div>
      <textarea
        value={draft}
        disabled={!canSpeak}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void sendMessage()
          }
        }}
        placeholder={convening ? 'Hold your message until the opening round finishes…' : 'Share an update, ask for a decision, or flag a risk...'}
      />
      <button className="primary-button" disabled={!canSpeak || !draft.trim()} onClick={() => void sendMessage()}><Send size={15} /> Send</button>
    </section>
  ) : null

  const renderAgenda = () => (
    <section className="card meeting-agenda">
      <span className="eyebrow">AGENDA</span>
      <h2>{meeting.title}</h2>
      <p className="meeting-agenda-convener">Convener: {convener.name}</p>
      <ol>{meeting.agenda.map((item) => <li key={item}><span>{item}</span></li>)}</ol>
    </section>
  )

  const renderTranscript = (limit = 12) => (
    <section className="card meeting-transcript">
      <div><span className="eyebrow">MEETING TRANSCRIPT</span><MessageSquare size={16} /></div>
      {meeting.messages.length
        ? meeting.messages.slice(-limit).map((message) => (
          <article key={message.id} className={floorMessage?.id === message.id ? 'is-floor' : ''}>
            <b>{message.authorId === 'you' ? 'You' : participant(message.authorId).name}{message.authorId === meeting.facilitatorId ? ' · Convener' : ''}</b>
            <span>{message.text}</span>
            <small>{timeLabel(message.createdAt)}</small>
          </article>
        ))
        : <p>Start the meeting to open the shared working transcript.</p>}
    </section>
  )

  const renderNotice = () => notice ? <p className="meeting-notice"><MessageSquare size={15} /> {notice}</p> : null

  const renderRoomSwitcher = () => (
    <div className={'meeting-stage-room-switch' + (roomMenuOpen ? ' open' : '')} ref={roomMenuRef}>
      <span className="meeting-stage-room-label">Room</span>
      <button
        type="button"
        className="meeting-stage-room-trigger"
        aria-haspopup="listbox"
        aria-expanded={roomMenuOpen}
        onClick={() => setRoomMenuOpen((value) => !value)}
      >
        <span>{meeting.title}</span>
        <ChevronDown size={14} />
      </button>
      {roomMenuOpen && (
        <ul className="meeting-stage-room-menu" role="listbox" aria-label="Switch meeting room">
          {meetings.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === meeting.id}
                className={item.id === meeting.id ? 'selected' : ''}
                onClick={() => {
                  openingRunId.current += 1
                  openingActiveRef.current = false
                  setConvening(false)
                  setUpcomingSpeakerId(null)
                  onMeetingSelected(item.id)
                  setRoomMenuOpen(false)
                }}
              >
                <b>{item.title}</b>
                <small>{item.startedAt && !item.endedAt ? 'Live now' : item.endedAt ? 'Completed' : 'Ready'}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const standaloneStage = (
    <div className="meeting-stage" role="dialog" aria-modal="true" aria-label={meeting.title + ' meeting stage'}>
      <header className="meeting-stage-top">
        <div className="meeting-stage-identity">
          <span className="eyebrow">SIGNALDESK MEETING</span>
          <h1>{meeting.title}</h1>
          <small>Convened by {convener.name} · #{meeting.channelId} · {attendeeIds.length} participants</small>
        </div>
        <div className="meeting-stage-actions">
          <div className={live ? 'meeting-live-status live' : 'meeting-live-status'}><i />{statusLabel}</div>
          {renderRoomSwitcher()}
          <button className="meeting-stage-leave" onClick={() => setExpanded(false)} title="Return to workspace">
            <X size={15} /> Leave stage
          </button>
        </div>
      </header>

      <div className="meeting-stage-body">
        <section className="meeting-stage-room" aria-label="Conference stage">
          {renderOfficeScene()}
        </section>
        <aside className="meeting-stage-side">
          {renderAgenda()}
          {renderTranscript(12)}
        </aside>
      </div>

      <footer className="meeting-stage-dock">
        {renderRoomControls()}
        {renderComposer()}
        {renderNotice()}
      </footer>
    </div>
  )

  if (expanded && mounted) {
    return createPortal(standaloneStage, document.body)
  }

  return (
    <div className="page meeting-page">
      <section className="meeting-header">
        <div>
          <span className="eyebrow">SIGNALDESK TEAM ROOM</span>
          <h1><UsersRound size={25} /> Meetings</h1>
          <p>Text-first working sessions with a convener-led floor. One speaker at a time — no camera or microphone required.</p>
        </div>
        <div className="meeting-header-actions">
          <div className={live ? 'meeting-live-status live' : 'meeting-live-status'}><i />{statusLabel}</div>
          <button
            className="meeting-expand-button"
            onClick={() => setExpanded(true)}
            aria-pressed={false}
            title="Open full meeting stage"
          >
            <Maximize2 size={15} /> Open full stage
          </button>
        </div>
      </section>

      <div className="meeting-layout">
        <aside className="meeting-list card">
          <span className="eyebrow">SCHEDULED ROOMS</span>
          {meetings.map((item) => <button className={meeting.id === item.id ? 'selected-meeting' : ''} key={item.id} onClick={() => {
            openingRunId.current += 1
            openingActiveRef.current = false
            setConvening(false)
            setUpcomingSpeakerId(null)
            onMeetingSelected(item.id)
          }}>
            <UsersRound size={16} /><span><b>{item.title}</b><small>{item.startedAt && !item.endedAt ? 'Live now' : item.endedAt ? 'Completed' : 'Ready when scheduled'}</small></span>
            {item.startedAt && !item.endedAt && <i />}
          </button>)}
        </aside>

        <div className="meeting-room-column">
          <section className="conference-room card">
            <div className="conference-room-top">
              <span><Clock3 size={15} /> {convening ? 'Opening round' : live ? 'Agenda in progress' : 'Conference room'}</span>
              <span>Convener · {convener.name.split(' ')[0]} · #{meeting.channelId}</span>
            </div>
            {renderOfficeScene()}
            {renderRoomControls()}
          </section>
          {renderComposer(true)}
          {renderNotice()}
        </div>

        <aside className="meeting-context">
          {renderAgenda()}
          {renderTranscript(6)}
        </aside>
      </div>
    </div>
  )
}
