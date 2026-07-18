'use client'

import { useMemo, useState } from 'react'
import { Bell, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, RefreshCw, UsersRound } from 'lucide-react'
import type { ScheduleItem } from '@/features/simulator/domain/onboarding'

type CalendarResponse = {
  schedule?: ScheduleItem[]
  simulationNow?: string
  error?: string
}

type Props = {
  organizationId: string
  schedule: ScheduleItem[]
  simulationNow: string
  onScheduleUpdated: (schedule: ScheduleItem[], simulationNow: string) => void
}

const channelFor = (item: ScheduleItem) => item.kind === 'focus' ? 'engineering' : item.kind === 'deadline' ? 'releases' : 'product-usage'

function dateValue(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time) : new Date()
}

function dayLabel(value: string) {
  return dateValue(value).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function timeLabel(value: string) {
  return dateValue(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function relativeStart(item: ScheduleItem, now: number) {
  const minutes = Math.round((Date.parse(item.startsAt) - now) / 60_000)
  if (item.missed) return 'Needs recovery plan'
  if (item.completed) return 'Completed'
  if (minutes <= 0 && now <= Date.parse(item.endsAt)) return 'In progress now'
  if (minutes > 0 && minutes <= 60) return 'Starts in ' + minutes + ' min'
  if (minutes > 60 && minutes < 24 * 60) return 'Starts in ' + Math.ceil(minutes / 60) + ' hr'
  return 'Scheduled ' + dayLabel(item.startsAt)
}

export default function FunctionalCalendarView({ organizationId, schedule, simulationNow, onScheduleUpdated }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const currentTime = Date.parse(simulationNow)
  const now = Number.isFinite(currentTime) ? currentTime : Date.now()
  const groupedSchedule = useMemo(() => schedule.reduce<Record<string, ScheduleItem[]>>((groups, item) => {
    const day = dayLabel(item.startsAt)
    groups[day] = [...(groups[day] || []), item]
    return groups
  }, {}), [schedule])
  const reminders = useMemo(() => schedule
    .filter((item) => !item.completed)
    .filter((item) => item.missed || (now >= Date.parse(item.startsAt) && now <= Date.parse(item.endsAt)) || (Date.parse(item.startsAt) > now && Date.parse(item.startsAt) - now <= 30 * 60_000))
    .sort((left, right) => Number(right.missed) - Number(left.missed) || Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, 4), [schedule, now])

  const updateSchedule = async (action: 'complete' | 'request_extension' | 'check_deadlines', scheduleId?: string) => {
    setPendingId(scheduleId || 'refresh')
    setFeedback('')
    try {
      const response = await fetch('/api/simulation/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, action, scheduleId }),
      })
      const data = await response.json() as CalendarResponse
      if (!response.ok) {
        setFeedback(data.error || 'The calendar could not be updated.')
        return
      }
      onScheduleUpdated(data.schedule || schedule, data.simulationNow || simulationNow)
      setFeedback(action === 'request_extension' ? 'Recovery window approved and shared with the release channel.' : action === 'complete' ? 'Completion recorded in your work calendar.' : 'Deadline status refreshed.')
    } catch {
      setFeedback('The calendar could not be reached. Please try again.')
    } finally {
      setPendingId(null)
    }
  }

  return <div className="page work-calendar-page">
    <section className="calendar-hero">
      <div>
        <span className="eyebrow">WORK WEEK - SIGNALDESK</span>
        <h1><CalendarDays size={25} /> Calendar</h1>
        <p>A shared source of truth for focus time, ceremonies, delivery commitments, and the follow-ups your team expects.</p>
      </div>
      <div className="calendar-hero-actions">
        <span><Clock3 size={15} /> Simulation time {dateValue(simulationNow).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <button className="ghost-button" disabled={pendingId === 'refresh'} onClick={() => void updateSchedule('check_deadlines')}><RefreshCw size={14} className={pendingId === 'refresh' ? 'calendar-spin' : ''} /> Refresh</button>
      </div>
    </section>

    <div className="calendar-workspace">
      <section className="calendar-board card">
        <div className="calendar-board-head">
          <div><span className="eyebrow">YOUR SCHEDULE</span><h2>Meetings, focus blocks, and deadlines</h2></div>
          <span className="calendar-count">{schedule.filter((item) => !item.completed && !item.missed).length} open</span>
        </div>
        {Object.entries(groupedSchedule).map(([day, items]) => <section className="calendar-day" key={day}>
          <div className="calendar-day-label"><b>{day}</b><span>{items.length} item{items.length === 1 ? '' : 's'}</span></div>
          <div className="calendar-events">
            {items.map((item) => {
              const starts = Date.parse(item.startsAt)
              const ends = Date.parse(item.endsAt)
              const active = !item.completed && !item.missed && now >= starts && now <= ends
              const canComplete = active
              const canRequestExtension = item.kind === 'deadline' && !item.completed && !item.missed && !item.extensionRequested && now >= starts
              return <article className={'calendar-event ' + item.kind + (item.completed ? ' completed' : '') + (item.missed ? ' missed' : '') + (active ? ' active' : '')} key={item.id}>
                <div className="calendar-time"><b>{timeLabel(item.startsAt)}</b><span>{timeLabel(item.endsAt)}</span></div>
                <div className="calendar-event-marker" />
                <div className="calendar-event-copy">
                  <div><span className="calendar-kind">{item.kind === 'focus' ? 'Focus time' : item.kind === 'deadline' ? 'Delivery deadline' : 'Team ceremony'}</span>{active && <span className="calendar-live">Live now</span>}</div>
                  <h3>{item.title}</h3>
                  <p><UsersRound size={13} /> #{channelFor(item)} <span>/</span> {relativeStart(item, now)}</p>
                  {item.extensionDecision === 'approved' && <small className="calendar-recovery"><Check size={13} /> Recovery window approved through {timeLabel(item.endsAt)}</small>}
                  {item.missed && <small className="calendar-missed"><CircleAlert size={13} /> This commitment was missed. Record the impact and recovery plan in #releases.</small>}
                </div>
                <div className="calendar-event-actions">
                  {item.completed ? <span className="calendar-complete"><Check size={14} /> Complete</span>
                    : item.missed ? <span className="calendar-overdue"><CircleAlert size={14} /> Missed</span>
                      : <>{canComplete && <button className="primary-button" disabled={pendingId === item.id} onClick={() => void updateSchedule('complete', item.id)}>{pendingId === item.id ? 'Saving...' : <><Check size={14} /> Mark complete</>}</button>}
                        {canRequestExtension && <button className="ghost-button" disabled={pendingId === item.id} onClick={() => void updateSchedule('request_extension', item.id)}>{pendingId === item.id ? 'Sending...' : 'Request recovery'}</button>}
                        {item.extensionRequested && item.extensionDecision !== 'approved' && <span className="calendar-awaiting">Manager reviewing recovery</span>}
                        {!canComplete && !canRequestExtension && !item.extensionRequested && <span className="calendar-upcoming">{relativeStart(item, now)}</span>}
                      </>}
                </div>
              </article>
            })}
          </div>
        </section>)}
      </section>

      <aside className="calendar-reminders card">
        <div className="calendar-reminders-head"><span className="calendar-notification-icon"><Bell size={17} /></span><div><span className="eyebrow">TEAMS ACTIVITY</span><h2>Schedule reminders</h2></div></div>
        <p>Reminders are also sent to the notification bell so you can return to the work that needs attention.</p>
        <div className="calendar-reminder-list">
          {reminders.length ? reminders.map((item) => <article key={item.id} className={item.missed ? 'reminder-missed' : ''}>
            <span>{item.missed ? <CircleAlert size={15} /> : <Bell size={15} />}</span>
            <div><b>{item.missed ? 'Missed: ' + item.title : item.title}</b><small>{item.missed ? 'Open #releases with a recovery plan.' : relativeStart(item, now)}</small></div>
            <ChevronRight size={15} />
          </article>) : <div className="calendar-caught-up"><Check size={17} /><b>No immediate schedule reminders</b><span>Your upcoming commitments will appear here shortly before they start.</span></div>}
        </div>
        <div className="calendar-practice-note"><b>How it works</b><span>Completion is available only during its scheduled window. Delivery deadlines can request one recorded recovery window, keeping the work history visible to your team.</span></div>
      </aside>
    </div>
    {feedback && <p className="calendar-feedback"><Bell size={15} /> {feedback}</p>}
  </div>
}
