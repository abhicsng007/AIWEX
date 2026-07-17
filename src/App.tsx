'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SimulationEventType } from '@/features/simulator/domain/types'
import FunctionalWorkspaceView from '@/features/simulator/components/functional-workspace-view'
import FunctionalPullRequestsView from '@/features/simulator/components/functional-pull-requests-view'
import FunctionalFeedbackView from '@/features/simulator/components/functional-feedback-view'
import {
  ArrowRight, Bell, Bot, Check, ChevronDown, CircleDot, Clock3, Code2,
  Columns3, FileCode2, GitBranch, Inbox, Layers3, LayoutDashboard, Lock,
  MessageSquare, MoreHorizontal, Paperclip, Play, Plus, Search, Send,
  Settings, ShieldCheck, Sparkles, TerminalSquare, UsersRound, X,
} from 'lucide-react'

type View = 'home' | 'issues' | 'workspace' | 'pulls' | 'feedback' | 'team-space'
type Toast = { message: string; tone?: 'success' | 'warning' } | null
type TeamSpace = { id: string; name: string; unread: number }
type TeamMessage = { id: number; spaceId: string; author: string; role: string; initials: string; tone: string; time: string; text: string; link: string }
const organizationId = 'signaldesk-alpha'

const avatars: Record<string, string> = {
  maya: 'M', noah: 'N', adele: 'A', marcus: 'M', devon: 'D', you: 'Y',
}

const initialMessages = [
  { id: 1, author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: '9:12 AM', text: 'Morning team — we need the usage-alerts experience ready for the Pro plan review. @you, I moved the empty state ticket into this sprint. Please check the acceptance criteria before you start.', link: 'PROJ-184' },
  { id: 2, author: 'Noah Patel', role: 'Tech Lead', initials: 'N', tone: 'mint', time: '9:18 AM', text: 'A quick heads up: the billing events API is still a little fragile. Don’t assume `threshold` is always present; we have older workspaces in production.', link: '' },
  { id: 3, author: 'Adele Okafor', role: 'Product Designer', initials: 'A', tone: 'orange', time: '9:26 AM', text: 'I dropped annotated states in the handoff doc. The empty state should feel calm, not like an error. Happy to answer questions before you implement.', link: 'Design handoff' },
]

