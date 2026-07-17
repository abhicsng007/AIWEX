'use client'

import { useState } from 'react'
import { Check, GitBranch, Lock, MessageSquare, Send, ShieldCheck } from 'lucide-react'

type Props = {
  prOpen: boolean
  reviewAddressed: boolean
  reviewReplied: boolean
  approved: boolean
  merged: boolean
  addressReview: () => void
  replyToReview: (response: string) => void
  mergePullRequest: (rationale: string) => void
}

export default function FunctionalPullRequestsView({ prOpen, reviewAddressed, reviewReplied, approved, merged, addressReview, replyToReview, mergePullRequest }: Props) {
  const [response, setResponse] = useState('')
  const [rationale, setRationale] = useState('')
  if (!prOpen) return <div className="page pulls-page"><section className="page-title"><div><p className="eyebrow">CODE REVIEW</p><h1>Pull requests</h1><p>Commit passing work, then open a pull request to begin the review cycle.</p></div></section><article className="empty-pr"><GitBranch size={28} /><h2>No pull request yet</h2><p>The merge gate unlocks only after your branch checks pass and your work is committed.</p></article></div>

  const readyToMerge = approved && rationale.trim().length >= 20 && !merged
  return <div className="page pulls-page">
    <section className="page-title"><div><p className="eyebrow">CODE REVIEW</p><h1>Pull request #482</h1><p>Collaboration is part of the work. Resolve feedback and document the decision before merging.</p></div><span className={`pr-state ${merged ? 'merged' : 'open'}`}>{merged ? 'MERGED' : 'OPEN'}</span></section>
    <article className="functional-pr-card">
      <header><div><span className="open-dot" /> <b>feat/usage-alerts-empty-state → main</b><h2>Build the usage alerts empty state</h2><p>1 commit · 12 checks · requested reviewers: Noah Patel, Devon Reeves</p></div><div className="checks-mini"><ShieldCheck size={16} /> Checks passing</div></header>
      <div className="functional-pr-grid"><main>
        <section className="review-card"><div className="review-author"><span className="review-avatar">N</span><div><b>Noah Patel <em>{approved ? 'approved' : 'requested changes'}</em></b><small>Tech lead · just now</small></div></div><p>Nice start. We should avoid linking users directly to billing settings if their role can’t manage plans. Please use the existing <code>canManageBilling</code> guard and tell me how you validated the behavior.</p><div className="review-actions"><button onClick={addressReview} className={reviewAddressed ? 'resolved' : ''}>{reviewAddressed ? <><Check size={14} /> Change addressed</> : 'Mark as addressed'}</button></div></section>
        <section className="reply-card"><label htmlFor="review-response">Your review response</label><textarea id="review-response" value={response} disabled={!reviewAddressed || reviewReplied} onChange={(event) => setResponse(event.target.value)} placeholder="Explain the change and how you validated it…"/><button className="primary-button" disabled={!reviewAddressed || reviewReplied} onClick={() => replyToReview(response)}><Send size={15} /> {reviewReplied ? 'Response sent' : 'Send response'}</button>{reviewReplied && <p className="helper-success"><Check size={14} /> Noah has been asked to approve the update.</p>}</section>
      </main>
      <aside className="merge-gate-card"><span className="eyebrow">MERGE GATE</span><h3>{merged ? 'Merged successfully' : approved ? 'Ready for rationale' : 'Review in progress'}</h3><div className="gate-row"><Check size={15} className="ready" /> Checks passing</div><div className="gate-row"><Check size={15} className={reviewReplied ? 'ready' : ''} /> Review response</div><div className="gate-row"><Check size={15} className={approved ? 'ready' : ''} /> Required approval</div><div className="gate-row"><Check size={15} className={rationale.trim().length >= 20 ? 'ready' : ''} /> Merge rationale</div><label htmlFor="merge-rationale">Why is this ready to merge?</label><textarea id="merge-rationale" disabled={!approved || merged} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Summarize the decision, checks, and risk…"/><button className={readyToMerge ? 'merge-button ready-to-merge' : 'merge-button'} disabled={!readyToMerge} onClick={() => mergePullRequest(rationale)}>{merged ? <><Check size={15} /> Merged into main</> : <><Lock size={15} /> Merge pull request</>}</button></aside>
    </div></article>
  </div>
}
