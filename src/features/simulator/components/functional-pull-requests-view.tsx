'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, FileDiff, GitBranch, Lock, MessageSquare, Plus, Send, X } from 'lucide-react'
import { scenarioWorkspaceFiles, type WorkspaceFile } from '@/features/simulator/domain/workspace'
import type { SimulationEvent } from '@/features/simulator/domain/types'

type Status = 'draft' | 'open' | 'closed' | 'merged'
type Comment = { id: number; author: string; text: string; createdAt: string }
type PullRequest = { id: number; title: string; branch: string; status: Status; reviewers: string[]; comments: Comment[]; updatedAt: string; files: string[]; issueId?: string }
type Props = {
  organizationId?: string | null
  prOpen: boolean
  reviewAddressed: boolean
  reviewReplied: boolean
  approved: boolean
  merged: boolean
  files: WorkspaceFile[]
  liveEvents?: SimulationEvent[]
  addressReview: () => void
  replyToReview: (response: string) => void
  mergePullRequest: (rationale: string) => void
}

const seedOpen: PullRequest[] = [
  { id: 479, title: 'Polish loading state for alert rules', branch: 'fix/alert-rules-loading', status: 'open', reviewers: ['alex'], comments: [{ id: 1, author: 'Devon Reeves', text: 'Could you confirm this does not shift the layout during a slow request?', createdAt: '12 min ago' }], updatedAt: '12 min ago', files: ['alert-rules.tsx'] },
  { id: 486, title: 'Clarify usage chart tooltips', branch: 'feat/usage-tooltip-copy', status: 'draft', reviewers: ['maya'], comments: [], updatedAt: 'Yesterday', files: ['usage-chart.tsx', 'tooltip-copy.ts'] },
]

const seedCompletedShowcase: PullRequest[] = [
  { id: 479, title: 'Polish loading state for alert rules', branch: 'fix/alert-rules-loading', status: 'merged', reviewers: ['alex', 'noah'], comments: [{ id: 1, author: 'Devon Reeves', text: 'Layout holds under slow requests — thanks for confirming.', createdAt: '2 days ago' }], updatedAt: 'Merged', files: ['alert-rules.tsx'] },
  { id: 486, title: 'Clarify usage chart tooltips', branch: 'feat/usage-tooltip-copy', status: 'merged', reviewers: ['maya', 'adele'], comments: [], updatedAt: 'Merged', files: ['usage-chart.tsx', 'tooltip-copy.ts'] },
]

const labels: Record<Status, string> = { draft: 'DRAFT', open: 'OPEN', closed: 'CLOSED', merged: 'MERGED' }

function deliveryPullRequests(events: SimulationEvent[], files: WorkspaceFile[]): PullRequest[] {
  const opened = events.filter((event) => event.type === 'pull_request_opened')
  const mergedIds = new Set(
    events
      .filter((event) => event.type === 'pull_request_merged')
      .map((event) => String(event.metadata?.issueId || '')),
  )
  return opened.map((event, index) => {
    const issueId = String(event.metadata?.issueId || `task-${index + 1}`)
    const prNumber = Number(event.metadata?.prNumber) || 480 + index
    const title = String(event.metadata?.title || `${issueId}: delivery change`)
    const branch = String(event.metadata?.branch || `feature/${issueId.toLowerCase()}`)
    const isMerged = mergedIds.has(issueId)
    return {
      id: prNumber,
      title,
      branch,
      status: isMerged ? 'merged' as const : 'open' as const,
      reviewers: ['noah', 'devon'],
      comments: [],
      updatedAt: isMerged ? 'Merged' : 'Open',
      files: files.map((file) => file.path),
      issueId,
    }
  })
}

