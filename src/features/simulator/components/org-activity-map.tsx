'use client'

import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, CircleDot, Clock3, GitBranch, MessageSquare } from 'lucide-react'
import type { WorkIssue } from '@/features/simulator/domain/issues'
import type { SimulationEvent } from '@/features/simulator/domain/types'

type ActivityMessage = { author: string; text: string; spaceId: string }

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
}

const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export default function OrgActivityMap({ issues, messages, liveEvents, simulationMinutes, standupDone, testsPassed, committed, prOpen, reviewAddressed, setView }: Props) {
  const [selectedId, setSelectedId] = useState('alex')
  const hasRecentQuestion = messages.some((message) => message.author === 'You' && /@noah|threshold|api/i.test(message.text))
  const currentIssue = issues.find((issue) => issue.id === 'PROJ-184') || issues.find((issue) => issue.assignee === 'alex')
  const latestAgentEvent = [...liveEvents].reverse().find((event) => event.type === 'agent_reply')
  const latestAgentId = typeof latestAgentEvent?.metadata?.agentId === 'string' ? latestAgentEvent.metadata.agentId : ''
  const nodes = useMemo<WorkNode[]>(() => [
    { id: 'maya', label: 'Maya', role: 'Product manager', status: latestAgentId === 'maya' ? 'Posting a live update' : standupDone ? 'Aligning stakeholder check-in' : 'Waiting for stand-up', detail: latestAgentId === 'maya' ? 'Maya just responded to activity in the organization feed.' : standupDone ? 'Keeping scope, dependencies, and the 3 PM stakeholder check-in aligned.' : 'Needs Alex’s plan and blockers before sequencing the team.', state: latestAgentId === 'maya' || standupDone ? 'active' : 'waiting', target: 'team-space', x: 9, y: 28 },
    { id: 'noah', label: 'Noah', role: 'Tech lead', status: latestAgentId === 'noah' ? 'Posting a live review update' : hasRecentQuestion ? 'Clarifying API edge cases' : reviewAddressed ? 'Reviewing the update' : 'Hardening billing mapper', detail: latestAgentId === 'noah' ? 'Noah just replied through the shared live simulation feed.' : hasRecentQuestion ? 'Responding to the legacy threshold question in the team space.' : reviewAddressed ? 'Checking the revised role guard before approval.' : 'Protecting the usage UI from incomplete legacy billing payloads.', state: latestAgentId === 'noah' || hasRecentQuestion || reviewAddressed ? 'active' : 'ready', target: reviewAddressed ? 'pulls' : 'team-space', x: 36, y: 8 },
    { id: 'adele', label: 'Adele', role: 'Product designer', status: 'Available for empty-state review', detail: 'Has annotated the empty state and is ready to answer interaction or copy questions.', state: 'ready', target: 'team-space', x: 69, y: 17 },
    { id: 'devon', label: 'Devon', role: 'Peer engineer', status: 'Investigating chart tooltips', detail: 'Working on PROJ-189 and available to review implementation trade-offs.', state: 'active', target: 'issues', x: 87, y: 53 },
    { id: 'alex', label: 'Alex', role: 'You', status: !standupDone ? 'Post today’s stand-up' : !testsPassed ? 'Implementing empty state' : !committed ? 'Committing verified change' : !prOpen ? 'Opening a pull request' : !reviewAddressed ? 'Addressing review feedback' : 'Preparing review response', detail: currentIssue ? `${currentIssue.id}: ${currentIssue.title}. ${currentIssue.acceptanceCriteria.length} acceptance checks are in scope.` : 'Choose a task from the issue board to begin.', state: 'active', target: !testsPassed || !committed ? 'workspace' : prOpen ? 'pulls' : 'issues', x: 39, y: 62 },
    { id: 'ci', label: 'CI', role: 'Automation', status: testsPassed ? '12 checks passing' : 'Waiting for a branch change', detail: testsPassed ? 'The current branch passed its test suite and is ready for the next merge-gate action.' : 'Will validate the role guard once the implementation is ready.', state: testsPassed ? 'done' : 'waiting', target: 'workspace', x: 67, y: 71 },
  ], [committed, currentIssue, hasRecentQuestion, latestAgentId, prOpen, reviewAddressed, standupDone, testsPassed])
  const selected = nodes.find((node) => node.id === selectedId) || nodes[4]
  const activeCount = nodes.filter((node) => node.state === 'active').length

  return <section className="card org-map-card">
    <div className="section-head"><div><span className="eyebrow">LIVE COLLABORATION MAP</span><h2>Who is moving the work</h2></div><span className="org-map-time"><Clock3 size={14} /> {formatTime(simulationMinutes)} · {activeCount} active</span></div>
    <div className="org-map-layout">
      <div className="org-map" role="group" aria-label="Current organization work graph">
        <svg className="org-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="15" y1="33" x2="39" y2="62" /><line x1="38" y1="13" x2="39" y2="62" /><line x1="69" y1="22" x2="39" y2="62" /><line x1="39" y1="62" x2="67" y2="71" /><line x1="39" y1="62" x2="87" y2="53" /><line x1="38" y1="13" x2="67" y2="71" />
        </svg>
        {nodes.map((node) => <button key={node.id} className={`org-map-node ${node.state} ${selected.id === node.id ? 'selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setSelectedId(node.id)} aria-pressed={selected.id === node.id}><span>{node.id === 'ci' ? <Bot size={15} /> : node.label.slice(0, 1)}</span><b>{node.label}</b><small>{node.status}</small></button>)}
      </div>
      <aside className="org-map-detail"><span className={`map-state ${selected.state}`}>{selected.state === 'active' ? 'IN PROGRESS' : selected.state === 'ready' ? 'AVAILABLE' : selected.state === 'done' ? 'COMPLETE' : 'WAITING'}</span><h3>{selected.label} · {selected.role}</h3><p>{selected.detail}</p><button onClick={() => setView(selected.target)}>{selected.target === 'workspace' ? <GitBranch size={14} /> : selected.target === 'team-space' ? <MessageSquare size={14} /> : selected.target === 'issues' ? <CircleDot size={14} /> : <CheckCircle2 size={14} />} Open related work</button></aside>
    </div>
    <p className="org-map-caption">Connections show active handoffs around the usage-alerts work. Select a teammate or automation node to inspect its current context.</p>
  </section>
}