const initialSpaces: TeamSpace[] = [
  { id: 'product-usage', name: 'product-usage', unread: 3 },
  { id: 'engineering', name: 'engineering', unread: 0 },
  { id: 'releases', name: 'releases', unread: 0 },
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

  useEffect(() => {
    const saved = localStorage.getItem('shiftline-alpha-progress')
    if (saved) {
      const state = JSON.parse(saved) as { standupDone: boolean; testsPassed: boolean; committed: boolean; prOpen: boolean; reviewAddressed: boolean; reviewReplied?: boolean; approved?: boolean; merged?: boolean; activity: string[]; workspaceCode?: string; messages?: TeamMessage[]; teamSpaces?: TeamSpace[]; selectedSpaceId?: string }
      setStandupDone(state.standupDone); setTestsPassed(state.testsPassed); setCommitted(state.committed)
      setPrOpen(state.prOpen); setReviewAddressed(state.reviewAddressed); setReviewReplied(state.reviewReplied || false); setApproved(state.approved || false); setMerged(state.merged || false); setActivity(state.activity || []); setWorkspaceCode(state.workspaceCode || code); setMessages(state.messages || seedMessages); setTeamSpaces(state.teamSpaces || initialSpaces); setSelectedSpaceId(state.selectedSpaceId || 'product-usage')
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('shiftline-alpha-progress', JSON.stringify({ standupDone, testsPassed, committed, prOpen, reviewAddressed, reviewReplied, approved, merged, activity, workspaceCode, messages, teamSpaces, selectedSpaceId }))
  }, [standupDone, testsPassed, committed, prOpen, reviewAddressed, reviewReplied, approved, merged, activity, workspaceCode, messages, teamSpaces, selectedSpaceId])

  const progress = useMemo(() => [standupDone, testsPassed, committed, prOpen, reviewAddressed].filter(Boolean).length, [standupDone, testsPassed, committed, prOpen, reviewAddressed])
  const selectedSpace = teamSpaces.find((space) => space.id === selectedSpaceId) || teamSpaces[0]
  const activeMessages = messages.filter((message) => message.spaceId === selectedSpaceId)
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
  const addTeamSpace = () => {
    const name = newSpaceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!name) return notify('Give the new team space a name.', 'warning')
    if (teamSpaces.some((space) => space.name === name)) return notify('A team space with that name already exists.', 'warning')
    const space: TeamSpace = { id: `space-${Date.now()}`, name, unread: 0 }
    setTeamSpaces((spaces) => [...spaces, space]); setMessages((items) => [...items, { id: Date.now(), spaceId: space.id, author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: 'now', text: `Welcome to #${name}. Use this space to keep the team’s decisions visible.`, link: '' }]); setNewSpaceName(''); setIsAddingSpace(false); selectTeamSpace(space.id); log(`Created #${name}`); notify(`Created #${name}.`)
  }
  const sendMessage = async () => {
    if (!draft.trim()) return
    const message = draft.trim()
    if (!await recordSimulationEvent('chat_message', { message })) return
    const spaceId = selectedSpaceId
    const spaceName = selectedSpace?.name || 'team space'
    setMessages((items) => [...items, { id: Date.now(), spaceId, author: 'You', role: 'Full-stack Engineer', initials: 'Y', tone: 'blue', time: 'now', text: message, link: '' }])
    log(`Sent a message in #${spaceName}`); setDraft(''); notify('Message sent.')
    window.setTimeout(async () => {
      if (!await recordSimulationEvent('agent_reply')) return
      const reply = spaceId === 'releases' ? 'Thanks for flagging this. I added the release note and will keep the train on schedule.' : spaceId === 'engineering' ? 'I’ve captured that in the engineering thread. Please include the relevant test or reproduction detail when you can.' : 'Good question. Please use the existing canManageBilling guard; the empty state should still explain alerts when the plan CTA is unavailable.'
      setMessages((items) => [...items, { id: Date.now() + 1, spaceId, author: 'Noah Patel', role: 'Tech Lead', initials: 'N', tone: 'mint', time: 'now', text: reply, link: '' }])
      setTeamSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, unread: spaceId === selectedSpaceId ? 0 : space.unread + 1 } : space))
      log(`Noah replied in #${spaceName}`)
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
      <button className="org-switch"><span className="org-icon">S</span><span><b>SignalDesk</b><small>Pro workspace</small></span><ChevronDown size={15} /></button>
      <nav className="primary-nav">
        {nav.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.badge && <i>{item.badge}</i>}</button>)}
      </nav>
      <div className="sidebar-label">Team spaces</div>
      <div className="team-spaces-list">{teamSpaces.map((space) => <button key={space.id} className={`team-space ${selectedSpaceId === space.id ? 'active-space' : ''}`} onClick={() => selectTeamSpace(space.id)}><span>#</span> {space.name} {space.unread > 0 && <b>{space.unread}</b>}</button>)}</div>
      {isAddingSpace ? <div className="new-space-form"><input autoFocus value={newSpaceName} onChange={(event) => setNewSpaceName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTeamSpace()} placeholder="space-name"/><button onClick={addTeamSpace}><Check size={13} /></button><button onClick={() => { setIsAddingSpace(false); setNewSpaceName('') }}><X size={13} /></button></div> : <button className="new-space" onClick={() => setIsAddingSpace(true)}><Plus size={15} /> Add a space</button>}
      <div className="sidebar-bottom">
        <div className="team-row"><Avatar id="maya" tone="violet" small /><span>Maya Chen</span><span className="online" /></div>
        <div className="team-row"><Avatar id="noah" tone="mint" small /><span>Noah Patel</span><span className="online" /></div>
        <div className="team-row"><Avatar id="adele" tone="orange" small /><span>Adele Okafor</span></div>
        <div className="your-profile"><Avatar id="you" tone="blue" /><span><b>Alex Morgan</b><small>Full-stack engineer</small></span><MoreHorizontal size={17} /></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="crumbs"><span>SignalDesk</span><ArrowRight size={13} /><b>{view === 'home' ? 'Today' : view === 'team-space' ? `# ${selectedSpace?.name}` : nav.find((item) => item.id === view)?.label}</b></div>
        <div className="top-actions"><button className="icon-button"><Search size={18} /></button><button className="icon-button notification"><Bell size={18} /><i /></button><button className="help-button">?</button></div>
      </header>
      {view === 'home' && <HomeView standupDone={standupDone} showCeremony={showCeremony} setShowCeremony={setShowCeremony} completeStandup={completeStandup} messages={activeMessages} selectedTeamSpace={selectedSpace} draft={draft} setDraft={setDraft} sendMessage={sendMessage} activity={activity} setView={setView} testsPassed={testsPassed} committed={committed} prOpen={prOpen} reviewAddressed={reviewAddressed} progress={progress} />}
      {view === 'team-space' && <TeamSpaceView space={selectedSpace} messages={activeMessages} draft={draft} setDraft={setDraft} sendMessage={sendMessage} />}
      {view === 'issues' && <IssuesView setView={setView} />}
      {view === 'workspace' && <FunctionalWorkspaceView code={workspaceCode} setCode={setWorkspaceCode} testsPassed={testsPassed} committed={committed} runTests={runTests} commit={commit} openPr={openPr} />}
      {view === 'pulls' && <FunctionalPullRequestsView prOpen={prOpen} reviewAddressed={reviewAddressed} reviewReplied={reviewReplied} approved={approved} merged={merged} addressReview={addressReview} replyToReview={replyToReview} mergePullRequest={mergePullRequest} />}
      {view === 'feedback' && <FunctionalFeedbackView standupDone={standupDone} testsPassed={testsPassed} committed={committed} prOpen={prOpen} reviewAddressed={reviewAddressed} reviewReplied={reviewReplied} approved={approved} merged={merged} activity={activity} />}
    </main>
    {toast && <div className={`toast ${toast.tone || ''}`}><Check size={17} />{toast.message}<button onClick={() => setToast(null)}><X size={15} /></button></div>}
  </div>
}

function HomeView(props: { standupDone: boolean; showCeremony: boolean; setShowCeremony: (v: boolean) => void; completeStandup: () => void; messages: TeamMessage[]; selectedTeamSpace: TeamSpace; draft: string; setDraft: (v: string) => void; sendMessage: () => void; activity: string[]; setView: (v: View) => void; testsPassed: boolean; committed: boolean; prOpen: boolean; reviewAddressed: boolean; progress: number }) {
  const { standupDone, showCeremony, setShowCeremony, completeStandup, messages, selectedTeamSpace, draft, setDraft, sendMessage, activity, setView, testsPassed, committed, prOpen, reviewAddressed, progress } = props
  return <div className="page home-page">
    <section className="welcome"><div><p className="eyebrow">WEDNESDAY, SEPTEMBER 18 · SPRINT 2 OF 3</p><h1>Good morning, Alex <span>✦</span></h1><p>Here’s what needs your attention in SignalDesk today.</p></div><button className="time-button"><Clock3 size={16} /> Simulated time <b>09:42</b><ChevronDown size={14} /></button></section>
    <section className="priority-grid">
      <div className="ceremony-card"><div className="card-icon lavender"><UsersRound size={19} /></div><div><span className="pill lavender-pill">CEREMONY</span><h3>Async stand-up is due</h3><p>Share your plan and flag any blockers with the team.</p></div><button className={standupDone ? 'complete-button done' : 'complete-button'} onClick={() => setShowCeremony(!showCeremony)}>{standupDone ? <><Check size={16} /> Posted</> : <>Post update <ArrowRight size={15} /></>}</button>
        {showCeremony && !standupDone && <div className="standup-popover"><b>Today’s stand-up</b><p>What did you finish? What will you work on? Any blockers?</p><button onClick={completeStandup}>Post my update</button></div>}
      </div>
      <div className="priority-card"><div className="card-icon coral"><Bell size={19} /></div><div><span className="pill coral-pill">HIGH PRIORITY</span><h3>Usage alerts empty state</h3><p>PROJ-184 · Due tomorrow</p></div><button className="soft-icon" onClick={() => setView('issues')}><ArrowRight size={18} /></button></div>
      <div className="priority-card"><div className="card-icon sky"><MessageSquare size={19} /></div><div><span className="pill sky-pill">WAITING ON YOU</span><h3>Reply to Noah’s review</h3><p>PR #479 · 1 comment</p></div><button className="soft-icon" onClick={() => setView('pulls')}><ArrowRight size={18} /></button></div>
    </section>
    <div className="content-grid">
      <section className="card task-card"><div className="section-head"><div><span className="eyebrow">YOUR FOCUS</span><h2>Current task</h2></div><button className="ghost-button" onClick={() => setView('issues')}>View issue <ArrowRight size={14} /></button></div>
        <div className="issue-top"><span className="status-dot" /><span className="issue-id">PROJ-184</span><span className="pill coral-pill">HIGH</span><span className="sprint-chip">Sprint 2</span></div>
        <h3>Build the usage alerts empty state</h3><p className="task-description">Give new workspaces a clear, useful first experience when there are no active usage alerts.</p>
        <div className="task-details"><div><small>ASSIGNED BY</small><span><Avatar id="maya" tone="violet" small /> Maya Chen</span></div><div><small>DEPENDENCY</small><span className="dependency"><Lock size={13} /> API contract review</span></div><div><small>ESTIMATE</small><span>3 points</span></div></div>
        <div className="next-action"><Sparkles size={17} /><div><b>Next best action</b><span>Clarify the API edge case Noah mentioned before you implement.</span></div><button onClick={() => document.querySelector<HTMLInputElement>('.message-input')?.focus()}>Ask Noah</button></div>
      </section>
      <section className="card progress-card"><div className="section-head"><div><span className="eyebrow">SIMULATION PROGRESS</span><h2>Sprint readiness</h2></div><span className="progress-score">{progress}/5</span></div>
        <div className="progress-track"><i style={{ width: `${progress * 20}%` }} /></div>
        {[
          [standupDone, 'Post stand-up'], [testsPassed, 'Pass branch checks'], [committed, 'Commit your change'], [prOpen, 'Open a pull request'], [reviewAddressed, 'Address review'],
        ].map(([done, label]) => <div className="check-row" key={String(label)}><span className={done ? 'checked' : ''}>{done ? <Check size={13} /> : ''}</span>{label}</div>)}
      </section>
    </div>
    <div className="content-grid lower-grid">
      <section className="card conversation-card"><div className="section-head"><div><span className="eyebrow">TEAM CONVERSATION</span><h2><span className="hash">#</span> {selectedTeamSpace.name} {selectedTeamSpace.unread > 0 && <em>{selectedTeamSpace.unread} unread</em>}</h2></div><button className="ghost-button">Open channel <ArrowRight size={14} /></button></div>
        <div className="messages">{messages.map((message) => <div className="message" key={message.id}><Avatar id={message.author === 'You' ? 'you' : message.author.startsWith('Maya') ? 'maya' : message.author.startsWith('Noah') ? 'noah' : 'adele'} tone={message.tone} /><div><div className="message-meta"><b>{message.author}</b><span>{message.role}</span><time>{message.time}</time></div><p>{message.text} {message.link && <a>{message.link}</a>}</p></div></div>)}</div>
        <div className="message-composer"><button><Paperclip size={17} /></button><input className="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder={`Message #${selectedTeamSpace.name}`}/><button className="send-button" onClick={sendMessage}><Send size={16} /></button></div>
      </section>
      <section className="card activity-card"><div className="section-head"><div><span className="eyebrow">LIVE ORG ACTIVITY</span><h2>While you were away</h2></div><button className="ghost-button">View all</button></div>
        <div className="activity-item"><span className="activity-icon mint"><GitBranch size={15} /></span><p><b>Devon</b> merged <a>PR #477</a><small>12 min ago</small></p></div><div className="activity-item"><span className="activity-icon orange"><CircleDot size={15} /></span><p><b>Maya</b> reprioritized <a>PROJ-191</a><small>24 min ago</small></p></div><div className="activity-item"><span className="activity-icon lavender"><Bot size={15} /></span><p><b>QA bot</b> flagged a regression risk<a>Release note</a><small>31 min ago</small></p></div>
        {activity.map((item) => <div className="activity-item learner-activity" key={item}><span className="activity-icon blue"><Check size={15} /></span><p><b>You</b> {item}<small>just now</small></p></div>)}
      </section>
    </div>
  </div>
}

function TeamSpaceView({ space, messages, draft, setDraft, sendMessage }: { space: TeamSpace; messages: TeamMessage[]; draft: string; setDraft: (value: string) => void; sendMessage: () => void }) {
  return <div className="page team-space-page">
    <section className="channel-hero"><div><p className="eyebrow">TEAM SPACE</p><h1><span>#</span> {space.name}</h1><p>Decisions and updates shared with the SignalDesk team.</p></div><div className="channel-members"><div className="avatar-stack"><Avatar id="maya" tone="violet" small /><Avatar id="noah" tone="mint" small /><Avatar id="adele" tone="orange" small /></div><span>6 members</span></div></section>
    <section className="channel-layout"><article className="channel-thread"><div className="channel-notice"><MessageSquare size={16} /><span>This is the beginning of <b>#{space.name}</b>. Keep updates discoverable for the whole team.</span></div><div className="channel-messages">{messages.map((message) => <div className="message channel-message" key={message.id}><Avatar id={message.author === 'You' ? 'you' : message.author.startsWith('Maya') ? 'maya' : message.author.startsWith('Noah') ? 'noah' : message.author.startsWith('Adele') ? 'adele' : 'devon'} tone={message.tone} /><div><div className="message-meta"><b>{message.author}</b><span>{message.role}</span><time>{message.time}</time></div><p>{message.text} {message.link && <a>{message.link}</a>}</p></div></div>)}</div><div className="channel-composer"><button><Paperclip size={17} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder={`Message #${space.name}`}/><button className="send-button" onClick={sendMessage}><Send size={16} /></button></div></article>
      <aside className="channel-details"><span className="eyebrow">ABOUT THIS SPACE</span><h3>Team context</h3><p>{space.name === 'releases' ? 'Coordinate launch risks, release status, and rollout decisions.' : space.name === 'engineering' ? 'Discuss implementation details, system health, and technical decisions.' : 'Coordinate the product-usage initiative, handoffs, and customer-impact decisions.'}</p><hr/><span className="eyebrow">MEMBERS</span><div className="channel-member"><Avatar id="maya" tone="violet" small /> Maya Chen <span>PM</span></div><div className="channel-member"><Avatar id="noah" tone="mint" small /> Noah Patel <span>Tech lead</span></div><div className="channel-member"><Avatar id="you" tone="blue" small /> Alex Morgan <span>You</span></div></aside></section>
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