export default function FunctionalPullRequestsView(props: Props) {
  const { organizationId, prOpen, reviewAddressed, reviewReplied, approved, merged, files, liveEvents = [], addressReview, replyToReview, mergePullRequest } = props
  const history = useMemo(() => deliveryPullRequests(liveEvents, files), [liveEvents, files])
  const showcaseComplete = history.filter((pr) => pr.status === 'merged').length >= 6
  const defaultRecords = showcaseComplete ? seedCompletedShowcase : seedOpen
  const [records, setRecords] = useState<PullRequest[]>(defaultRecords)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tab, setTab] = useState<'open' | 'draft' | 'closed'>(showcaseComplete || merged ? 'closed' : 'open')
  const [comment, setComment] = useState('')
  const [response, setResponse] = useState('')
  const [rationale, setRationale] = useState('')
  const storageKey = organizationId ? `aiwex-pr-records:${organizationId}` : null

  useEffect(() => {
    if (!storageKey) {
      setRecords(defaultRecords)
      return
    }
    if (organizationId && !organizationId.startsWith('demo-')) {
      localStorage.removeItem('aiwex-pr-records')
    }
    if (showcaseComplete) {
      setRecords(seedCompletedShowcase)
      localStorage.setItem(storageKey, JSON.stringify(seedCompletedShowcase))
      setTab('closed')
      return
    }
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try { setRecords(JSON.parse(saved) as PullRequest[]) } catch { setRecords(seedOpen) }
      return
    }
    setRecords(seedOpen)
  }, [storageKey, organizationId, showcaseComplete, defaultRecords])

  useEffect(() => {
    if (!storageKey || showcaseComplete) return
    localStorage.setItem(storageKey, JSON.stringify(records))
  }, [storageKey, records, showcaseComplete])

  // Prefer ledger-derived delivery PRs when present; otherwise keep the live learner PR slot.
  const learner: PullRequest | null = history.length
    ? null
    : prOpen
      ? { id: 482, title: 'Build the usage alerts empty state', branch: 'feat/usage-alerts-empty-state', status: merged ? 'merged' : 'open', reviewers: ['noah', 'devon'], comments: [], updatedAt: 'just now', files: files.map((file) => file.path) }
      : null
  const all = useMemo(() => {
    const combined = [...history, ...records]
    const seen = new Set<number>()
    return combined.filter((pr) => {
      if (seen.has(pr.id)) return false
      seen.add(pr.id)
      return true
    }).concat(learner && !combined.some((pr) => pr.id === learner.id) ? [learner] : [])
  }, [history, records, learner])

  useEffect(() => {
    if (selectedId && all.some((pr) => pr.id === selectedId)) return
    const preferred = all.find((pr) => pr.status === (showcaseComplete || merged ? 'merged' : 'open')) || all[0]
    if (preferred) setSelectedId(preferred.id)
  }, [all, selectedId, showcaseComplete, merged])

  const visible = all.filter((pr) => tab === 'open' ? pr.status === 'open' : tab === 'draft' ? pr.status === 'draft' : pr.status === 'closed' || pr.status === 'merged')
  const selected = all.find((pr) => pr.id === selectedId) || visible[0] || null
  const update = (id: number, changes: Partial<PullRequest>) => setRecords((items) => items.map((item) => item.id === id ? { ...item, ...changes, updatedAt: 'just now' } : item))
  const create = () => { const id = Math.max(486, ...all.map((pr) => pr.id), 0) + 1; setRecords((items) => [{ id, title: 'Untitled change', branch: `draft/change-${id}`, status: 'draft', reviewers: [], comments: [], updatedAt: 'just now', files: ['new-file.tsx'] }, ...items]); setSelectedId(id); setTab('draft') }
  const addComment = () => {
    if (!selected || history.some((pr) => pr.id === selected.id) || selected.id === 482 || !comment.trim()) return
    update(selected.id, { comments: [...selected.comments, { id: Date.now(), author: 'Alex Morgan', text: comment.trim(), createdAt: 'just now' }] })
    setComment('')
  }
  if (!selected) return <div className="page pulls-page"><section className="page-title"><div><p className="eyebrow">CODE REVIEW</p><h1>Pull requests</h1></div><button className="primary-button" onClick={create}><Plus size={16}/> New pull request</button></section></div>
  const learnerSelected = selected.id === 482 && !history.length
  const historySelected = history.some((pr) => pr.id === selected.id)
  const ready = approved && rationale.trim().length >= 20 && !merged
  return <div className="page pulls-page live-pr-page">
    <section className="page-title"><div><p className="eyebrow">CODE REVIEW</p><h1>Pull requests</h1><p>Manage drafts, reviewers, discussion, file changes, and merge decisions.</p></div><button className="primary-button" onClick={create}><Plus size={16}/> New pull request</button></section>
    <div className="pr-tabs">{(['open','draft','closed'] as const).map((item) => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item === 'open' ? 'Open' : item === 'draft' ? 'Drafts' : 'Closed'} <b>{all.filter((pr) => item === 'open' ? pr.status === 'open' : item === 'draft' ? pr.status === 'draft' : pr.status === 'closed' || pr.status === 'merged').length}</b></button>)}</div>
    <div className="live-pr-layout"><aside className="pr-list">{visible.map((pr) => <button key={pr.id} className={pr.id === selected.id ? 'selected-pr' : ''} onClick={() => setSelectedId(pr.id)}><span className="open-dot"/><div><b>#{pr.id} · {labels[pr.status]}</b><strong>{pr.title}</strong><small>{pr.branch} · {pr.updatedAt}</small></div></button>)}{!visible.length && <p>No pull requests in this view.</p>}</aside>
      <section className="pr-workbench"><header className="pr-workbench-head"><div><span className={`pr-state ${selected.status}`}>{labels[selected.status]}</span>{learnerSelected || historySelected ? <h2>{selected.title}</h2> : <input value={selected.title} onChange={(event) => update(selected.id, { title: event.target.value })}/>}<p><code>{selected.branch}</code> → <code>main</code> · {selected.files.length} changed files{selected.issueId ? ` · ${selected.issueId}` : ''}</p></div>{!learnerSelected && !historySelected && <select value={selected.status} onChange={(event) => update(selected.id, { status: event.target.value as Status })}><option value="draft">Draft</option><option value="open">Open</option><option value="closed">Closed</option><option value="merged">Merged</option></select>}</header>
        <div className="reviewer-strip"><b>Reviewers</b>{['maya','noah','adele','devon','alex'].map((name) => <button key={name} className={selected.reviewers.includes(name) ? 'assigned' : ''} onClick={() => !learnerSelected && !historySelected && update(selected.id, { reviewers: selected.reviewers.includes(name) ? selected.reviewers.filter((item) => item !== name) : [...selected.reviewers, name] })}>{name}</button>)}</div>
        <div className="diff-panel"><div className="diff-head"><FileDiff size={16}/><b>Files changed</b><small>{learnerSelected || historySelected ? 'Live workspace revisions' : 'Scenario diff preview'}</small></div>{selected.files.map((file) => { const current = files.find((item) => item.path === file); const baseline = scenarioWorkspaceFiles.find((item) => item.path === file); const changed = Boolean(current && baseline && current.content !== baseline.content); return <div className="diff-file" key={file}><span>{file}</span>{(learnerSelected || historySelected) && current ? <pre><code className="minus">{changed ? `- ${baseline?.content.slice(0, 220) || ''}` : '- baseline unchanged'}</code><code className="plus">{`+ ${current.content.slice(0, 420)}`}</code></pre> : <pre><code className="minus">- action=&#123;&#123; label: 'Review your plan' &#125;&#125;</code><code className="plus">+ action=&#123;canManageBilling ? &#123; label: 'Review your plan' &#125; : undefined&#125;</code></pre>}</div>})}</div>
        {learnerSelected ? <div className="learner-review-flow"><section className="review-card"><div className="review-author"><span className="review-avatar">N</span><div><b>Noah Patel <em>{approved ? 'approved' : 'requested changes'}</em></b><small>Tech lead · just now</small></div></div><p>Use the role guard before showing the plan CTA, then explain the validation in your response.</p><button onClick={addressReview} className={reviewAddressed ? 'resolved' : ''}>{reviewAddressed ? <><Check size={14}/> Change addressed</> : 'Mark as addressed'}</button></section><section className="reply-card"><label>Your review response</label><textarea value={response} disabled={!reviewAddressed || reviewReplied} onChange={(event) => setResponse(event.target.value)} placeholder="Explain the change and validation…"/><button className="primary-button" disabled={!reviewAddressed || reviewReplied} onClick={() => replyToReview(response)}><Send size={15}/> {reviewReplied ? 'Response sent' : 'Send response'}</button></section><section className="merge-gate-card"><span className="eyebrow">MERGE GATE</span><div className="gate-row"><Check size={15} className="ready"/> Checks passing</div><div className="gate-row"><Check size={15} className={reviewReplied ? 'ready' : ''}/> Review response</div><div className="gate-row"><Check size={15} className={approved ? 'ready' : ''}/> Required approval</div><label>Merge rationale</label><textarea value={rationale} disabled={!approved || merged} onChange={(event) => setRationale(event.target.value)} placeholder="Document decision and validation…"/><button className={ready ? 'merge-button ready-to-merge' : 'merge-button'} disabled={!ready} onClick={() => mergePullRequest(rationale)}>{merged ? <><Check size={15}/> Merged into main</> : <><Lock size={15}/> Merge pull request</>}</button></section></div>
          : historySelected ? <div className="learner-review-flow"><section className="merge-gate-card"><span className="eyebrow">DELIVERY RECORD</span><div className="gate-row"><Check size={15} className="ready"/> Checks passed</div><div className="gate-row"><Check size={15} className="ready"/> Review response recorded</div><div className="gate-row"><Check size={15} className="ready"/> Required approval</div><div className="gate-row"><Check size={15} className={selected.status === 'merged' ? 'ready' : ''}/> {selected.status === 'merged' ? 'Merged into main' : 'Awaiting merge'}</div><p className="settings-copy">This pull request was recorded in the simulation ledger{selected.issueId ? ` for ${selected.issueId}` : ''}.</p></section></div>
          : <div className="comment-panel"><h3><MessageSquare size={16}/> Discussion</h3>{selected.comments.map((item) => <article key={item.id}><b>{item.author}</b><small>{item.createdAt}</small><p>{item.text}</p></article>)}<div className="comment-composer"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a general review comment…"/><button className="primary-button" onClick={addComment}><Send size={15}/> Comment</button></div></div>}</section>
    </div></div>
}
