'use client'

import { ArrowRight, BookOpen, CalendarClock, Check, CircleHelp, ClipboardCheck, GitPullRequest, MessageSquareText, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

export type LearnerGuideDestination = 'onboarding' | 'home' | 'issues' | 'workspace' | 'pulls' | 'team-space' | 'calendar' | 'feedback'

type Props = {
  onNavigate: (view: LearnerGuideDestination) => void
}

type GuideStep = {
  number: string
  title: string
  description: string
  destination: LearnerGuideDestination
  label: string
  icon: typeof BookOpen
}

const journey: GuideStep[] = [
  { number: '01', title: 'Learn the rules', description: 'Complete onboarding so you understand the safety, access, and working agreements before project work opens.', destination: 'onboarding', label: 'Open onboarding', icon: ShieldCheck },
  { number: '02', title: 'Understand the request', description: 'Read the issue and turn its acceptance criteria into a simple definition of “done”.', destination: 'issues', label: 'Open issues', icon: ClipboardCheck },
  { number: '03', title: 'Make work visible', description: 'Post a small stand-up update and ask a focused question if a requirement is unclear.', destination: 'team-space', label: 'Open team space', icon: MessageSquareText },
  { number: '04', title: 'Build and verify', description: 'Make a contained change in the workspace, save it, run checks, and commit the passing version.', destination: 'workspace', label: 'Open workspace', icon: BookOpen },
  { number: '05', title: 'Invite review', description: 'Open a pull request, respond to feedback with evidence, and record why the change is safe to merge.', destination: 'pulls', label: 'Open pull requests', icon: GitPullRequest },
  { number: '06', title: 'Close the loop', description: 'Use the calendar and meetings to stay aligned, then use feedback to choose one improvement for next time.', destination: 'feedback', label: 'Open feedback', icon: Sparkles },
]

function Template({ children }: { children: string }) {
  return <pre className="learner-guide-template"><code>{children}</code></pre>
}

export default function FunctionalLearnerGuideView({ onNavigate }: Props) {
  return <div className="page learner-guide-page">
    <section className="learner-guide-hero">
      <div>
        <p className="eyebrow">YOUR ON-SCREEN REFERENCE</p>
        <h1>Your first simulated workday</h1>
        <p>You do not need workplace experience to begin. This guide translates the workflow into plain language, gives you words to use, and points you to the right place in the app.</p>
        <div className="learner-guide-hero-actions">
          <button className="primary-button" onClick={() => onNavigate('onboarding')}><ShieldCheck size={16} /> Start with onboarding</button>
          <button className="guide-secondary-button" onClick={() => onNavigate('home')}>Go to today’s work <ArrowRight size={15} /></button>
        </div>
      </div>
      <aside className="learner-guide-reassurance">
        <CircleHelp size={20} />
        <div><b>Nothing is assumed</b><p>A blocker, a question, or review feedback is normal. Make it visible early, decide the next action, and continue.</p></div>
      </aside>
    </section>

    <section className="learner-guide-map" aria-label="The software work journey">
      <div className="learner-guide-section-head"><div><span className="eyebrow">THE BIG PICTURE</span><h2>One repeatable work loop</h2></div><p>Understand → communicate → build → verify → review → learn</p></div>
      <div className="learner-guide-journey">
        {journey.map((step) => {
          const Icon = step.icon
          return <article key={step.number}>
            <span className="guide-step-number">{step.number}</span><Icon size={19} />
            <h3>{step.title}</h3><p>{step.description}</p>
            <button onClick={() => onNavigate(step.destination)}>{step.label} <ArrowRight size={13} /></button>
          </article>
        })}
      </div>
    </section>

    <section className="learner-guide-screen-map card">
      <div><span className="eyebrow">WHERE TO GO</span><h2>The rooms in this app</h2><p>They are parts of the same project, not separate tests. Return to Home whenever you need a suggested next action.</p></div>
      <div className="learner-guide-rooms">
        <span><b>Home</b> Today’s priority and the simulated clock</span>
        <span><b>Issues</b> The request and definition of done</span>
        <span><b>Workspace</b> The safe place to implement and validate</span>
        <span><b>Pull requests</b> Review, approval, rationale, and merge</span>
        <span><b>Team space</b> Questions, risks, decisions, and follow-ups</span>
        <span><b>Calendar / meetings</b> Scheduled work and shared context</span>
      </div>
    </section>

    <section className="learner-guide-details">
      <details open>
        <summary><span><ShieldCheck size={18} /> Before work: onboarding and the basic words</span><ArrowRight size={16} /></summary>
        <div className="learner-guide-detail-body">
          <p>Onboarding is how a team makes sure a new person understands security, data protection, and the way work is recorded before project access opens. Complete the profile, policies, system access, learning questions, readiness check, and manager sign-off in order.</p>
          <div className="learner-guide-definition-grid">
            <article><b>Issue / ticket</b><span>A written work request: what problem needs solving.</span></article>
            <article><b>Acceptance criteria</b><span>The observable conditions that define “done”.</span></article>
            <article><b>Blocker</b><span>Something that stops progress and should be raised early.</span></article>
            <article><b>Dependency</b><span>A person, system, or decision you need before continuing.</span></article>
          </div>
          <button className="guide-inline-link" onClick={() => onNavigate('onboarding')}>Open onboarding <ArrowRight size={14} /></button>
        </div>
      </details>

      <details>
        <summary><span><ClipboardCheck size={18} /> The task workflow: use PROJ-184 as your example</span><ArrowRight size={16} /></summary>
        <div className="learner-guide-detail-body">
          <p>Start in <b>Issues</b>, not in the editor. For PROJ-184, the change must show a helpful no-alerts state, hide the billing action from restricted users, and keep working for older workspaces with no threshold. Rewrite that in your own words before touching code.</p>
          <ol className="learner-guide-ordered-list">
            <li>Read the issue, context, and acceptance criteria.</li>
            <li>Post your plan or blocker so the team knows what is happening.</li>
            <li>Open Workspace, read the technical note, and make the smallest change that meets the criteria.</li>
            <li>Save the revision and run scenario checks.</li>
            <li>When checks pass, commit the work: a named checkpoint that a reviewer can inspect.</li>
          </ol>
          <p><b>A check is evidence.</b> It does not mean the code is magically perfect. It means the agreed verification passed at that moment. If it fails, read the message, link it to a criterion, make a focused correction, and run it again.</p>
          <button className="guide-inline-link" onClick={() => onNavigate('issues')}>Read the issue <ArrowRight size={14} /></button>
          <button className="guide-inline-link" onClick={() => onNavigate('workspace')}>Open Workspace <ArrowRight size={14} /></button>
        </div>
      </details>

      <details>
        <summary><span><MessageSquareText size={18} /> Stand-ups, questions, and risks: what to say</span><ArrowRight size={16} /></summary>
        <div className="learner-guide-detail-body learner-guide-communication">
          <div><p><b>A stand-up is not a report card.</b> It is a short update that prevents surprises. Use this format:</p><Template>{`Yesterday: I completed onboarding and reviewed PROJ-184.
Today: I will implement and validate the empty state.
Blocker: None right now; I will ask if the legacy case is unclear.`}</Template></div>
          <div><p><b>Ask precise questions.</b> Include the context, your plan, and the decision you need:</p><Template>{`@Noah For PROJ-184, I plan to hide “Review your plan” when
canManageBilling is false. Should the title still show when a legacy
workspace has no threshold field?`}</Template></div>
          <div><p><b>Raise delivery risk early.</b> Naming risk is helpful, not embarrassing:</p><Template>{`Risk: PROJ-184 review may extend past today’s review window.
Impact: The merge could move to the next release window.
Plan: I will finish validation by 15:00 and request review immediately.`}</Template></div>
          <button className="guide-inline-link" onClick={() => onNavigate('team-space')}>Open team space <ArrowRight size={14} /></button>
        </div>
      </details>

      <details>
        <summary><span><GitPullRequest size={18} /> Pull requests, reviews, and merge</span><ArrowRight size={16} /></summary>
        <div className="learner-guide-detail-body">
          <p>A <b>pull request (PR)</b> is a request for teammates to review a proposed code change before it becomes shared work. It is not an emergency and review feedback is not a personal criticism.</p>
          <div className="learner-guide-pr-flow"><span>Passing commit</span><ArrowRight size={15} /><span>Open PR</span><ArrowRight size={15} /><span>Address review</span><ArrowRight size={15} /><span>Explain evidence</span><ArrowRight size={15} /><span>Approval</span><ArrowRight size={15} /><span>Merge</span></div>
          <p>When a reviewer requests a change, read it fully, make or verify the change, mark it addressed, then explain the decision and validation. Avoid replying only “fixed”.</p>
          <Template>{`I added the canManageBilling guard so restricted users do not
receive the billing CTA. The empty state remains independent of the
legacy threshold field, and I reran the scenario checks successfully.`}</Template>
          <p>Before merging, record a rationale: a brief future-friendly note explaining why the change is safe. Only mark the task complete after the PR is merged.</p>
          <button className="guide-inline-link" onClick={() => onNavigate('pulls')}>Open pull requests <ArrowRight size={14} /></button>
        </div>
      </details>

      <details>
        <summary><span><CalendarClock size={18} /> Calendar, meetings, and learner-controlled time</span><ArrowRight size={16} /></summary>
        <div className="learner-guide-detail-body">
          <p>Simulated time on Home does not run while you are away. You choose when to advance it. <b>Next event</b> goes directly to the next planned scenario trigger; <b>+15m</b> and <b>+1h</b> move smaller blocks. The next event is shown first so you can prepare without racing.</p>
          <p>The Calendar holds focus blocks, ceremonies, review windows, and deadlines. For a ceremony, choose <b>Open room</b> to join its meeting. Use meetings for shared alignment, then record the decision, owner, and next step in the appropriate team space.</p>
          <Template>{`Decision: The billing CTA will appear only for authorised users.
Owner: Alex will complete validation and post the PR update.
Next step: Request review before the 15:00 review window.`}</Template>
          <button className="guide-inline-link" onClick={() => onNavigate('calendar')}>Open calendar <ArrowRight size={14} /></button>
        </div>
      </details>

      <details>
        <summary><span><Sparkles size={18} /> Feedback, progress, and what good looks like</span><ArrowRight size={16} /></summary>
        <div className="learner-guide-detail-body">
          <p>Feedback is private coaching based on the actions you record: workflow events, messages, review responses, mentions, and timing. It is not a hidden judgement of your personality.</p>
          <div className="learner-guide-definition-grid">
            <article><b>You are unclear</b><span>Restate your interpretation and ask one focused question.</span></article>
            <article><b>A check fails</b><span>Read it, connect it to a requirement, correct it, and rerun it.</span></article>
            <article><b>Review requests changes</b><span>Explain what changed and how you verified it.</span></article>
            <article><b>A deadline is at risk</b><span>Share the impact and recovery plan before it becomes a surprise.</span></article>
          </div>
          <p>After a merged task, choose one evidence-backed habit to keep using. A reliable engineer is not someone who never needs help; it is someone whose work and decisions are understandable to the team.</p>
          <button className="guide-inline-link" onClick={() => onNavigate('feedback')}>Open private feedback <ArrowRight size={14} /></button>
        </div>
      </details>
    </section>

    <section className="learner-guide-checklist card">
      <div><span className="eyebrow">WHEN YOU FEEL LOST</span><h2>Use this calm checklist</h2><p>You never need to guess a hidden rule. Take the next visible step.</p></div>
      <ul>
        {['Read the next-action guidance on Home.', 'Re-read the issue acceptance criteria.', 'Read the Workspace technical context.', 'Check the next required PR gate.', 'Check Calendar for an active event or recovery action.', 'Ask a focused question in Team space.'].map((item) => <li key={item}><Check size={15} />{item}</li>)}
      </ul>
      <button className="primary-button" onClick={() => onNavigate('home')}>Open Home <ArrowRight size={15} /></button>
    </section>
  </div>
}
