'use client'

import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, CircleDot, Clock3, GitBranch, MessageSquare, Radio, RefreshCw, WifiOff } from 'lucide-react'
import type { WorkIssue } from '@/features/simulator/domain/issues'
import { deriveScenarioProgression } from '@/features/simulator/domain/progression'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { deriveWorkflowState } from '@/features/simulator/domain/workflow'

type ActivityMessage = { author: string; text: string; spaceId: string }
type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

type Props = {
  issues: WorkIssue[]
  messages: ActivityMessage[]
  liveEvents: SimulationEvent[]
  simulationMinutes: number
  standupDone: boolean
  testsPassed: boolean
  committed: boolean
  prOpen: boolean
  reviewAddressed: boolean
  connectionState: ConnectionState
  lastSyncedAt: string | null
  setView: (view: 'issues' | 'workspace' | 'pulls' | 'team-space') => void
}

type WorkNode = {
  id: string
  label: string
  role: string
  status: string
  detail: string
  state: 'active' | 'waiting' | 'ready' | 'done'
  target: 'issues' | 'workspace' | 'pulls' | 'team-space'
  x: number
  y: number
  lastEvent?: SimulationEvent
}

type MapEdge = { from: string; to: string }

const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

function latestEventFor(events: SimulationEvent[], agentId: string) {
  return [...events].reverse().find((event) => event.metadata?.agentId === agentId || event.metadata?.authorId === agentId)
}

function relativeTime(timestamp: string | null | undefined) {
  if (!timestamp) return 'No recorded activity yet'
  const milliseconds = Date.now() - Date.parse(timestamp)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Activity just recorded'
  const minutes = Math.floor(milliseconds / 60_000)
  if (minutes < 1) return 'Updated just now'
  if (minutes < 60) return `Updated ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${hours}h ago`
  return `Updated ${Math.floor(hours / 24)}d ago`
}

function agentWasMentioned(messages: ActivityMessage[], agentId: string) {
  const name = agentId === 'adele' ? 'adele' : agentId === 'noah' ? 'noah' : agentId === 'devon' ? 'devon' : 'maya'
  return messages.some((message) => message.author === 'You' && new RegExp(`@${name}\\b`, 'i').test(message.text))
}

function connectionPresentation(state: ConnectionState) {
  if (state === 'live') return { label: 'Live updates', Icon: Radio }
  if (state === 'connecting') return { label: 'Connecting updates', Icon: RefreshCw }
  if (state === 'reconnecting') return { label: 'Reconnecting updates', Icon: RefreshCw }
  return { label: 'Offline - showing saved activity', Icon: WifiOff }
}

