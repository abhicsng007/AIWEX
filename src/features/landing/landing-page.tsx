'use client'

import Link from 'next/link'
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Code2, GitPullRequest, Layers3, Play, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

const proof = [
  { icon: UsersRound, title: 'An AI team that feels present', text: 'Work with a manager, PM, designer, peer engineer, and tech lead who remember context and respond to your decisions.' },
  { icon: GitPullRequest, title: 'Evidence, not resume fiction', text: 'Create branches, respond to review, explain trade-offs, and collect private, auditable coaching evidence.' },
  { icon: CalendarDays, title: 'A workday with stakes', text: 'Qualify through onboarding, then follow a real calendar of focus blocks, reviews, deadlines, and recovery moments.' },
]

function WorkPreview() {
  return (
    <aside className="hero-work-preview" aria-label="Example of a live AIWEX workday">
      <div className="preview-topbar"><span className="brand-mark preview-logo"><Layers3 size={14} aria-hidden="true" /></span><b>SignalDesk <span>/ Sprint 02</span></b><span className="preview-live"><i /> Live workspace</span></div>
      <div className="preview-body">
        <div className="preview-rail"><span>WORKSPACE</span><b>Today</b><b>Issues <i>3</i></b><b>Pull requests</b><b>Team chat</b><small>YOUR TEAM</small><div className="preview-avatars"><i>MK</i><i>JL</i><i>+2</i></div></div>
        <div className="preview-content">
          <div className="preview-heading"><div><small>THURSDAY, 10:24 AM</small><span>Good morning, Alex</span></div><em><Activity size={12} /> 8 active</em></div>
          <div className="preview-focus"><Code2 size={18} /><span><small>YOUR FOCUS</small><b>Finish RBAC audit logging</b><em><i /> Branch: feature/audit-events</em></span><strong>In progress</strong></div>
          <div className="preview-section-title"><span>TEAM ACTIVITY</span><button type="button">View all</button></div>
          <div className="preview-row"><div><span className="preview-avatar purple">M</span><span><b>Maya · Tech lead</b><small>Left feedback on your pull request</small></span></div><time>2m</time></div>
          <div className="preview-row"><div><span className="preview-avatar green"><GitPullRequest size={13} /></span><span><b>PR #184 is ready to review</b><small>2 checks passing · 1 comment</small></span></div><time>8m</time></div>
        </div>
      </div>
      <div className="preview-progress"><span>Daily momentum</span><div><i /><i /><i /><i /><i /></div><b>72%</b></div>
    </aside>
  )
}

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-nav"><Link href="/" className="landing-brand"><span className="brand-mark landing-brand-mark"><Layers3 size={18} aria-hidden="true" /></span> AIWEX</Link><nav><a href="#experience">Experience</a><a href="#workflow">How it works</a><a href="#results">Outcomes</a><Link className="landing-login" href="/sign-in">Sign in <ArrowRight size={13} /></Link></nav></header>
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow"><Sparkles size={13} /> A NEW KIND OF ENGINEERING PRACTICE</p>
          <h1>Build the career<br />you can <em>prove.</em></h1>
          <p>AIWEX puts you inside a living engineering team—complete with product context, code reviews, deadlines, and the decisions that shape great work.</p>
          <div className="landing-actions"><Link className="landing-primary" href="/sign-in">Start building evidence <ArrowRight size={17} /></Link><Link className="landing-secondary" href="/demo"><Play size={13} fill="currentColor" /> Try the demo</Link><a className="landing-secondary" href="#experience">See how it works</a></div>
          <div className="landing-trust"><span><CheckCircle2 size={14} /> Built around real work</span><span><CheckCircle2 size={14} /> Private coaching record</span></div>
        </div>
        <WorkPreview />
      </section>
      <section className="landing-marquee"><span>BUILD WITH CONTEXT</span><i /> <span>COLLABORATE WITH INTENT</span><i /> <span>SHIP WITH CONFIDENCE</span><i /> <span>LEARN IN THE FLOW</span></section>
      <section id="experience" className="landing-proof"><div className="landing-section-copy"><p className="landing-eyebrow">MORE THAN A CODE EDITOR</p><h2>The human side of engineering, <em>made tangible.</em></h2><p>Practice the work between the tickets—the conversations, trade-offs, and follow-through that turn capable developers into trusted teammates.</p></div><div className="proof-grid">{proof.map((item) => <article key={item.title}><span className="proof-icon"><item.icon size={20} /></span><h3>{item.title}</h3><p>{item.text}</p><a href="#workflow">Learn more <ArrowRight size={13} /></a></article>)}</div></section>
      <section id="workflow" className="landing-workflow"><div><p className="landing-eyebrow">YOUR FIRST WEEK</p><h2>Move from new arrival to <em>trusted teammate.</em></h2><p>Progress through a purposeful sequence designed to make the unfamiliar feel navigable, then make your growth visible.</p><Link href="/sign-in" className="landing-text-link">Create your AIWEX account <ArrowRight size={16} /></Link></div><ol><li><b>01</b><span><strong>Learn the landscape</strong><small>Absorb the project, product, rituals, and the way your team makes decisions.</small></span></li><li><b>02</b><span><strong>Earn your footing</strong><small>Complete a readiness task that tests judgement, not just technical recall.</small></span></li><li><b>03</b><span><strong>Deliver in the flow</strong><small>Navigate live work, feedback, and shifting priorities with your AI team.</small></span></li></ol></section>
      <section id="results" className="landing-results"><div><ShieldCheck size={22} /><span><b>Evidence you own</b><small>Your decisions, delivery record, and coaching notes stay connected to your work.</small></span></div><div><strong>1 place</strong><span>to practice the whole job—not just the code.</span></div><Link href="/sign-in">Begin your workday <ArrowRight size={16} /></Link></section>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} AIWEX</span><span>Designed for engineers building careers with substance.</span><Link href="/sign-in">Get started <ArrowRight size={14} /></Link></footer>
    </main>
  )
}
