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
  reviewReplied?: boolean
  approved?: boolean
  merged?: boolean
  connectionState: ConnectionState
  lastSyncedAt: string | null
  setView: (view: 'issues' | 'workspace' | 'pulls' | 'team-space' | 'feedback' | 'home') => void
}

type WorkNode = {
  id: string
  label: string
  role: string
  status: string
  detail: string
  state: 'active' | 'waiting' | 'ready' | 'done'
  target: 'issues' | 'workspace' | 'pulls' | 'team-space' | 'feedback' | 'home'
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

export default function OrgActivityMap({
  issues,
  messages,
  liveEvents,
  simulationMinutes,
  standupDone,
  testsPassed,
  committed,
  prOpen,
  reviewAddressed,
  reviewReplied = false,
  approved = false,
  merged = false,
  connectionState,
  lastSyncedAt,
  setView,
}: Props) {
  const [selectedId, setSelectedId] = useState('alex')
  const progression = useMemo(() => deriveScenarioProgression(liveEvents), [liveEvents])
  const ledgerWorkflow = useMemo(() => deriveWorkflowState(liveEvents), [liveEvents])
  const workflow = {
    standupPosted: standupDone || ledgerWorkflow.standupPosted,
    checksPassed: testsPassed || ledgerWorkflow.checksPassed,
    committed: committed || ledgerWorkflow.committed,
    pullRequestOpened: prOpen || ledgerWorkflow.pullRequestOpened,
    reviewAddressed: reviewAddressed || ledgerWorkflow.reviewAddressed,
    reviewReplied: reviewReplied || ledgerWorkflow.reviewReplied,
    approvalGranted: approved || ledgerWorkflow.approvalGranted,
    merged: merged || ledgerWorkflow.merged,
  }
  const completedTaskCount = liveEvents.filter((event) => event.type === 'task_completed').length
  const projectComplete = liveEvents.some((event) => event.type === 'project_report_created')
    || (progression.currentLevel === 'advanced' && progression.pendingTaskIds.length === 0 && completedTaskCount >= 6)

  const currentIssue = issues.find((issue) => issue.id === progression.activeTaskId)
    || issues.find((issue) => issue.assignee === 'alex' && issue.status !== 'done')
    || issues.find((issue) => issue.assignee === 'alex')
  const devonIssue = issues.find((issue) => issue.assignee === 'devon' && issue.status !== 'done')
  const mayaEvent = latestEventFor(liveEvents, 'maya')
  const noahEvent = latestEventFor(liveEvents, 'noah')
  const adeleEvent = latestEventFor(liveEvents, 'adele')
  const devonEvent = latestEventFor(liveEvents, 'devon')
  const noahMentioned = agentWasMentioned(messages, 'noah')
  const adeleMentioned = agentWasMentioned(messages, 'adele')
  const devonMentioned = agentWasMentioned(messages, 'devon')

  const alexNode = useMemo(() => {
    if (projectComplete) {
      return {
        status: 'Delivery path complete',
        detail: `${completedTaskCount} learner task${completedTaskCount === 1 ? '' : 's'} cleared the merge gate. Open Feedback for the evidence reports.`,
        state: 'done' as const,
        target: 'feedback' as const,
      }
    }
    if (workflow.merged) {
      return {
        status: 'Merge complete — close the task',
        detail: currentIssue
          ? `${currentIssue.id} is merged. Mark the issue complete so progression unlocks the next task.`
          : 'The latest pull request is merged. Record task completion on the board.',
        state: 'ready' as const,
        target: 'issues' as const,
      }
    }
    if (!workflow.standupPosted) {
      return {
        status: 'Post today\'s stand-up',
        detail: currentIssue
          ? `${currentIssue.id}: ${currentIssue.title}. Make plan and blockers visible before implementation.`
          : 'Choose an assigned task from the issue board to begin the next delivery cycle.',
        state: 'active' as const,
        target: 'home' as const,
      }
    }
    if (!workflow.checksPassed) {
      return {
        status: 'Implementing and validating',
        detail: currentIssue
          ? `${currentIssue.id}: ${currentIssue.title}. ${currentIssue.acceptanceCriteria.length} acceptance checks are in scope for the active ${progression.currentLevel} scenario.`
          : 'Implement the role guard and run server-verified scenario checks.',
        state: 'active' as const,
        target: 'workspace' as const,
      }
    }
    if (!workflow.committed) {
      return { status: 'Committing verified change', detail: 'Capture the tested implementation on your feature branch.', state: 'active' as const, target: 'workspace' as const }
    }
    if (!workflow.pullRequestOpened) {
      return { status: 'Opening a pull request', detail: 'Request review so the release train can inspect the change.', state: 'active' as const, target: 'pulls' as const }
    }
    if (!workflow.reviewAddressed) {
      return { status: 'Addressing review feedback', detail: 'Resolve the requested change before posting a review response.', state: 'active' as const, target: 'pulls' as const }
    }
    if (!workflow.reviewReplied) {
      return { status: 'Preparing review response', detail: 'Explain the validation so the reviewer can approve.', state: 'active' as const, target: 'pulls' as const }
    }
    if (!workflow.approvalGranted) {
      return { status: 'Waiting on approval', detail: 'Your review response is recorded. Approval unlocks the merge rationale.', state: 'waiting' as const, target: 'pulls' as const }
    }
    return { status: 'Ready to merge', detail: 'Record a merge rationale after approval to complete the gate.', state: 'active' as const, target: 'pulls' as const }
  }, [completedTaskCount, currentIssue, progression.currentLevel, projectComplete, workflow])

  const nodes = useMemo<WorkNode[]>(() => [
    {
      id: 'maya', label: 'Maya', role: 'Product manager',
      status: projectComplete
        ? 'Scope closed for this journey'
        : !workflow.standupPosted
          ? 'Waiting for your stand-up'
          : mayaEvent
            ? 'Coordinating the next handoff'
            : 'Scope and schedule aligned',
      detail: projectComplete
        ? 'Product outcomes are backed by completed delivery evidence in the ledger.'
        : !workflow.standupPosted
          ? 'Your plan and blockers need to be visible before the delivery sequence can be coordinated.'
          : 'Product scope, dependencies, and the stakeholder check-in follow the recorded delivery state.',
      state: projectComplete ? 'done' : !workflow.standupPosted ? 'waiting' : mayaEvent ? 'active' : 'ready',
      target: 'team-space', x: 9, y: 28, lastEvent: mayaEvent,
    },
    {
      id: 'noah', label: 'Noah', role: 'Tech lead',
      status: projectComplete || workflow.merged
        ? 'Review gate cleared'
        : !workflow.checksPassed
          ? 'Waiting for verified checks'
          : !workflow.pullRequestOpened
            ? 'Available for implementation context'
            : !workflow.reviewAddressed
              ? 'Review concern open'
              : !workflow.reviewReplied
                ? 'Waiting for your review response'
                : workflow.approvalGranted
                  ? 'Approved the change'
                  : 'Reviewing the updated response',
      detail: projectComplete || workflow.merged
        ? 'Approval and merge evidence are present for the latest delivery cycle.'
        : !workflow.checksPassed
          ? 'The branch needs server-verified checks before a review handoff is ready.'
          : !workflow.pullRequestOpened
            ? 'Ask for contract or edge-case guidance before opening the pull request.'
            : !workflow.reviewAddressed
              ? 'The requested change remains the active delivery handoff.'
              : 'The map reflects the review state recorded in the delivery ledger.',
      state: projectComplete || workflow.merged || workflow.approvalGranted
        ? 'done'
        : !workflow.checksPassed
          ? 'waiting'
          : workflow.pullRequestOpened && !workflow.reviewAddressed
            ? 'active'
            : 'ready',
      target: workflow.pullRequestOpened || workflow.merged ? 'pulls' : 'team-space',
      x: 36, y: 8, lastEvent: noahEvent,
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
      status: devonIssue
        ? `Working on ${devonIssue.id}`
        : devonEvent || devonMentioned
          ? 'Responding to peer context'
          : issues.some((issue) => issue.assignee === 'devon' && issue.status === 'done')
            ? 'Peer work cleared'
            : 'Available for peer review',
      detail: devonIssue
        ? `${devonIssue.title} is an active peer dependency in the issue board.`
        : devonEvent || devonMentioned
          ? 'A peer-engineering conversation is active. Use the issue board and team space to keep ownership explicit.'
          : 'No active peer dependency is currently recorded for Devon.',
      state: devonIssue || devonEvent || devonMentioned
        ? 'active'
        : issues.some((issue) => issue.assignee === 'devon' && issue.status === 'done')
          ? 'done'
          : 'ready',
      target: devonIssue ? 'issues' : 'team-space', x: 87, y: 53, lastEvent: devonEvent,
    },
    {
      id: 'alex', label: 'You', role: 'Learner',
      status: alexNode.status,
      detail: alexNode.detail,
      state: alexNode.state,
      target: alexNode.target,
      x: 39, y: 62,
    },
    {
      id: 'ci', label: 'CI', role: 'Automation',
      status: workflow.checksPassed ? 'Scenario checks passing' : 'Waiting for a verified run',
      detail: workflow.checksPassed
        ? 'A server-verified check event is present in the delivery ledger. The branch can move to the next merge-gate action.'
        : 'Run the isolated scenario checks. A passing result is recorded by the server before this node completes.',
      state: workflow.checksPassed ? 'done' : 'waiting', target: 'workspace', x: 67, y: 71,
    },
  ], [adeleEvent, adeleMentioned, alexNode, devonEvent, devonIssue, devonMentioned, issues, mayaEvent, noahEvent, projectComplete, workflow])

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edges = useMemo<MapEdge[]>(() => [
    !workflow.standupPosted || mayaEvent || projectComplete ? { from: 'maya', to: 'alex' } : null,
    noahMentioned || workflow.checksPassed || workflow.pullRequestOpened || workflow.merged ? { from: 'noah', to: 'alex' } : null,
    adeleMentioned || adeleEvent ? { from: 'adele', to: 'alex' } : null,
    devonIssue || devonMentioned || devonEvent ? { from: 'devon', to: 'alex' } : null,
    { from: 'alex', to: 'ci' },
  ].filter((edge): edge is MapEdge => Boolean(edge)), [adeleEvent, adeleMentioned, devonEvent, devonIssue, devonMentioned, mayaEvent, noahMentioned, projectComplete, workflow.checksPassed, workflow.merged, workflow.pullRequestOpened, workflow.standupPosted])
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
      <aside className="org-map-detail"><span className={`map-state ${selected.state}`}>{selected.state === 'active' ? 'IN PROGRESS' : selected.state === 'ready' ? 'AVAILABLE' : selected.state === 'done' ? 'COMPLETE' : 'WAITING'}</span><h3>{selected.label} · {selected.role}</h3><p>{selected.detail}</p><small className="org-map-last-activity">{relativeTime(selected.lastEvent?.createdAt)}</small><button onClick={() => setView(selected.target)}>{selected.target === 'workspace' ? <GitBranch size={14} /> : selected.target === 'team-space' ? <MessageSquare size={14} /> : selected.target === 'issues' ? <CircleDot size={14} /> : selected.target === 'feedback' ? <CheckCircle2 size={14} /> : <CheckCircle2 size={14} />} Open related work</button></aside>
    </div>
    <p className="org-map-caption">Lines represent recorded or currently required handoffs for the active delivery cycle. They update from the private simulation ledger, not from decorative fixed links.</p>
  </section>
}
