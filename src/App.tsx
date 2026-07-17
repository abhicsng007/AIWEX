'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SimulationEvent, SimulationEventType } from '@/features/simulator/domain/types'
import FunctionalWorkspaceView from '@/features/simulator/components/functional-workspace-view'
import FunctionalPullRequestsView from '@/features/simulator/components/functional-pull-requests-view'
import FunctionalFeedbackView from '@/features/simulator/components/functional-feedback-view'
import FunctionalIssuesView from '@/features/simulator/components/functional-issues-view'
import OrgActivityMap from '@/features/simulator/components/org-activity-map'
import { agentPortfolios, type AgentPortfolio } from '@/features/simulator/domain/agent-profiles'
import { seededIssues, type WorkIssue } from '@/features/simulator/domain/issues'
import {
  ArrowRight, Bell, Bot, Check, ChevronDown, CircleDot, Clock3, Code2,
  Columns3, FileCode2, GitBranch, Inbox, Layers3, LayoutDashboard, Lock,
  MessageSquare, MoreHorizontal, Paperclip, Play, Plus, Search, Send,
  FileText, Pencil, Reply, Settings2, ShieldCheck, Sparkles, TerminalSquare, Trash2, UserPlus, UsersRound, X,
} from 'lucide-react'

type View = 'home' | 'issues' | 'workspace' | 'pulls' | 'feedback' | 'team-space' | 'agent-profile'
type Toast = { message: string; tone?: 'success' | 'warning' } | null
type TeamSpace = { id: string; name: string; unread: number; description?: string; memberIds?: string[] }
type TeamAttachment = { name: string; size: number; type: string }
type TeamMessage = { id: number; spaceId: string; author: string; role: string; initials: string; tone: string; time: string; text: string; link: string; threadId?: number; attachment?: TeamAttachment; edited?: boolean }
type NotificationItem = { id: string; title: string; detail: string; view: View; spaceId?: string }
type HomeOverlay = 'none' | 'time' | 'search' | 'notifications' | 'help' | 'organization'
const organizationId = 'signaldesk-alpha'

const avatars: Record<string, string> = {
  maya: 'M', noah: 'N', adele: 'A', marcus: 'M', devon: 'D', you: 'Y',
}

const mentionOptions = [
  { id: 'maya', username: 'maya', label: 'Maya Chen', role: 'Product Manager', tone: 'violet' },
  { id: 'noah', username: 'noah', label: 'Noah Patel', role: 'Tech Lead', tone: 'mint' },
  { id: 'adele', username: 'adele', label: 'Adele Okafor', role: 'Designer', tone: 'orange' },
  { id: 'devon', username: 'devon', label: 'Devon Reeves', role: 'Engineer', tone: 'blue' },
  { id: 'you', username: 'alex', label: 'Alex Morgan', role: 'You', tone: 'blue' },
]

const initialMessages = [
  { id: 1, author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: '9:12 AM', text: 'Morning team — we need the usage-alerts experience ready for the Pro plan review. @you, I moved the empty state ticket into this sprint. Please check the acceptance criteria before you start.', link: 'PROJ-184' },
  { id: 2, author: 'Noah Patel', role: 'Tech Lead', initials: 'N', tone: 'mint', time: '9:18 AM', text: 'A quick heads up: the billing events API is still a little fragile. Don’t assume `threshold` is always present; we have older workspaces in production.', link: '' },
  { id: 3, author: 'Adele Okafor', role: 'Product Designer', initials: 'A', tone: 'orange', time: '9:26 AM', text: 'I dropped annotated states in the handoff doc. The empty state should feel calm, not like an error. Happy to answer questions before you implement.', link: 'Design handoff' },
]

const initialSpaces: TeamSpace[] = [
  { id: 'product-usage', name: 'product-usage', unread: 3, description: 'Coordinate the product-usage initiative, handoffs, and customer-impact decisions.', memberIds: ['maya', 'noah', 'adele', 'devon', 'you'] },
  { id: 'engineering', name: 'engineering', unread: 0, description: 'Discuss implementation details, system health, and technical decisions.', memberIds: ['maya', 'noah', 'devon', 'you'] },
  { id: 'releases', name: 'releases', unread: 0, description: 'Coordinate launch risks, release status, and rollout decisions.', memberIds: ['maya', 'noah', 'devon', 'you'] },
]

const seedMessages: TeamMessage[] = [
  ...initialMessages.map((message) => ({ ...message, spaceId: 'product-usage' })),
  { id: 4, spaceId: 'engineering', author: 'Devon Reeves', role: 'Peer Engineer', initials: 'D', tone: 'blue', time: '8:47 AM', text: 'I am investigating the dashboard chart tooltip issue. I’ll post an update before lunch.', link: 'PROJ-189' },
  { id: 5, spaceId: 'releases', author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: 'Yesterday', text: 'Sprint 2 scope is locked. Please flag release risks early in this channel.', link: '' },
]

const code = `import { EmptyState } from '@/components/empty-state'
import { BellOff } from 'lucide-react'

type AlertsPanelProps = {
  alerts: UsageAlert[]
  workspaceName: string
}

export function AlertsPanel({ alerts, workspaceName }: AlertsPanelProps) {
  if (!alerts.length) {
    return (
      <EmptyState
        icon={BellOff}
        title="No usage alerts yet"
        description="We'll let you know when your workspace is close to a limit."
        action={{ label: 'Review your plan', href: '/settings/billing' }}
      />
    )
  }

  return <AlertList alerts={alerts} />
}`

function Avatar({ id, tone = 'navy', small = false }: { id: string; tone?: string; small?: boolean }) {
  return <span className={`avatar ${tone} ${small ? 'small' : ''}`}>{avatars[id] || id.slice(0, 1)}</span>
}

function MessageText({ text, openAgentPortfolio }: { text: string; openAgentPortfolio: (id: string) => void }) {
  return <>{text.split(/(@[a-z0-9-]+)/gi).map((part, index) => {
    const option = mentionOptions.find((item) => `@${item.username}`.toLowerCase() === part.toLowerCase())
    if (!option) return <span key={`${part}-${index}`}>{part}</span>
    return option.id === 'you' ? <span className="mention-chip self-mention" key={`${part}-${index}`}>{part}</span> : <button className="mention-chip" key={`${part}-${index}`} onClick={() => openAgentPortfolio(option.id)}>{part}</button>
  })}</>
}

function MentionComposer({ draft, setDraft, sendMessage, placeholder, className }: { draft: string; setDraft: (value: string) => void; sendMessage: (attachment?: TeamAttachment) => void; placeholder: string; className: string }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [attachment, setAttachment] = useState<TeamAttachment | null>(null)
  const match = draft.match(/@([a-z0-9-]*)$/i)
  const suggestions = match ? mentionOptions.filter((option) => option.username.startsWith(match[1].toLowerCase()) || option.label.toLowerCase().includes(match[1].toLowerCase())) : []
  const insertMention = (username: string) => setDraft(draft.replace(/@[a-z0-9-]*$/i, `@${username} `))
  const submit = () => { sendMessage(attachment || undefined); setAttachment(null); if (fileInput.current) fileInput.current.value = '' }
  return <div className={`${className} mention-composer`}><input ref={fileInput} className="attachment-input" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAttachment({ name: file.name, size: file.size, type: file.type || 'file' }) }} /><button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach a file"><Paperclip size={17} /></button><div className="mention-input-wrap"><input className="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { if (suggestions.length) insertMention(suggestions[0].username); else submit() } }} placeholder={placeholder}/>{attachment && <div className="attachment-chip"><FileText size={12} /> {attachment.name}<button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={11} /></button></div>}{suggestions.length > 0 && <div className="mention-menu">{suggestions.map((option) => <button type="button" key={option.id} onMouseDown={(event) => { event.preventDefault(); insertMention(option.username) }}><Avatar id={option.id === 'you' ? 'you' : option.id} tone={option.tone} small /><span><b>{option.label}</b><small>@{option.username} · {option.role}</small></span></button>)}</div>}</div><button className="send-button" type="button" onClick={submit} aria-label="Send message"><Send size={16} /></button></div>
}

function ScoreRing({ score, label, accent }: { score: number; label: string; accent: string }) {
  return <div className="score-block">
    <div className="score-ring" style={{ '--score': `${score * 3.6}deg`, '--accent': accent } as React.CSSProperties}>
      <strong>{score}</strong>
    </div>
    <span>{label}</span>
  </div>
}

