'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, CircleAlert, CircleHelp, Clock3, Maximize2, MessageSquare, Minimize2, Play, Send, Square, ThumbsUp, UsersRound } from 'lucide-react'
import { agentPortfolios } from '@/features/simulator/domain/agent-profiles'
import type { MeetingExpression, MeetingSession } from '@/features/simulator/domain/meetings'

type MeetingResponse = { meetings?: MeetingSession[]; error?: string }

type Props = {
  organizationId: string
  selectedMeetingId: string | null
  onMeetingSelected: (meetingId: string) => void
}

const reactionIcons = { thumbs_up: '👍', question: '❓', concern: '⚠️' }
const expressionFaces: Record<MeetingExpression, string> = { neutral: '•‿•', speaking: '◉‿◉', thinking: '◔_◔', concerned: '◕︵◕', happy: '◕‿◕' }

function participant(id: string) {
  if (id === 'you') return { id: 'you', name: 'Alex Morgan', initials: 'A', role: 'Full-stack Engineer', tone: 'blue' as const }
  return agentPortfolios[id] || agentPortfolios.noah
}

function timeLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'now' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function FunctionalMeetingView({ organizationId, selectedMeetingId, onMeetingSelected }: Props) {
  const [meetings, setMeetings] = useState<MeetingSession[]>([])
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const refresh = async () => {
    try {
      const response = await fetch('/api/simulation/meetings?organizationId=' + encodeURIComponent(organizationId), { cache: 'no-store' })
      const data = await response.json() as MeetingResponse
      if (!response.ok) { setNotice(data.error || 'Meetings are unavailable right now.'); return }
      setMeetings(data.meetings || [])
    } catch { setNotice('Meetings are unavailable right now.') }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 15_000)
    return () => window.clearInterval(timer)
  }, [organizationId])

  useEffect(() => {
    if (!expanded) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [expanded])

  const meeting = meetings.find((item) => item.id === selectedMeetingId) || meetings[0]
  const live = Boolean(meeting?.startedAt && !meeting.endedAt)
  const attendeeIds = useMemo(() => meeting ? [...meeting.participantIds, 'you'] : [], [meeting])
  const latestMessages = useMemo(() => {
    const latest = new Map<string, MeetingSession['messages'][number]>()
    meeting?.messages.forEach((message) => latest.set(message.authorId, message))
    return latest
  }, [meeting])

  const update = async (action: 'start' | 'message' | 'reaction' | 'end', extra: Record<string, string> = {}) => {
    if (!meeting) return
    setPending(true)
    setNotice('')
    try {
      const response = await fetch('/api/simulation/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, meetingId: meeting.id, action, ...extra }),
      })
      const data = await response.json() as MeetingResponse
      if (!response.ok) { setNotice(data.error || 'The meeting could not be updated.'); return }
      setMeetings(data.meetings || [])
      if (action === 'start') setNotice('Meeting started. Type a concise update, question, or risk for the room.')
      if (action === 'end') setNotice('Meeting ended. The working context and next-step record were saved.')
    } catch {
      setNotice('The meeting could not be updated. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const sendMessage = async () => {
    const message = draft.trim()
    if (!message) return
    setDraft('')
    await update('message', { message })
  }

  if (!meeting) return <div className="page meeting-page"><section className="meeting-empty card"><UsersRound size={22} /><h1>No team meetings are scheduled yet.</h1><p>Complete onboarding to activate the SignalDesk working calendar.</p></section></div>

  return <div className={'page meeting-page' + (expanded ? ' meeting-expanded' : '')}>
    <section className="meeting-header">
      <div><span className="eyebrow">SIGNALDESK TEAM ROOM</span><h1><UsersRound size={25} /> Meetings</h1><p>Text-first working sessions in a shared conference room. No camera or microphone is required.</p></div>
      <div className="meeting-header-actions"><div className={live ? 'meeting-live-status live' : 'meeting-live-status'}><i />{live ? 'Live meeting' : meeting.endedAt ? 'Meeting complete' : 'Room ready'}</div><button className="meeting-expand-button" onClick={() => setExpanded((value) => !value)} aria-pressed={expanded} title={expanded ? 'Exit expanded meeting view' : 'Expand meeting view'}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{expanded ? 'Exit expanded view' : 'Expand view'}</button></div>
    </section>

    <div className="meeting-layout">
      <aside className="meeting-list card">
        <span className="eyebrow">SCHEDULED ROOMS</span>
        {meetings.map((item) => <button className={meeting.id === item.id ? 'selected-meeting' : ''} key={item.id} onClick={() => onMeetingSelected(item.id)}>
          <UsersRound size={16} /><span><b>{item.title}</b><small>{item.startedAt && !item.endedAt ? 'Live now' : item.endedAt ? 'Completed' : 'Ready when scheduled'}</small></span>
          {item.startedAt && !item.endedAt && <i />}
        </button>)}
      </aside>

      <section className="conference-room card">
        <div className="conference-room-top"><span><Clock3 size={15} /> {live ? 'Agenda in progress' : 'Conference room'}</span><span>#{meeting.channelId}</span></div>
        <div className="office-scene" aria-label={'Conference room for ' + meeting.title}>
          <div className="office-window"><i /><i /><i /></div>
          <div className="office-art">SignalDesk</div>
          <div className="conference-table"><span>{meeting.title}</span></div>
          {attendeeIds.map((id, index) => {
            const person = participant(id)
            const latest = latestMessages.get(id)
            const expression = latest?.expression || (id === meeting.facilitatorId ? 'thinking' : 'neutral')
            const reaction = meeting.reactions[id]
            return <article className={'meeting-seat seat-' + index + (latest ? ' is-speaking' : '')} key={id}>
              {latest && <div className="dialogue-bubble"><span>{latest.text.slice(0, 170)}{latest.text.length > 170 ? '...' : ''}</span><small>{latest.authorId === 'you' ? 'You' : person.name.split(' ')[0]}</small></div>}
              <div className={'scene-avatar ' + person.tone + ' expression-' + expression}><span>{person.initials}</span><i>{expressionFaces[expression]}</i></div>
              {reaction && <em className="scene-reaction">{reactionIcons[reaction as keyof typeof reactionIcons]}</em>}
              <b>{id === 'you' ? 'You' : person.name.split(' ')[0]}</b><small>{person.role}</small>
            </article>
          })}
        </div>
        <div className="meeting-room-controls">
          {!live && !meeting.endedAt && <button className="primary-button" disabled={pending} onClick={() => void update('start')}><Play size={15} /> Start meeting</button>}
          {live && <><button className="reaction-button" disabled={pending} onClick={() => void update('reaction', { reaction: 'thumbs_up' })}><ThumbsUp size={15} /> Agree</button><button className="reaction-button" disabled={pending} onClick={() => void update('reaction', { reaction: 'question' })}><CircleHelp size={15} /> Clarify</button><button className="reaction-button concern" disabled={pending} onClick={() => void update('reaction', { reaction: 'concern' })}><CircleAlert size={15} /> Raise risk</button><button className="end-meeting-button" disabled={pending} onClick={() => void update('end')}><Square size={13} /> End meeting</button></>}
          {meeting.endedAt && <span className="meeting-ended"><Check size={14} /> Working record saved</span>}
        </div>
      </section>

      <aside className="meeting-context">
        <section className="card meeting-agenda"><span className="eyebrow">AGENDA</span><h2>{meeting.title}</h2><ol>{meeting.agenda.map((item) => <li key={item}><span>{item}</span></li>)}</ol></section>
        <section className="card meeting-transcript"><div><span className="eyebrow">MEETING TRANSCRIPT</span><MessageSquare size={16} /></div>{meeting.messages.length ? meeting.messages.slice(-6).map((message) => <article key={message.id}><b>{message.authorId === 'you' ? 'You' : participant(message.authorId).name}</b><span>{message.text}</span><small>{timeLabel(message.createdAt)}</small></article>) : <p>Start the meeting to open the shared working transcript.</p>}</section>
      </aside>
    </div>

    {live && <section className="meeting-composer card"><div><MessageSquare size={18} /><span><b>Speak to the room</b><small>Your message becomes a dialogue bubble and is recorded in the meeting transcript.</small></span></div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void sendMessage() } }} placeholder="Share an update, ask for a decision, or flag a risk..." /><button className="primary-button" disabled={pending || !draft.trim()} onClick={() => void sendMessage()}><Send size={15} /> Send</button></section>}
    {notice && <p className="meeting-notice"><MessageSquare size={15} /> {notice}</p>}
  </div>
}
