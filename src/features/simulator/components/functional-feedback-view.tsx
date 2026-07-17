import { Check, Clock3, Lock, MessageSquare, Sparkles } from 'lucide-react'

type Props = {
  standupDone: boolean
  testsPassed: boolean
  committed: boolean
  prOpen: boolean
  reviewAddressed: boolean
  reviewReplied: boolean
  approved: boolean
  merged: boolean
  activity: string[]
}

function Score({ label, score, accent }: { label: string; score: number; accent: string }) {
  return <div className="score-block"><div className="score-ring" style={{ '--score': `${score * 3.6}deg`, '--accent': accent } as React.CSSProperties}><strong>{score}</strong></div><span>{label}</span></div>
}

export default function FunctionalFeedbackView({ standupDone, testsPassed, committed, prOpen, reviewAddressed, reviewReplied, approved, merged, activity }: Props) {
  const technical = testsPassed ? 84 : 56
  const collaboration = 52 + (reviewAddressed ? 15 : 0) + (reviewReplied ? 16 : 0) + (approved ? 8 : 0)
  const ownership = 58 + (standupDone ? 12 : 0) + (committed ? 10 : 0) + (merged ? 10 : 0)
  const process = 46 + (standupDone ? 12 : 0) + (prOpen ? 13 : 0) + (reviewAddressed ? 13 : 0) + (merged ? 12 : 0)
  const readiness = Math.round((technical + collaboration + ownership + process) / 4)
  const nextStep = !standupDone ? 'Post today’s async stand-up.' : !testsPassed ? 'Add the billing-role guard and rerun CI.' : !prOpen ? 'Open a pull request to invite team review.' : !reviewReplied ? 'Explain how you handled Noah’s feedback.' : !merged ? 'Record the merge rationale after approval.' : 'Pick up the next sprint task and share your plan.'
  return <div className="page feedback-page">
    <section className="page-title"><div><p className="eyebrow">PRIVATE COACHING</p><h1>How you’re working</h1><p>Scores are derived from recorded simulation events and are visible only to you.</p></div><span className="private-badge"><Lock size={14} /> Private</span></section>
    <div className="coaching-hero"><div><span className="eyebrow">CURRENT SPRINT SIGNAL</span><h2>{merged ? 'You closed the loop.' : 'Your evidence is taking shape.'}</h2><p>{merged ? 'You moved a scoped change through planning, CI, review, and merge with a documented decision trail.' : 'Shiftline does not score code alone. Your next score increase comes from completing the collaboration step in front of you.'}</p><div className="next-coaching-step"><Sparkles size={16} /><span><b>Next best action:</b> {nextStep}</span></div></div><Score score={readiness} label="Work readiness" accent="#7c70f2" /></div>
    <div className="score-grid"><Score score={technical} label="Technical execution" accent="#3eae90" /><Score score={collaboration} label="Collaboration" accent="#7c70f2" /><Score score={ownership} label="Ownership & reliability" accent="#ee9d5c" /><Score score={process} label="Process fit" accent="#5899e7" /></div>
    <div className="feedback-columns"><section className="card evidence-card"><div className="section-head"><div><span className="eyebrow">EVENT EVIDENCE</span><h2>What the simulator observed</h2></div></div><div className={`evidence ${standupDone ? 'positive' : 'neutral'}`}><span>{standupDone ? <Check size={16} /> : <Clock3 size={16} />}</span><div><b>{standupDone ? 'You communicated your plan' : 'Stand-up is still outstanding'}</b><p>{standupDone ? 'Your async stand-up created a visible commitment for the team.' : 'Post an async update before the next team handoff.'}</p></div></div><div className={`evidence ${testsPassed ? 'positive' : 'action'}`}><span>{testsPassed ? <Check size={16} /> : <MessageSquare size={16} />}</span><div><b>{testsPassed ? 'You validated a legacy constraint' : 'Technical validation needed'}</b><p>{testsPassed ? 'Your branch passed the billing-role guard contract check.' : 'Use the tech-lead context to add canManageBilling, then run CI.'}</p></div></div><div className={`evidence ${reviewReplied ? 'positive' : 'neutral'}`}><span>{reviewReplied ? <Check size={16} /> : <MessageSquare size={16} />}</span><div><b>{reviewReplied ? 'You responded to feedback' : 'Review response pending'}</b><p>{reviewReplied ? 'You explained the resolution before the reviewer approved the change.' : 'Mark the change addressed and write the reasoning behind it.'}</p></div></div></section><section className="card path-card"><span className="eyebrow">ACTIVITY TRAIL</span><h2>{activity.length ? 'Your latest signals' : 'No activity yet'}</h2>{activity.length ? <div className="coaching-activity">{activity.slice(0, 5).map((item) => <div key={item}><Check size={14} /> {item}</div>)}</div> : <p>Complete an action in the organization to create a private evidence trail.</p>}<p className="feedback-footnote">Scores use only actions completed in this simulation, never hidden model judgments.</p></section></div>
  </div>
}