function App() {
  const [view, setView] = useState<View>('home')
  const [messages, setMessages] = useState<TeamMessage[]>(seedMessages)
  const [teamSpaces, setTeamSpaces] = useState<TeamSpace[]>(initialSpaces)
  const [selectedSpaceId, setSelectedSpaceId] = useState('product-usage')
  const [newSpaceName, setNewSpaceName] = useState('')
  const [isAddingSpace, setIsAddingSpace] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState('noah')
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState<Toast>(null)
  const [standupDone, setStandupDone] = useState(false)
  const [testsPassed, setTestsPassed] = useState(false)
  const [committed, setCommitted] = useState(false)
  const [prOpen, setPrOpen] = useState(false)
  const [reviewAddressed, setReviewAddressed] = useState(false)
  const [reviewReplied, setReviewReplied] = useState(false)
  const [approved, setApproved] = useState(false)
  const [merged, setMerged] = useState(false)
  const [showCeremony, setShowCeremony] = useState(false)
  const [activity, setActivity] = useState<string[]>([])
  const [workspaceCode, setWorkspaceCode] = useState(code)
  const [issues, setIssues] = useState<WorkIssue[]>(seededIssues)
  const [liveEvents, setLiveEvents] = useState<SimulationEvent[]>([])
  const [simulationMinutes, setSimulationMinutes] = useState(9 * 60 + 42)
  const [homeOverlay, setHomeOverlay] = useState<HomeOverlay>('none')
  const [searchQuery, setSearchQuery] = useState('')
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('shiftline-alpha-progress')
    if (saved) {
      const state = JSON.parse(saved) as { standupDone: boolean; testsPassed: boolean; committed: boolean; prOpen: boolean; reviewAddressed: boolean; reviewReplied?: boolean; approved?: boolean; merged?: boolean; activity: string[]; workspaceCode?: string; messages?: TeamMessage[]; teamSpaces?: TeamSpace[]; selectedSpaceId?: string; issues?: WorkIssue[]; simulationMinutes?: number; readNotificationIds?: string[] }
      setStandupDone(state.standupDone); setTestsPassed(state.testsPassed); setCommitted(state.committed)
      setPrOpen(state.prOpen); setReviewAddressed(state.reviewAddressed); setReviewReplied(state.reviewReplied || false); setApproved(state.approved || false); setMerged(state.merged || false); setActivity(state.activity || []); setWorkspaceCode(state.workspaceCode || code); setMessages(state.messages || seedMessages); setTeamSpaces(state.teamSpaces || initialSpaces); setSelectedSpaceId(state.selectedSpaceId || 'product-usage'); setIssues(state.issues || seededIssues); setSimulationMinutes(state.simulationMinutes || 9 * 60 + 42); setReadNotificationIds(state.readNotificationIds || [])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('shiftline-alpha-progress', JSON.stringify({ standupDone, testsPassed, committed, prOpen, reviewAddressed, reviewReplied, approved, merged, activity, workspaceCode, messages, teamSpaces, selectedSpaceId, issues, simulationMinutes, readNotificationIds }))
  }, [standupDone, testsPassed, committed, prOpen, reviewAddressed, reviewReplied, approved, merged, activity, workspaceCode, messages, teamSpaces, selectedSpaceId, issues, simulationMinutes, readNotificationIds])

  useEffect(() => {
    const ingest = (event: SimulationEvent) => {
      setLiveEvents((events) => events.some((item) => item.id === event.id) ? events : [...events, event].slice(-80))
      const metadata = event.metadata || {}
      const channelId = typeof metadata.channelId === 'string' ? metadata.channelId : ''
      const text = typeof metadata.message === 'string' ? metadata.message : ''
      if (event.type === 'chat_message' && channelId && text) {
        setMessages((items) => items.some((item) => item.spaceId === channelId && item.author === 'You' && item.text === text) ? items : [...items, { id: Date.parse(event.createdAt), spaceId: channelId, author: 'You', role: 'Full-stack Engineer', initials: 'Y', tone: 'blue', time: 'now', text, link: '' }])
      }
      if (event.type === 'agent_reply' && channelId && text) {
        const agentId = typeof metadata.agentId === 'string' ? metadata.agentId : 'noah'
        const agent = agentPortfolios[agentId] || agentPortfolios.noah
        setMessages((items) => items.some((item) => item.spaceId === channelId && item.author === agent.name && item.text === text) ? items : [...items, { id: Date.parse(event.createdAt) + 1, spaceId: channelId, author: agent.name, role: agent.role, initials: agent.initials, tone: agent.tone, time: 'now', text, link: '' }])
      }
      if (event.type === 'team_space_created' && typeof metadata.spaceId === 'string' && typeof metadata.name === 'string') {
        setTeamSpaces((spaces) => spaces.some((space) => space.id === metadata.spaceId) ? spaces : [...spaces, { id: metadata.spaceId as string, name: metadata.name as string, unread: 1, description: 'A focused space for decisions, updates, and working context.', memberIds: ['maya', 'noah', 'devon', 'you'] }])
      }
      if (event.type === 'team_space_updated' && typeof metadata.spaceId === 'string' && typeof metadata.name === 'string') setTeamSpaces((spaces) => spaces.map((space) => space.id === metadata.spaceId ? { ...space, name: metadata.name as string } : space))
    }
    const source = new EventSource(`/api/simulation/events/stream?organizationId=${organizationId}`)
    source.addEventListener('snapshot', (message) => { const events = JSON.parse((message as MessageEvent<string>).data) as SimulationEvent[]; events.forEach(ingest) })
    source.addEventListener('simulation-event', (message) => ingest(JSON.parse((message as MessageEvent<string>).data) as SimulationEvent))
    return () => source.close()
  }, [])

  useEffect(() => {
    const pulse = () => { void fetch('/api/simulation/pulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId }) }) }
    pulse()
    const timer = window.setInterval(pulse, 20000)
    return () => window.clearInterval(timer)
  }, [])

  const progress = useMemo(() => [standupDone, testsPassed, committed, prOpen, reviewAddressed].filter(Boolean).length, [standupDone, testsPassed, committed, prOpen, reviewAddressed])
  const selectedSpace = teamSpaces.find((space) => space.id === selectedSpaceId) || teamSpaces[0]
  const activeMessages = messages.filter((message) => message.spaceId === selectedSpaceId)
  const selectedAgent = agentPortfolios[selectedAgentId] || agentPortfolios.noah
  const notifications = useMemo<NotificationItem[]>(() => [
    !standupDone ? { id: 'standup-due', title: 'Async stand-up is due', detail: 'Share your plan before implementation.', view: 'home' } : null,
    !testsPassed && standupDone ? { id: 'branch-checks', title: 'Branch checks are your next gate', detail: 'Implement the guard and run CI before committing.', view: 'workspace' } : null,
    testsPassed && !committed ? { id: 'commit-ready', title: 'Your branch is ready to commit', detail: 'Capture the verified implementation on your feature branch.', view: 'workspace' } : null,
    committed && !prOpen ? { id: 'review-needed', title: 'PROJ-184 needs a pull request', detail: 'Request review so the release train can move.', view: 'pulls' } : null,
    prOpen && !reviewAddressed ? { id: 'review-requested', title: 'Noah requested a change on PR #482', detail: 'Address the role guard before merge.', view: 'pulls' } : null,
    prOpen && reviewAddressed && !approved ? { id: 'review-response', title: 'Explain the review update', detail: 'Your reviewer needs a clear response before approval.', view: 'pulls' } : null,
    ...teamSpaces.filter((space) => space.unread > 0).map((space) => ({ id: `unread-${space.id}`, title: `New activity in #${space.name}`, detail: `${space.unread} unread team update${space.unread === 1 ? '' : 's'}.`, view: 'team-space' as View, spaceId: space.id })),
    ...activity.slice(0, 4).map((item, index) => ({ id: `activity-${index}-${item}`, title: 'Your simulation activity', detail: item, view: 'feedback' as View })),
  ].filter(Boolean) as NotificationItem[], [standupDone, testsPassed, committed, prOpen, reviewAddressed, approved, teamSpaces, activity])
  const unreadNotifications = notifications.filter((item) => !readNotificationIds.includes(item.id)).length
  const notify = (message: string, tone: 'success' | 'warning' = 'success') => {
    setToast({ message, tone }); window.setTimeout(() => setToast(null), 3200)
  }
  const log = (item: string) => setActivity((items) => [item, ...items].slice(0, 8))
  const recordSimulationEvent = async (type: SimulationEventType, metadata?: Record<string, string | boolean | number>) => {
    const response = await fetch('/api/simulation/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, type, metadata }) })
    if (!response.ok) {
      const result = await response.json() as { error?: string }
      notify(result.error || 'The simulation could not record that action.', 'warning')
      return false
    }
    return true
  }
  const requestAgentTurn = async (channelId: string, userMessage: string) => {
    const response = await fetch('/api/simulation/agent-turns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, channelId, userMessage }) })
    if (!response.ok) {
      notify('Your teammates could not respond right now. Try again in a moment.', 'warning')
      return null
    }
    return response.json() as Promise<{ turn: { agent: { id: string; name: string; role: string }; message: string } }>
  }
  const createIssue = (draft: Omit<WorkIssue, 'id' | 'updatedAt'>) => {
    const nextNumber = Math.max(200, ...issues.map((issue) => Number(issue.id.replace('PROJ-', '')) + 1))
    const issue: WorkIssue = { ...draft, id: `PROJ-${nextNumber}`, updatedAt: 'just now' }
    setIssues((items) => [...items, issue]); log(`Created ${issue.id}: ${issue.title}`); void recordSimulationEvent('issue_created', { issueId: issue.id, title: issue.title })
  }
  const updateIssue = (issue: WorkIssue) => {
    setIssues((items) => items.map((item) => item.id === issue.id ? issue : item)); log(`Updated ${issue.id}: ${issue.title}`); void recordSimulationEvent('issue_updated', { issueId: issue.id, status: issue.status, priority: issue.priority })
  }
  const advanceSimulationTime = async (minutes: number) => {
    if (minutes <= 0) return
    const from = simulationMinutes
    const next = Math.min(17 * 60, from + minutes)
    if (!await recordSimulationEvent('simulation_time_advanced', { from, to: next, minutes: next - from })) return
    setSimulationMinutes(next)
    const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
    log(`Advanced simulated time from ${formatTime(from)} to ${formatTime(next)}`)
    if (from < 10 * 60 && next >= 10 * 60 && !standupDone) {
      setMessages((items) => [...items, { id: Date.now(), spaceId: 'product-usage', author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: '10:00 AM', text: '@alex, quick reminder: please post your stand-up before you begin implementation so dependencies are visible.', link: '' }])
      setTeamSpaces((spaces) => spaces.map((space) => space.id === 'product-usage' ? { ...space, unread: selectedSpaceId === 'product-usage' ? 0 : space.unread + 1 } : space))
      log('Maya followed up on the overdue stand-up')
    }
    if (from < 11 * 60 && next >= 11 * 60) {
      setMessages((items) => [...items, { id: Date.now() + 1, spaceId: 'releases', author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: '11:00 AM', text: 'Stakeholder check-in moved to 3 PM. Please flag anything that could put the usage-alerts scope at risk.', link: 'PROJ-184' }])
      setTeamSpaces((spaces) => spaces.map((space) => space.id === 'releases' ? { ...space, unread: selectedSpaceId === 'releases' ? 0 : space.unread + 1 } : space))
      log('Maya posted a release-risk check-in')
    }
    if (from < 15 * 60 && next >= 15 * 60 && !prOpen) {
      log('Release pressure increased: PROJ-184 needs a review-ready branch today')
      notify('The stakeholder check-in is here. Keep PROJ-184 moving and flag any blockers.', 'warning')
    } else notify(`Simulation moved to ${formatTime(next)}.`)
    setHomeOverlay('none')
  }
  const completeStandup = async () => {
    if (!await recordSimulationEvent('standup_posted')) return
    setStandupDone(true); setShowCeremony(false); log('Posted async stand-up'); notify('Stand-up posted. Maya has been notified.')
  }
  const runTests = async () => {
    if (!workspaceCode.includes('canManageBilling')) {
      log('CI blocked: billing role guard is missing')
      return notify('Check failed: protect the billing CTA with canManageBilling before rerunning CI.', 'warning')
    }
    if (!await recordSimulationEvent('checks_passed')) return
    setTestsPassed(true); log('CI test suite passed'); notify('12 checks passed — your branch is ready to commit.')
  }
  const commit = async () => {
    if (!testsPassed) return notify('Run the test suite before creating a commit.', 'warning')
    if (!await recordSimulationEvent('commit_created')) return
    setCommitted(true); log('Committed changes on feat/usage-alerts-empty-state'); notify('Commit created on your feature branch.')
  }
  const openPr = async () => {
    if (!committed) return notify('Commit your changes before opening a pull request.', 'warning')
    if (!await recordSimulationEvent('pull_request_opened')) return
    setPrOpen(true); log('Opened PR #482 for review'); notify('PR #482 opened. Noah and Devon were requested for review.')
  }
  const selectTeamSpace = (spaceId: string) => {
    setSelectedSpaceId(spaceId)
    setTeamSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, unread: 0 } : space))
    setView('team-space')
  }
  const openAgentPortfolio = (agentId: string) => {
    if (!agentPortfolios[agentId]) return
    setSelectedAgentId(agentId)
    setView('agent-profile')
  }
  const addTeamSpace = () => {
    const name = newSpaceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!name) return notify('Give the new team space a name.', 'warning')
    if (teamSpaces.some((space) => space.name === name)) return notify('A team space with that name already exists.', 'warning')
    const space: TeamSpace = { id: `space-${Date.now()}`, name, unread: 0, description: 'A focused space for decisions, updates, and working context.', memberIds: ['maya', 'noah', 'devon', 'you'] }
    setTeamSpaces((spaces) => [...spaces, space]); setMessages((items) => [...items, { id: Date.now(), spaceId: space.id, author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: 'now', text: `Welcome to #${name}. Use this space to keep the team’s decisions visible.`, link: '' }]); void recordSimulationEvent('team_space_created', { spaceId: space.id, name }); setNewSpaceName(''); setIsAddingSpace(false); selectTeamSpace(space.id); log(`Created #${name}`); notify(`Created #${name}.`)
  }
  const updateTeamSpace = (nextSpace: TeamSpace) => {
    const name = nextSpace.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!name) return notify('A team space needs a valid name.', 'warning')
    if (teamSpaces.some((space) => space.id !== nextSpace.id && space.name === name)) return notify('A team space with that name already exists.', 'warning')
    const normalized = { ...nextSpace, name }
    setTeamSpaces((spaces) => spaces.map((space) => space.id === normalized.id ? normalized : space))
    log(`Updated #${normalized.name}`); void recordSimulationEvent('team_space_updated', { spaceId: normalized.id, name: normalized.name, memberCount: normalized.memberIds?.length || 0 }); notify(`Saved #${normalized.name}.`)
  }
  const updateMessage = (id: number, text: string) => {
    const message = messages.find((item) => item.id === id)
    if (!message || message.author !== 'You' || text.trim().length === 0) return
    setMessages((items) => items.map((item) => item.id === id ? { ...item, text: text.trim(), edited: true } : item)); log('Edited a team message'); void recordSimulationEvent('chat_message_edited', { messageId: id })
  }
  const deleteMessage = (id: number) => {
    const message = messages.find((item) => item.id === id)
    if (!message || message.author !== 'You') return
    setMessages((items) => items.filter((item) => item.id !== id && item.threadId !== id)); log('Deleted a team message'); void recordSimulationEvent('chat_message_deleted', { messageId: id }); notify('Message deleted.')
  }
  const sendMessage = async (attachment?: TeamAttachment, messageOverride?: string, threadId?: number) => {
    const message = (messageOverride || draft).trim()
    if (!message && !attachment) return
    const spaceId = selectedSpaceId
    const spaceName = selectedSpace?.name || 'team space'
    if (!await recordSimulationEvent('chat_message', { message: message || '(attachment)', channelId: spaceId, threadId: threadId || '' })) return
    setMessages((items) => [...items, { id: Date.now(), spaceId, author: 'You', role: 'Full-stack Engineer', initials: 'Y', tone: 'blue', time: 'now', text: message, link: '', threadId, attachment }])
    log(`Sent ${threadId ? 'a thread reply' : 'a message'} in #${spaceName}`); if (!messageOverride) setDraft(''); notify(threadId ? 'Thread reply sent.' : 'Message sent.')
    window.setTimeout(async () => {
      const result = await requestAgentTurn(spaceId, message)
      if (!result) return
      const tone = result.turn.agent.id === 'maya' ? 'violet' : result.turn.agent.id === 'adele' ? 'orange' : result.turn.agent.id === 'devon' ? 'blue' : 'mint'
      const role = result.turn.agent.role.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
      setMessages((items) => [...items, { id: Date.now() + 1, spaceId, author: result.turn.agent.name, role, initials: result.turn.agent.name[0], tone, time: 'now', text: result.turn.message, link: '', threadId }])
      setTeamSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, unread: spaceId === selectedSpaceId ? 0 : space.unread + 1 } : space))
      log(`${result.turn.agent.name.split(' ')[0]} replied in #${spaceName}`)
    }, 700)
  }
  const addressReview = async () => {
    if (!await recordSimulationEvent('review_addressed')) return
    setReviewAddressed(true); log('Marked Noah’s review as addressed'); notify('Review marked as addressed. Explain your change to Noah.')
  }
  const replyToReview = async (response: string) => {
    if (response.trim().length < 12) return notify('Explain how you handled the feedback before submitting your response.', 'warning')
    if (!await recordSimulationEvent('review_reply', { response: response.trim() })) return
    setReviewReplied(true); log('Responded to Noah’s review'); notify('Review response sent. Noah is checking the updated change.')
    window.setTimeout(async () => {
      if (!await recordSimulationEvent('approval_granted')) return
      setApproved(true); log('Noah approved PR #482'); notify('Noah approved the pull request. Add your merge rationale next.')
    }, 700)
  }
  const recordMergeRationale = async (rationale: string) => {
    if (!await recordSimulationEvent('merge_rationale_recorded', { rationale })) return false
    log('Recorded merge rationale'); notify('Merge rationale saved.')
    return true
  }
  const mergePullRequest = async (rationale: string) => {
    if (!await recordMergeRationale(rationale)) return
    if (!await recordSimulationEvent('pull_request_merged')) return
    setMerged(true); log('Merged PR #482 into main'); notify('PR #482 merged. The release train is updated.')
  }

  const nav = [
    { id: 'home' as View, label: 'Home', icon: LayoutDashboard },
    { id: 'issues' as View, label: 'Issues', icon: CircleDot, badge: 3 },
    { id: 'workspace' as View, label: 'Workspace', icon: Code2 },
    { id: 'pulls' as View, label: 'Pull requests', icon: GitBranch, badge: prOpen ? 1 : undefined },
    { id: 'feedback' as View, label: 'Feedback', icon: Sparkles },
  ]

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Layers3 size={18} /></span><span>shiftline</span><em>alpha</em></div>
      <button className="org-switch" onClick={() => setHomeOverlay(homeOverlay === 'organization' ? 'none' : 'organization')} aria-expanded={homeOverlay === 'organization'}><span className="org-icon">S</span><span><b>SignalDesk</b><small>Pro workspace</small></span><ChevronDown size={15} /></button>
      <nav className="primary-nav">
        {nav.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.badge && <i>{item.badge}</i>}</button>)}
      </nav>
      <div className="sidebar-label">Team spaces</div>
      <div className="team-spaces-list">{teamSpaces.map((space) => <button key={space.id} className={`team-space ${selectedSpaceId === space.id ? 'active-space' : ''}`} onClick={() => selectTeamSpace(space.id)}><span>#</span> {space.name} {space.unread > 0 && <b>{space.unread}</b>}</button>)}</div>
      {isAddingSpace ? <div className="new-space-form"><input autoFocus value={newSpaceName} onChange={(event) => setNewSpaceName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTeamSpace()} placeholder="space-name"/><button onClick={addTeamSpace}><Check size={13} /></button><button onClick={() => { setIsAddingSpace(false); setNewSpaceName('') }}><X size={13} /></button></div> : <button className="new-space" onClick={() => setIsAddingSpace(true)}><Plus size={15} /> Add a space</button>}
      <div className="sidebar-bottom">
        <button className="team-row" onClick={() => openAgentPortfolio('maya')}><Avatar id="maya" tone="violet" small /><span>Maya Chen</span><i className="online" /></button>
        <button className="team-row" onClick={() => openAgentPortfolio('noah')}><Avatar id="noah" tone="mint" small /><span>Noah Patel</span><i className="online" /></button>
        <button className="team-row" onClick={() => openAgentPortfolio('adele')}><Avatar id="adele" tone="orange" small /><span>Adele Okafor</span></button>
        <div className="your-profile"><Avatar id="you" tone="blue" /><span><b>Alex Morgan</b><small>Full-stack engineer</small></span><MoreHorizontal size={17} /></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="crumbs"><span>SignalDesk</span><ArrowRight size={13} /><b>{view === 'home' ? 'Today' : view === 'team-space' ? `# ${selectedSpace?.name}` : view === 'agent-profile' ? selectedAgent.name : nav.find((item) => item.id === view)?.label}</b></div>
        <div className="top-actions"><button className="icon-button" onClick={() => setHomeOverlay(homeOverlay === 'search' ? 'none' : 'search')} aria-label="Search organization"><Search size={18} /></button><button className="icon-button notification" onClick={() => setHomeOverlay(homeOverlay === 'notifications' ? 'none' : 'notifications')} aria-label="Open notifications"><Bell size={18} />{unreadNotifications > 0 && <i />}</button><button className="help-button" onClick={() => setHomeOverlay(homeOverlay === 'help' ? 'none' : 'help')} aria-label="Open help for this page">?</button></div>
      </header>
      {homeOverlay !== 'none' && <HomeControls overlay={homeOverlay} close={() => setHomeOverlay('none')} query={searchQuery} setQuery={setSearchQuery} issues={issues} messages={messages} activity={activity} workspaceCode={workspaceCode} prOpen={prOpen} notifications={notifications} readNotificationIds={readNotificationIds} currentView={view} selectResult={(target, spaceId, notificationId) => { if (spaceId) setSelectedSpaceId(spaceId); if (notificationId) setReadNotificationIds((ids) => ids.includes(notificationId) ? ids : [...ids, notificationId]); setView(target); setHomeOverlay('none') }} markAllNotificationsRead={() => setReadNotificationIds(notifications.map((item) => item.id))} advanceTime={advanceSimulationTime} />}
      {view === 'home' && <HomeView standupDone={standupDone} showCeremony={showCeremony} setShowCeremony={setShowCeremony} completeStandup={completeStandup} messages={activeMessages} allMessages={messages} liveEvents={liveEvents} selectedTeamSpace={selectedSpace} draft={draft} setDraft={setDraft} sendMessage={sendMessage} activity={activity} issues={issues} setView={setView} openAgentPortfolio={openAgentPortfolio} testsPassed={testsPassed} committed={committed} prOpen={prOpen} reviewAddressed={reviewAddressed} progress={progress} simulationMinutes={simulationMinutes} advanceTime={() => setHomeOverlay(homeOverlay === 'time' ? 'none' : 'time')} currentIssue={issues.find((issue) => issue.id === 'PROJ-184') || issues.find((issue) => issue.assignee === 'alex')} />}
      {view === 'team-space' && <TeamSpaceView space={selectedSpace} messages={activeMessages} draft={draft} setDraft={setDraft} sendMessage={sendMessage} sendThreadReply={(message, threadId) => sendMessage(undefined, message, threadId)} updateSpace={updateTeamSpace} updateMessage={updateMessage} deleteMessage={deleteMessage} openAgentPortfolio={openAgentPortfolio} />}
      {view === 'agent-profile' && <AgentPortfolioView agent={selectedAgent} openTeamSpace={() => selectTeamSpace(selectedAgent.id === 'devon' ? 'engineering' : selectedAgent.id === 'maya' ? 'releases' : 'product-usage')} />}
      {view === 'issues' && <FunctionalIssuesView issues={issues} createIssue={createIssue} updateIssue={updateIssue} openWorkspace={() => setView('workspace')} />}
      {view === 'workspace' && <FunctionalWorkspaceView code={workspaceCode} setCode={setWorkspaceCode} testsPassed={testsPassed} committed={committed} runTests={runTests} commit={commit} openPr={openPr} />}
      {view === 'pulls' && <FunctionalPullRequestsView prOpen={prOpen} reviewAddressed={reviewAddressed} reviewReplied={reviewReplied} approved={approved} merged={merged} addressReview={addressReview} replyToReview={replyToReview} mergePullRequest={mergePullRequest} />}
      {view === 'feedback' && <FunctionalFeedbackView organizationId={organizationId} />}
    </main>
    {toast && <div className={`toast ${toast.tone || ''}`}><Check size={17} />{toast.message}<button onClick={() => setToast(null)}><X size={15} /></button></div>}
  </div>
}

function formatSimulationTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function HomeControls({ overlay, close, query, setQuery, issues, messages, activity, workspaceCode, prOpen, notifications, readNotificationIds, currentView, selectResult, markAllNotificationsRead, advanceTime }: { overlay: HomeOverlay; close: () => void; query: string; setQuery: (value: string) => void; issues: WorkIssue[]; messages: TeamMessage[]; activity: string[]; workspaceCode: string; prOpen: boolean; notifications: NotificationItem[]; readNotificationIds: string[]; currentView: View; selectResult: (view: View, spaceId?: string, notificationId?: string) => void; markAllNotificationsRead: () => void; advanceTime: (minutes: number) => void }) {
  const normalizedQuery = query.trim().toLowerCase()
  const issueResults = normalizedQuery ? issues.filter((issue) => `${issue.id} ${issue.title} ${issue.description}`.toLowerCase().includes(normalizedQuery)).slice(0, 4) : []
  const messageResults = normalizedQuery ? messages.filter((message) => `${message.author} ${message.text}`.toLowerCase().includes(normalizedQuery)).slice(0, 4) : []
  const pullResults = normalizedQuery && (`pull request pr #482 code review review requested changes`.includes(normalizedQuery) || normalizedQuery.includes('pr')) ? [{ id: 'pr-482', title: 'PR #482 · Usage alerts empty state', detail: 'Learner pull request and merge gate' }] : []
  const workspaceResults = normalizedQuery && workspaceCode.toLowerCase().includes(normalizedQuery) ? [{ id: 'alerts-panel', title: 'alerts-panel.tsx', detail: 'Match found in the active workspace file' }] : []
  const activityResults = normalizedQuery ? activity.filter((item) => item.toLowerCase().includes(normalizedQuery)).slice(0, 4) : []
  const help = currentView === 'workspace' ? { title: 'Workspace guide', steps: ['Make the implementation yourself; AI teammates can clarify but do not write your assigned solution.', 'Run checks only after protecting the billing CTA with canManageBilling.', 'Commit passing work on your feature branch before opening a PR.'], target: 'workspace' as View, label: 'Open workspace' } : currentView === 'pulls' ? { title: 'Code review guide', steps: ['Read each requested change before marking it addressed.', 'Explain the implementation decision in your review response.', 'Merge remains gated until approval and a rationale are recorded.'], target: 'pulls' as View, label: 'Open pull requests' } : currentView === 'team-space' ? { title: 'Team space guide', steps: ['Keep decisions in the relevant channel so teammates can find context.', 'Use @mentions for a specific teammate and threads for focused follow-up.', 'Use attachments for artifacts; message ownership controls apply only to your posts.'], target: 'team-space' as View, label: 'Open team space' } : currentView === 'issues' ? { title: 'Issue board guide', steps: ['Review acceptance criteria and dependencies before changing status.', 'Update priority, owner, and blockers as scenario facts change.', 'Use the issue workspace link when you are ready to implement.'], target: 'issues' as View, label: 'Open issue board' } : currentView === 'feedback' ? { title: 'Coaching guide', steps: ['Feedback is private and tied to immutable simulation evidence.', 'Use evidence to identify one specific process or communication improvement.', 'Refresh after meaningful actions to review new signals.'], target: 'feedback' as View, label: 'Open coaching' } : { title: 'Today guide', steps: ['Post your stand-up and make dependencies visible.', 'Clarify assumptions before implementation, then test your own change.', 'Use the PR gate to practice review, rationale, and merge discipline.'], target: 'home' as View, label: 'Open today' }
  return <div className="home-overlay-layer" role="presentation" onMouseDown={close}>
    <section className={`home-overlay ${overlay}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <button className="overlay-close" onClick={close} aria-label="Close"><X size={16} /></button>
      {overlay === 'time' && <><span className="eyebrow">SIMULATION CLOCK</span><h2>Advance the workday</h2><p>Time moves only when you choose. Scheduled follow-ups and release pressure are triggered from the scenario state.</p><div className="time-options"><button onClick={() => advanceTime(15)}>+15 min <small>Quick focus block</small></button><button onClick={() => advanceTime(60)}>+1 hour <small>Team check-ins may arrive</small></button><button onClick={() => advanceTime(180)}>+3 hours <small>Move toward stakeholder review</small></button></div></>}
      {overlay === 'search' && <><span className="eyebrow">ORGANIZATION SEARCH</span><h2>Find work and context</h2><input autoFocus className="global-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues, people, or messages" />{!normalizedQuery ? <p>Search across the current scenario’s issue board and team conversations.</p> : <div className="search-results">{issueResults.map((issue) => <button key={issue.id} onClick={() => selectResult('issues')}><CircleDot size={15} /><span><b>{issue.id} · {issue.title}</b><small>{issue.status.replace('_', ' ')} · {issue.priority} priority</small></span></button>)}{messageResults.map((message) => <button key={message.id} onClick={() => selectResult('team-space', message.spaceId)}><MessageSquare size={15} /><span><b>{message.author} in #{message.spaceId}</b><small>{message.text.slice(0, 90)}</small></span></button>)}{!issueResults.length && !messageResults.length && <p>No scenario records match “{query}”.</p>}</div>}</>}
      {overlay === 'search' && normalizedQuery && (pullResults.length > 0 || workspaceResults.length > 0 || activityResults.length > 0) && <div className="search-results extended-search-results">{pullResults.map((result) => <button key={result.id} onClick={() => selectResult('pulls')}><GitBranch size={15} /><span><b>{result.title}</b><small>{result.detail}</small></span></button>)}{workspaceResults.map((result) => <button key={result.id} onClick={() => selectResult('workspace')}><Code2 size={15} /><span><b>{result.title}</b><small>{result.detail}</small></span></button>)}{activityResults.map((item) => <button key={item} onClick={() => selectResult('feedback')}><Check size={15} /><span><b>Simulation activity</b><small>{item}</small></span></button>)}</div>}
      {overlay === 'notifications' && <><div className="notification-title"><div><span className="eyebrow">ACTION REQUIRED</span><h2>Notifications</h2></div><button className="ghost-button" onClick={markAllNotificationsRead}>Mark all read</button></div><div className="notification-list">{notifications.length ? notifications.map((notification) => <button key={notification.id} className={readNotificationIds.includes(notification.id) ? 'notification-read' : ''} onClick={() => selectResult(notification.view, notification.spaceId, notification.id)}><Bell size={16} /><span><b>{notification.title}</b><small>{notification.detail}</small></span><ArrowRight size={14} /></button>) : <p>You are caught up. New scenario events will appear here.</p>}</div></>}
      {overlay === 'help' && <><span className="eyebrow">CONTEXTUAL HELP</span><h2>{help.title}</h2><ol className="guide-list">{help.steps.map((step) => <li key={step}>{step}</li>)}</ol><button className="primary-button" onClick={() => selectResult(help.target)}>{help.label} <ArrowRight size={15} /></button></>}
      {overlay === 'organization' && <><span className="eyebrow">CURRENT ORGANIZATION</span><h2>SignalDesk</h2><p>Pro workspace · Curated B2B SaaS scenario · Sprint 2 of 3</p><div className="org-overview"><span><UsersRound size={16} /> 6 AI teammates</span><span><CircleDot size={16} /> {issues.filter((issue) => issue.status !== 'done').length} active issues</span><span><GitBranch size={16} /> {prOpen ? '1 learner PR in progress' : 'No learner PR yet'}</span></div><button className="primary-button" onClick={() => selectResult('home')}>Open today’s work <ArrowRight size={15} /></button></>}
    </section>
  </div>
}

function HomeView(props: { standupDone: boolean; showCeremony: boolean; setShowCeremony: (v: boolean) => void; completeStandup: () => void; messages: TeamMessage[]; allMessages: TeamMessage[]; liveEvents: SimulationEvent[]; selectedTeamSpace: TeamSpace; draft: string; setDraft: (v: string) => void; sendMessage: (attachment?: TeamAttachment) => void; activity: string[]; issues: WorkIssue[]; setView: (v: View) => void; openAgentPortfolio: (id: string) => void; testsPassed: boolean; committed: boolean; prOpen: boolean; reviewAddressed: boolean; progress: number; simulationMinutes: number; advanceTime: () => void; currentIssue?: WorkIssue }) {
  const { standupDone, showCeremony, setShowCeremony, completeStandup, messages, allMessages, liveEvents, selectedTeamSpace, draft, setDraft, sendMessage, activity, issues, setView, openAgentPortfolio, testsPassed, committed, prOpen, reviewAddressed, progress, simulationMinutes, advanceTime, currentIssue } = props
  const task = currentIssue || seededIssues[0]
  const nextStep = !standupDone
    ? { title: 'Post your stand-up', detail: 'Make today’s work and any dependency risks visible to the team.', label: 'Post update', action: () => setShowCeremony(true) }
    : !testsPassed
      ? { title: 'Implement the role guard', detail: 'Use the canManageBilling guard, then run the branch checks.', label: 'Open workspace', action: () => setView('workspace') }
      : !committed
        ? { title: 'Commit the verified change', detail: 'Capture the tested implementation on your feature branch.', label: 'Open workspace', action: () => setView('workspace') }
        : !prOpen
          ? { title: 'Request a review', detail: 'Open a pull request so your teammates can inspect the change.', label: 'Open pull requests', action: () => setView('pulls') }
          : !reviewAddressed
            ? { title: 'Address the review', detail: 'Resolve the requested change and explain the decision to Noah.', label: 'Open review', action: () => setView('pulls') }
            : { title: 'Keep the release moving', detail: 'Reply to the review, record the rationale, and complete the merge gate.', label: 'Open review', action: () => setView('pulls') }
  return <div className="page home-page">
    <section className="welcome"><div><p className="eyebrow">WEDNESDAY, SEPTEMBER 18 · SPRINT 2 OF 3</p><h1>Good morning, Alex <span>✦</span></h1><p>Here’s what needs your attention in SignalDesk today.</p></div><button className="time-button" onClick={advanceTime}><Clock3 size={16} /> Simulated time <b>{formatSimulationTime(simulationMinutes)}</b><ChevronDown size={14} /></button></section>
    <section className="priority-grid">
      <div className="ceremony-card"><div className="card-icon lavender"><UsersRound size={19} /></div><div><span className="pill lavender-pill">CEREMONY</span><h3>Async stand-up is due</h3><p>Share your plan and flag any blockers with the team.</p></div><button className={standupDone ? 'complete-button done' : 'complete-button'} onClick={() => setShowCeremony(!showCeremony)}>{standupDone ? <><Check size={16} /> Posted</> : <>Post update <ArrowRight size={15} /></>}</button>
        {showCeremony && !standupDone && <div className="standup-popover"><b>Today’s stand-up</b><p>What did you finish? What will you work on? Any blockers?</p><button onClick={completeStandup}>Post my update</button></div>}
      </div>
      <div className="priority-card"><div className="card-icon coral"><Bell size={19} /></div><div><span className="pill coral-pill">{task.priority.toUpperCase()} PRIORITY</span><h3>{task.title}</h3><p>{task.id} · {task.status === 'done' ? 'Completed' : task.status === 'blocked' ? 'Blocked' : 'Due tomorrow'}</p></div><button className="soft-icon" onClick={() => setView('issues')} aria-label={`Open ${task.id}`}><ArrowRight size={18} /></button></div>
      <div className="priority-card"><div className="card-icon sky"><MessageSquare size={19} /></div><div><span className="pill sky-pill">{prOpen ? reviewAddressed ? 'REVIEW IN PROGRESS' : 'WAITING ON YOU' : 'COLLABORATION'}</span><h3>{prOpen ? reviewAddressed ? 'Explain your review update' : 'Reply to Noah’s review' : 'Clarify the API edge case'}</h3><p>{prOpen ? 'PR #482 · Required review step' : 'Ask Noah before implementation'}</p></div><button className="soft-icon" onClick={() => setView(prOpen ? 'pulls' : 'team-space')} aria-label="Open collaboration task"><ArrowRight size={18} /></button></div>
    </section>
    <div className="content-grid">
      <section className="card task-card"><div className="section-head"><div><span className="eyebrow">YOUR FOCUS</span><h2>Current task</h2></div><button className="ghost-button" onClick={() => setView('issues')}>View issue <ArrowRight size={14} /></button></div>
        <div className="issue-top"><span className={`status-dot ${task.status === 'done' ? 'done' : task.status === 'blocked' ? 'blocked' : task.status === 'in_review' ? 'review' : ''}`} /><span className="issue-id">{task.id}</span><span className="pill coral-pill">{task.priority.toUpperCase()}</span><span className="sprint-chip">{task.sprint}</span></div>
        <h3>{task.title}</h3><p className="task-description">{task.description}</p>
        <div className="task-details"><div><small>ASSIGNED BY</small><span><Avatar id="maya" tone="violet" small /> Maya Chen</span></div><div><small>DEPENDENCY</small><span className="dependency"><Lock size={13} /> {task.dependencyIds.length ? task.dependencyIds.join(', ') : 'No blockers'}</span></div><div><small>ESTIMATE</small><span>{task.estimate} points</span></div></div>
        <div className="next-action"><Sparkles size={17} /><div><b>{nextStep.title}</b><span>{nextStep.detail}</span></div><button onClick={nextStep.action}>{nextStep.label}</button></div>
      </section>
      <section className="card progress-card"><div className="section-head"><div><span className="eyebrow">SIMULATION PROGRESS</span><h2>Sprint readiness</h2></div><span className="progress-score">{progress}/5</span></div>
        <div className="progress-track"><i style={{ width: `${progress * 20}%` }} /></div>
        {[
          [standupDone, 'Post stand-up'], [testsPassed, 'Pass branch checks'], [committed, 'Commit your change'], [prOpen, 'Open a pull request'], [reviewAddressed, 'Address review'],
        ].map(([done, label]) => <div className="check-row" key={String(label)}><span className={done ? 'checked' : ''}>{done ? <Check size={13} /> : ''}</span>{label}</div>)}
      </section>
    </div>
    <OrgActivityMap issues={issues} messages={allMessages} liveEvents={liveEvents} simulationMinutes={simulationMinutes} standupDone={standupDone} testsPassed={testsPassed} committed={committed} prOpen={prOpen} reviewAddressed={reviewAddressed} setView={setView} />
    <div className="content-grid lower-grid">
      <section className="card conversation-card"><div className="section-head"><div><span className="eyebrow">TEAM CONVERSATION</span><h2><span className="hash">#</span> {selectedTeamSpace.name} {selectedTeamSpace.unread > 0 && <em>{selectedTeamSpace.unread} unread</em>}</h2></div><button className="ghost-button" onClick={() => setView('team-space')}>Open channel <ArrowRight size={14} /></button></div>
        <div className="messages">{messages.map((message) => { const agentId = message.author === 'You' ? '' : message.author.startsWith('Maya') ? 'maya' : message.author.startsWith('Noah') ? 'noah' : message.author.startsWith('Adele') ? 'adele' : 'devon'; return <div className="message" key={message.id}><Avatar id={agentId || 'you'} tone={message.tone} /><div><div className="message-meta">{agentId ? <button className="agent-name" onClick={() => openAgentPortfolio(agentId)}>{message.author}</button> : <b>{message.author}</b>}<span>{message.role}</span><time>{message.time}</time></div><p><MessageText text={message.text} openAgentPortfolio={openAgentPortfolio} /> {message.link && <a>{message.link}</a>}</p></div></div>})}</div>
        <MentionComposer className="message-composer" draft={draft} setDraft={setDraft} sendMessage={sendMessage} placeholder={`Message #${selectedTeamSpace.name}`}/>
      </section>
      <section className="card activity-card"><div className="section-head"><div><span className="eyebrow">LIVE ORG ACTIVITY</span><h2>While you were away</h2></div><button className="ghost-button" onClick={() => setView('feedback')}>View evidence <ArrowRight size={14} /></button></div>
        <div className="activity-item"><span className="activity-icon mint"><GitBranch size={15} /></span><p><b>Devon</b> merged <a>PR #477</a><small>12 min ago</small></p></div><div className="activity-item"><span className="activity-icon orange"><CircleDot size={15} /></span><p><b>Maya</b> reprioritized <a>PROJ-191</a><small>24 min ago</small></p></div><div className="activity-item"><span className="activity-icon lavender"><Bot size={15} /></span><p><b>QA bot</b> flagged a regression risk<a>Release note</a><small>31 min ago</small></p></div>
        {activity.map((item) => <div className="activity-item learner-activity" key={item}><span className="activity-icon blue"><Check size={15} /></span><p><b>You</b> {item}<small>just now</small></p></div>)}
      </section>
    </div>
  </div>
}

function TeamSpaceView({ space, messages, draft, setDraft, sendMessage, sendThreadReply, updateSpace, updateMessage, deleteMessage, openAgentPortfolio }: { space: TeamSpace; messages: TeamMessage[]; draft: string; setDraft: (value: string) => void; sendMessage: (attachment?: TeamAttachment) => void; sendThreadReply: (message: string, threadId: number) => void; updateSpace: (space: TeamSpace) => void; updateMessage: (id: number, text: string) => void; deleteMessage: (id: number) => void; openAgentPortfolio: (id: string) => void }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [threadId, setThreadId] = useState<number | null>(null)
  const [threadDraft, setThreadDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [nameDraft, setNameDraft] = useState(space.name)
  const [descriptionDraft, setDescriptionDraft] = useState(space.description || '')
  const [memberIds, setMemberIds] = useState(space.memberIds || ['maya', 'noah', 'adele', 'devon', 'you'])
  useEffect(() => { setNameDraft(space.name); setDescriptionDraft(space.description || ''); setMemberIds(space.memberIds || ['maya', 'noah', 'adele', 'devon', 'you']); setSettingsOpen(false); setThreadId(null) }, [space.id, space.name, space.description, space.memberIds])
  const agentIdFor = (message: TeamMessage) => message.author === 'You' ? '' : message.author.startsWith('Maya') ? 'maya' : message.author.startsWith('Noah') ? 'noah' : message.author.startsWith('Adele') ? 'adele' : 'devon'
  const roots = messages.filter((message) => !message.threadId)
  const members = memberIds.map((id) => mentionOptions.find((option) => option.id === id)).filter(Boolean)
  const saveSettings = () => { updateSpace({ ...space, name: nameDraft, description: descriptionDraft.trim() || 'A focused space for decisions, updates, and working context.', memberIds }); setSettingsOpen(false) }
  const toggleMember = (id: string) => setMemberIds((ids) => id === 'you' ? ids : ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  return <div className="page team-space-page">
    <section className="channel-hero"><div><p className="eyebrow">TEAM SPACE</p><h1><span>#</span> {space.name}</h1><p>{space.description || 'Decisions and updates shared with the SignalDesk team.'}</p></div><div className="channel-members"><div className="avatar-stack">{members.slice(0, 4).map((member) => <Avatar key={member!.id} id={member!.id} tone={member!.tone} small />)}</div><span>{members.length} members</span><button className="soft-icon" onClick={() => setSettingsOpen(!settingsOpen)} aria-label="Edit team space"><Settings2 size={16} /></button></div></section>
    {settingsOpen && <section className="channel-settings card"><div><span className="eyebrow">SPACE SETTINGS</span><h3>Keep the channel useful</h3></div><label>Name<input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} /></label><label>Description<textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} /></label><div className="member-picker"><b><UserPlus size={14} /> Members</b><div>{mentionOptions.map((member) => <button key={member.id} className={memberIds.includes(member.id) ? 'selected-member' : ''} onClick={() => toggleMember(member.id)}><Avatar id={member.id} tone={member.tone} small /> {member.label}{member.id === 'you' && <small>Required</small>}</button>)}</div></div><div className="settings-actions"><button className="ghost-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={saveSettings}><Check size={15} /> Save space</button></div></section>}
    <section className="channel-layout"><article className="channel-thread"><div className="channel-notice"><MessageSquare size={16} /><span>This is the beginning of <b>#{space.name}</b>. Keep updates discoverable for the whole team.</span></div><div className="channel-messages">{roots.map((message) => { const agentId = agentIdFor(message); const replies = messages.filter((item) => item.threadId === message.id); return <div className="message-block" key={message.id}><div className="message channel-message"><Avatar id={agentId || 'you'} tone={message.tone} /><div className="message-content"><div className="message-meta">{agentId ? <button className="agent-name" onClick={() => openAgentPortfolio(agentId)}>{message.author}</button> : <b>{message.author}</b>}<span>{message.role}</span><time>{message.time}{message.edited && ' · edited'}</time></div>{editingId === message.id ? <div className="edit-message"><input autoFocus value={editDraft} onChange={(event) => setEditDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { updateMessage(message.id, editDraft); setEditingId(null) } }} /><button onClick={() => { updateMessage(message.id, editDraft); setEditingId(null) }}><Check size={13} /></button><button onClick={() => setEditingId(null)}><X size={13} /></button></div> : <><p><MessageText text={message.text} openAgentPortfolio={openAgentPortfolio} /> {message.link && <a>{message.link}</a>}</p>{message.attachment && <span className="message-attachment"><FileText size={13} /> {message.attachment.name}<small>{Math.max(1, Math.round(message.attachment.size / 1024))} KB</small></span>}</>}<div className="message-actions"><button onClick={() => { setThreadId(threadId === message.id ? null : message.id); setThreadDraft('') }}><Reply size={13} /> {replies.length ? `${replies.length} replies` : 'Reply in thread'}</button>{message.author === 'You' && <><button onClick={() => { setEditingId(message.id); setEditDraft(message.text) }}><Pencil size={12} /> Edit</button><button onClick={() => deleteMessage(message.id)}><Trash2 size={12} /> Delete</button></>}</div></div></div>{threadId === message.id && <div className="thread-panel"><b>Thread</b>{replies.map((reply) => <div className="thread-reply" key={reply.id}><Avatar id={agentIdFor(reply) || 'you'} tone={reply.tone} small /><span><strong>{reply.author}</strong> {reply.text || (reply.attachment ? `Shared ${reply.attachment.name}` : '')}<small>{reply.time}{reply.edited && ' · edited'}</small></span></div>)}<div className="thread-composer"><input value={threadDraft} onChange={(event) => setThreadDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && threadDraft.trim()) { sendThreadReply(threadDraft, message.id); setThreadDraft('') } }} placeholder="Reply in thread"/><button onClick={() => { if (threadDraft.trim()) { sendThreadReply(threadDraft, message.id); setThreadDraft('') } }}><Send size={14} /></button></div></div>}</div>})}</div><MentionComposer className="channel-composer" draft={draft} setDraft={setDraft} sendMessage={sendMessage} placeholder={`Message #${space.name}`}/></article>
      <aside className="channel-details"><span className="eyebrow">ABOUT THIS SPACE</span><h3>Team context</h3><p>{space.description || 'Decisions and updates shared with the SignalDesk team.'}</p><hr/><span className="eyebrow">MEMBERS</span>{members.map((member) => <button className="channel-member" key={member!.id} onClick={() => member!.id === 'you' ? undefined : openAgentPortfolio(member!.id)}><Avatar id={member!.id} tone={member!.tone} small /> {member!.label} <span>{member!.id === 'you' ? 'You' : member!.role}</span></button>)}</aside></section>
  </div>
}

function AgentPortfolioView({ agent, openTeamSpace }: { agent: AgentPortfolio; openTeamSpace: () => void }) {
  return <div className="page portfolio-page">
    <section className="portfolio-hero"><div className={`portfolio-avatar ${agent.tone}`}>{agent.initials}</div><div><p className="eyebrow">AI TEAMMATE PORTFOLIO</p><h1>{agent.name}</h1><span className="portfolio-role">{agent.role}</span><p>{agent.headline}</p></div><button className="primary-button" onClick={openTeamSpace}><MessageSquare size={16} /> Message {agent.name.split(' ')[0]}</button></section>
    <div className="portfolio-grid"><section className="card portfolio-summary"><span className="eyebrow">ROLE MANDATE</span><h2>How {agent.name.split(' ')[0]} contributes</h2><p>{agent.bio}</p><div className="portfolio-section"><span className="eyebrow">COLLABORATION STYLE</span><p>{agent.collaborationStyle}</p></div></section><section className="card portfolio-focus"><span className="eyebrow">CURRENT COMMITMENTS</span><h2>What they’re focused on</h2>{agent.currentFocus.map((item) => <div className="focus-row" key={item}><CircleDot size={15} /> {item}</div>)}<button className="ghost-button" onClick={openTeamSpace}>Open their team space <ArrowRight size={14} /></button></section></div>
    <div className="portfolio-grid lower-portfolio"><section className="card"><span className="eyebrow">CORE STRENGTHS</span><h2>Working toolkit</h2><div className="strength-tags">{agent.strengths.map((strength) => <span key={strength}>{strength}</span>)}</div></section><section className="card"><span className="eyebrow">ORGANIZATION EVIDENCE</span><h2>Recent contribution trail</h2><div className="evidence-trail">{agent.evidence.map((item) => <div key={item}><Check size={15} /> {item}</div>)}</div></section></div>
  </div>
}

function IssuesView({ setView }: { setView: (v: View) => void }) {
  const columns = [
    { name: 'To do', count: 2, cards: [['PROJ-184', 'Build the usage alerts empty state', 'high'], ['PROJ-191', 'Add limit badge to settings nav', 'medium']] },
    { name: 'In progress', count: 2, cards: [['PROJ-176', 'Harden billing event mapper', 'blocked'], ['PROJ-189', 'Usage chart tooltips', 'medium']] },
    { name: 'In review', count: 1, cards: [['PROJ-179', 'Loading state for alert rules', 'review']] },
    { name: 'Done', count: 2, cards: [['PROJ-170', 'Plan usage API contract', 'done'], ['PROJ-168', 'Refresh usage dashboard copy', 'done']] },
  ]
  return <div className="page board-page"><section className="page-title"><div><p className="eyebrow">SPRINT 2 · SEPT 16–27</p><h1>Product usage</h1><p>Keep the Pro plan experience coherent as usage features expand.</p></div><button className="primary-button"><Plus size={16} /> New issue</button></section><div className="board-toolbar"><div className="tabs"><button className="selected">Board</button><button>All issues</button><button>Planning</button></div><div><button className="filter-button">Filter <ChevronDown size={15} /></button><button className="filter-button">Group: Status <ChevronDown size={15} /></button></div></div><div className="board">{columns.map((column) => <div className="board-column" key={column.name}><div className="column-head"><b>{column.name}</b><span>{column.count}</span><MoreHorizontal size={17} /></div>{column.cards.map(([id, title, state]) => <article className="issue-card" key={id} onClick={() => id === 'PROJ-184' && setView('workspace')}><div className="issue-card-top"><span className={`status-dot ${state}`} /><small>{id}</small><MoreHorizontal size={15} /></div><h3>{title}</h3><div className="issue-card-footer"><span className={`pill ${state === 'high' ? 'coral-pill' : state === 'blocked' ? 'blocked-pill' : state === 'review' ? 'sky-pill' : 'muted-pill'}`}>{state === 'high' ? 'HIGH' : state === 'blocked' ? 'BLOCKED' : state === 'review' ? 'IN REVIEW' : state === 'done' ? 'DONE' : 'MEDIUM'}</span><span>3 pts</span><Avatar id={id === 'PROJ-184' ? 'you' : id === 'PROJ-176' ? 'noah' : 'maya'} tone={id === 'PROJ-176' ? 'mint' : 'blue'} small /></div></article>)}</div>)}</div></div>
}

function WorkspaceView({ testsPassed, committed, runTests, commit, openPr }: { testsPassed: boolean; committed: boolean; runTests: () => void; commit: () => void; openPr: () => void }) {
  return <div className="workspace-page"><div className="workspace-header"><div><GitBranch size={16} /><b>feat/usage-alerts-empty-state</b><span>ahead 1</span></div><div><button className="terminal-button"><TerminalSquare size={16} /> Terminal</button><button className="test-button" onClick={runTests}><Play size={15} /> {testsPassed ? '12 checks passed' : 'Run checks'}</button><button className="primary-button" onClick={openPr}>Open pull request</button></div></div><div className="editor-shell"><aside className="file-tree"><div className="tree-title"><b>EXPLORER</b><MoreHorizontal size={15} /></div><div className="repo-title"><ChevronDown size={14} /> signaldesk-web</div><div className="tree-folder"><ChevronDown size={14} /> src</div><div className="tree-folder nested"><ChevronDown size={14} /> features</div><div className="tree-folder nested-2"><ChevronDown size={14} /> usage-alerts</div><div className="tree-file active-file"><FileCode2 size={15} /> alerts-panel.tsx</div><div className="tree-file"><FileCode2 size={15} /> alert-list.tsx</div><div className="tree-file"><FileCode2 size={15} /> types.ts</div><div className="tree-folder"><ChevronDown size={14} /> components</div><div className="tree-file"><FileCode2 size={15} /> empty-state.tsx</div><div className="tree-file"><FileCode2 size={15} /> package.json</div><div className="source-control"><GitBranch size={16} /><span>Source control</span><b>1</b></div></aside><section className="editor"><div className="editor-tabs"><div className="editor-tab active-tab"><FileCode2 size={15} /> alerts-panel.tsx <X size={13} /></div><button>+</button></div><div className="breadcrumbs">src <span>›</span> features <span>›</span> usage-alerts <span>›</span> alerts-panel.tsx</div><pre className="code-view">{code.split('\n').map((line, index) => <code key={index}><i>{String(index + 1).padStart(2, ' ')}</i>{line}</code>)}</pre><div className="editor-status"><span><span className="dot-green" /> TypeScript React</span><span>Ln 16, Col 4</span><span>Spaces: 2</span><span>UTF-8</span></div></section><aside className="context-panel"><div className="context-top"><Bot size={17} /><b>AI teammate context</b></div><div className="context-role"><Avatar id="noah" tone="mint" /><div><b>Noah · Tech lead</b><span>Review note on this task</span></div></div><blockquote>“Remember that some legacy workspaces have no threshold field. The empty state must not depend on it.”</blockquote><button className="context-link">Open API contract <ArrowRight size={14} /></button><hr/><span className="eyebrow">MERGE REQUIREMENTS</span><div className="requirement"><Check size={15} /> Branch checks pass</div><div className="requirement"><span /> 1 approving review</div><div className="requirement"><span /> Merge rationale</div><button className={committed ? 'commit-button committed' : 'commit-button'} onClick={commit}>{committed ? <><Check size={15} /> Changes committed</> : 'Commit changes'}</button></aside></div></div>
}

function PullsView({ prOpen, reviewAddressed, setReviewAddressed, notify }: { prOpen: boolean; reviewAddressed: boolean; setReviewAddressed: (v: boolean) => void; notify: (m: string, t?: 'success' | 'warning') => void }) {
  return <div className="page pulls-page"><section className="page-title"><div><p className="eyebrow">CODE REVIEW</p><h1>Pull requests</h1><p>Reviews are part of the work. Respond thoughtfully and keep the release train moving.</p></div><button className="primary-button"><Plus size={16} /> New pull request</button></section><div className="pull-tabs"><button className="selected">Open <b>{prOpen ? 2 : 1}</b></button><button>Closed</button><button>Drafts</button></div>{prOpen && <article className="pr-detail"><div className="pr-header"><div><span className="open-dot" /> <b>PR #482</b><h2>Build the usage alerts empty state</h2><p>Alex Morgan wants to merge 1 commit into <code>main</code> from <code>feat/usage-alerts-empty-state</code></p></div><span className="pill sky-pill">OPEN</span></div><div className="pr-layout"><div><div className="checks"><ShieldCheck size={19} /><div><b>All checks have passed</b><span>12 checks completed in 38s</span></div><button>View checks</button></div><section className="review-thread"><div className="review-head"><Avatar id="noah" tone="mint" /><div><b>Noah Patel <span>requested changes</span></b><small>8 min ago</small></div></div><p>Nice start. One concern: we should avoid linking users directly to billing settings if their role can’t manage plans. Can you use the existing <code>canManageBilling</code> guard?</p><div className="thread-actions"><button>Reply</button><button onClick={() => { setReviewAddressed(true); notify('Review marked as addressed. Add a response before merging.') }}>{reviewAddressed ? <><Check size={14} /> Addressed</> : 'Mark as addressed'}</button></div></section></div><aside className="merge-panel"><span className="eyebrow">MERGE GATE</span><h3>{reviewAddressed ? 'One step left' : 'Changes requested'}</h3><p>{reviewAddressed ? 'Write a merge rationale after Noah approves the update.' : 'Address Noah’s review before this pull request can merge.'}</p><div className="gate-row"><Check size={15} /> Checks passing</div><div className="gate-row"><Check size={15} className={reviewAddressed ? 'ready' : ''} /> Review response</div><div className="gate-row"><span /> Required approval</div><button className="merge-button" onClick={() => notify('Merge is locked until an approving review and rationale are recorded.', 'warning')}><Lock size={15} /> Merge blocked</button></aside></div></article>}{!prOpen && <article className="empty-pr"><GitBranch size={28} /><h2>No pull request yet</h2><p>Once you commit your work, open a pull request to invite reviews and start the merge gate.</p></article>}<article className="pr-row"><span className="open-dot" /><div><b>PR #479</b><h3>Polish loading state for alert rules</h3><p>Devon Reeves · Waiting for your response</p></div><span className="pill coral-pill">1 COMMENT</span></article></div>
}

function FeedbackView({ progress }: { progress: number }) {
  const score = 68 + progress * 4
  return <div className="page feedback-page"><section className="page-title"><div><p className="eyebrow">PRIVATE COACHING</p><h1>How you’re working</h1><p>Evidence-based feedback from your actions in this organization. This is visible only to you.</p></div><span className="private-badge"><Lock size={14} /> Private</span></section><div className="coaching-hero"><div><span className="eyebrow">CURRENT SPRINT SIGNAL</span><h2>You’re building momentum.</h2><p>You picked up the highest-priority task and have a clear next action. Keep the team looped in before you commit to an API assumption.</p><button className="secondary-button">See coaching guide <ArrowRight size={15} /></button></div><ScoreRing score={score} label="Work readiness" accent="#7c70f2" /></div><div className="score-grid"><ScoreRing score={76} label="Technical execution" accent="#3eae90" /><ScoreRing score={Math.min(95, 55 + progress * 7)} label="Collaboration" accent="#7c70f2" /><ScoreRing score={70 + progress * 3} label="Ownership & reliability" accent="#ee9d5c" /><ScoreRing score={standaloneProcess(progress)} label="Process fit" accent="#5899e7" /></div><div className="feedback-columns"><section className="card evidence-card"><div className="section-head"><div><span className="eyebrow">EVIDENCE FROM THIS SPRINT</span><h2>What we’re observing</h2></div></div><div className="evidence positive"><span><Check size={16} /></span><div><b>Priority awareness</b><p>You selected a high-priority sprint item before lower-impact work.</p></div></div><div className="evidence action"><span><MessageSquare size={16} /></span><div><b>Opportunity: clarify early</b><p>Noah identified an API edge case. Ask one concrete question before implementation to strengthen your decision trail.</p></div></div><div className="evidence neutral"><span><Clock3 size={16} /></span><div><b>Process signal pending</b><p>Complete your stand-up and review cycle to unlock feedback on reliability.</p></div></div></section><section className="card path-card"><span className="eyebrow">NEXT GROWTH STEP</span><h2>Make your assumptions visible</h2><p>Strong engineers expose uncertainty early, especially when working in legacy systems.</p><div className="coach-tip"><Bot size={18} /><span>Try: “Noah, for legacy workspaces without a threshold, should the empty state still show the plan CTA?”</span></div><button className="primary-button">Practice this message <ArrowRight size={15} /></button></section></div></div>
}

function standaloneProcess(progress: number) { return Math.min(92, 48 + progress * 8) }

export default App