export default function OrgActivityMap({ issues, messages, liveEvents, simulationMinutes, standupDone, testsPassed, committed, prOpen, reviewAddressed, connectionState, lastSyncedAt, setView }: Props) {
  const [selectedId, setSelectedId] = useState('alex')
  const progression = useMemo(() => deriveScenarioProgression(liveEvents), [liveEvents])
  const ledgerWorkflow = useMemo(() => deriveWorkflowState(liveEvents), [liveEvents])
  const workflow = {
    standupPosted: standupDone || ledgerWorkflow.standupPosted,
    checksPassed: testsPassed || ledgerWorkflow.checksPassed,
    committed: committed || ledgerWorkflow.committed,
    pullRequestOpened: prOpen || ledgerWorkflow.pullRequestOpened,
    reviewAddressed: reviewAddressed || ledgerWorkflow.reviewAddressed,
  }
  const currentIssue = issues.find((issue) => issue.id === progression.activeTaskId) || issues.find((issue) => issue.assignee === 'alex' && issue.status !== 'done') || issues.find((issue) => issue.assignee === 'alex')
  const devonIssue = issues.find((issue) => issue.assignee === 'devon' && issue.status !== 'done')
  const mayaEvent = latestEventFor(liveEvents, 'maya')
  const noahEvent = latestEventFor(liveEvents, 'noah')
  const adeleEvent = latestEventFor(liveEvents, 'adele')
  const devonEvent = latestEventFor(liveEvents, 'devon')
  const noahMentioned = agentWasMentioned(messages, 'noah')
  const adeleMentioned = agentWasMentioned(messages, 'adele')
  const devonMentioned = agentWasMentioned(messages, 'devon')
  const nodes = useMemo<WorkNode[]>(() => [
    {
      id: 'maya', label: 'Maya', role: 'Product manager',
      status: !workflow.standupPosted ? 'Waiting for your stand-up' : mayaEvent ? 'Coordinating the next handoff' : 'Scope and schedule aligned',
      detail: !workflow.standupPosted
        ? 'Your plan and blockers need to be visible before the delivery sequence can be coordinated.'
        : 'Product scope, dependencies, and the stakeholder check-in follow the recorded delivery state.',
      state: !workflow.standupPosted ? 'waiting' : mayaEvent ? 'active' : 'ready', target: 'team-space', x: 9, y: 28, lastEvent: mayaEvent,
    },
    {
      id: 'noah', label: 'Noah', role: 'Tech lead',
      status: !workflow.checksPassed ? 'Waiting for verified checks' : !workflow.pullRequestOpened ? 'Available for implementation context' : !workflow.reviewAddressed ? 'Review concern open' : 'Reviewing the updated response',
      detail: !workflow.checksPassed
        ? 'The branch needs server-verified checks before a review handoff is ready.'
        : !workflow.pullRequestOpened
          ? 'Ask for contract or edge-case guidance before opening the pull request.'
          : !workflow.reviewAddressed
            ? 'The requested change remains the active delivery handoff.'
            : 'The map reflects the review state recorded in the delivery ledger.',
      state: !workflow.checksPassed ? 'waiting' : workflow.pullRequestOpened && !workflow.reviewAddressed ? 'active' : 'ready', target: workflow.pullRequestOpened ? 'pulls' : 'team-space', x: 36, y: 8, lastEvent: noahEvent,
    },
    {
      id: 'adele', label: 'Adele', role: 'Product designer',
      status: adeleEvent || adeleMentioned ? 'Reviewing design context' : 'Available for design review',
      detail: adeleEvent || adeleMentioned
        ? 'A recorded design conversation is active. Keep the decision and any follow-up in the team space.'
        : 'No design handoff is open. Adele can review the empty state when interaction or copy decisions need input.',
      state: adeleEvent || adeleMentioned ? 'active' : 'ready', target: 'team-space', x: 69, y: 17, lastEvent: adeleEvent,
    },
    {
      id: 'devon', label: 'Devon', role: 'Peer engineer',
      status: devonIssue ? `Working on ${devonIssue.id}` : devonEvent || devonMentioned ? 'Responding to peer context' : 'Available for peer review',
      detail: devonIssue
        ? `${devonIssue.title} is an active peer dependency in the issue board.`
        : devonEvent || devonMentioned
          ? 'A peer-engineering conversation is active. Use the issue board and team space to keep ownership explicit.'
          : 'No active peer dependency is currently recorded for Devon.',
      state: devonIssue || devonEvent || devonMentioned ? 'active' : 'ready', target: devonIssue ? 'issues' : 'team-space', x: 87, y: 53, lastEvent: devonEvent,
    },
    {
      id: 'alex', label: 'Alex', role: 'You',
      status: !workflow.standupPosted ? 'Post today\'s stand-up' : !workflow.checksPassed ? 'Implementing and validating' : !workflow.committed ? 'Committing verified change' : !workflow.pullRequestOpened ? 'Opening a pull request' : !workflow.reviewAddressed ? 'Addressing review feedback' : 'Preparing review response',
      detail: currentIssue
        ? `${currentIssue.id}: ${currentIssue.title}. ${currentIssue.acceptanceCriteria.length} acceptance checks are in scope for the active ${progression.currentLevel} scenario.`
        : 'Choose an assigned task from the issue board to begin the next delivery cycle.',
      state: 'active', target: !workflow.checksPassed || !workflow.committed ? 'workspace' : workflow.pullRequestOpened ? 'pulls' : 'issues', x: 39, y: 62,
    },
    {
      id: 'ci', label: 'CI', role: 'Automation',
      status: workflow.checksPassed ? 'Scenario checks passing' : 'Waiting for a verified run',
      detail: workflow.checksPassed
        ? 'A server-verified check event is present in the delivery ledger. The branch can move to the next merge-gate action.'
        : 'Run the isolated scenario checks. A passing result is recorded by the server before this node completes.',
      state: workflow.checksPassed ? 'done' : 'waiting', target: 'workspace', x: 67, y: 71,
    },
  ], [adeleEvent, adeleMentioned, currentIssue, devonEvent, devonIssue, devonMentioned, mayaEvent, noahEvent, progression.currentLevel, workflow.checksPassed, workflow.committed, workflow.pullRequestOpened, workflow.reviewAddressed, workflow.standupPosted])
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edges = useMemo<MapEdge[]>(() => [
    !workflow.standupPosted || mayaEvent ? { from: 'maya', to: 'alex' } : null,
    noahMentioned || workflow.checksPassed || workflow.pullRequestOpened ? { from: 'noah', to: 'alex' } : null,
    adeleMentioned || adeleEvent ? { from: 'adele', to: 'alex' } : null,
    devonIssue || devonMentioned || devonEvent ? { from: 'devon', to: 'alex' } : null,
    { from: 'alex', to: 'ci' },
  ].filter((edge): edge is MapEdge => Boolean(edge)), [adeleEvent, adeleMentioned, devonEvent, devonIssue, devonMentioned, mayaEvent, noahMentioned, workflow.checksPassed, workflow.pullRequestOpened, workflow.standupPosted])
  const selected = nodeById.get(selectedId) || nodeById.get('alex')!
  const activeCount = nodes.filter((node) => node.state === 'active').length
  const connection = connectionPresentation(connectionState)
  const ConnectionIcon = connection.Icon

  return <section className="card org-map-card">
    <div className="section-head org-map-head"><div><span className="eyebrow">COLLABORATION MAP</span><h2>Who is moving the work</h2></div><div className="org-map-meta"><span className="org-map-time"><Clock3 size={14} /> {formatTime(simulationMinutes)} · {activeCount} active</span><span className={`org-map-sync ${connectionState}`} role="status"><ConnectionIcon size={13} /> {connection.label}{lastSyncedAt && <small>{relativeTime(lastSyncedAt)}</small>}</span></div></div>
    <div className="org-map-layout">
      <div className="org-map" role="group" aria-label={`Collaboration graph: ${connection.label.toLowerCase()}`}>
        <svg className="org-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.map((edge) => {
            const from = nodeById.get(edge.from)!
            const to = nodeById.get(edge.to)!
            return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          })}
        </svg>
        {nodes.map((node) => <button key={node.id} className={`org-map-node ${node.state} ${selected.id === node.id ? 'selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setSelectedId(node.id)} aria-pressed={selected.id === node.id}><span>{node.id === 'ci' ? <Bot size={15} /> : node.label.slice(0, 1)}</span><b>{node.label}</b><small>{node.status}</small></button>)}
      </div>
      <aside className="org-map-detail"><span className={`map-state ${selected.state}`}>{selected.state === 'active' ? 'IN PROGRESS' : selected.state === 'ready' ? 'AVAILABLE' : selected.state === 'done' ? 'COMPLETE' : 'WAITING'}</span><h3>{selected.label} · {selected.role}</h3><p>{selected.detail}</p><small className="org-map-last-activity">{relativeTime(selected.lastEvent?.createdAt)}</small><button onClick={() => setView(selected.target)}>{selected.target === 'workspace' ? <GitBranch size={14} /> : selected.target === 'team-space' ? <MessageSquare size={14} /> : selected.target === 'issues' ? <CircleDot size={14} /> : <CheckCircle2 size={14} />} Open related work</button></aside>
    </div>
    <p className="org-map-caption">Lines represent recorded or currently required handoffs for the active delivery cycle. They update from the private simulation ledger, not from decorative fixed links.</p>
  </section>
}
