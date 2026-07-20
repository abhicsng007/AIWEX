# Devpost Submission Draft

> Replace every bracketed placeholder before submitting. This draft is deliberately specific: judges should understand the problem, product, implementation, and OpenAI contribution without having to infer them.

## Recommended category

**Education** — AIWEX helps early-career developers practise the professional behaviours that are normally learned only after joining a software team: communicating trade-offs, using Git responsibly, responding to review, and leaving an evidence trail.

## Project name

AIWEX

## Tagline

Practise the work around the code before your first real software team does.

## Short description

AIWEX is a private, scenario-driven software-team simulator. It lets early-career developers rehearse an end-to-end engineering workflow — onboarding, stand-up, teammate communication, a guarded workspace, checks, commits, pull requests, review, merge decisions, and a recruiter-readable evidence report — in a safe environment where skipped work and weak reasoning receive follow-up.

## Inspiration

New developers are often taught how to write code but not how a team decides what to build, communicates risk, reviews changes, or evaluates whether work was genuinely completed. That gap makes the first job feel opaque and makes it hard for candidates without prior experience to show credible evidence of professional judgement.

## What it does

AIWEX turns one realistic product incident into a guided simulation:

- Onboard into a fictional product team and learn the problem context.
- Post a stand-up, communicate with simulated teammates, and prepare a scoped workspace change.
- Run scenario checks, record a commit, and open a pull request.
- Address review feedback, explain the merge rationale, and complete the issue.
- Receive follow-up when an action is skipped, rushed, or marked complete without supporting evidence.
- Build a chronological task report and a final project report that make the learner's process visible.

The flow is intentionally not a checklist that always says “good job.” Progress is gated by meaningful actions and explanations, while the activity ledger preserves the evidence behind each outcome.

## How we built it

AIWEX is a Next.js and React application with TypeScript. Browser clients call validated server routes; the server records immutable events and derives workflow state. Supabase can provide authenticated, private runs with row-level security, while the app also supports a deterministic local path for a frictionless demo.

The product has two intentionally separate AI roles:

- **Development-time:** AIWEX was built from scratch across multiple Codex sessions using GPT-5.6 Terra — for product design, implementation, UX refinement, testing plans, production-readiness reviews, and documentation.
- **Runtime:** optional teammate responses use the configured OpenRouter model (for example, Llama 3.1 8B Instruct). When no AI key is configured, a deterministic scenario provider keeps the product functional and reviewable. GPT-5.6 is not represented as the production runtime model.

## How Codex and GPT-5.6 contributed

AIWEX was built from scratch through iterative GPT-5.6 Terra/Codex
collaboration. Codex helped shape and implement the Next.js architecture,
onboarding academy, role-based team collaboration, simulated workspace,
server-verified checks, Git and PR workflow, evidence reports, private
Supabase-backed runs, optional OpenRouter teammate responses, UI polish,
testing, and submission materials. I retained ownership of product decisions,
credentials, code review, deployment, and every final acceptance decision.

The required Codex evidence is recorded in the repository's collaboration
record at docs/codex-collaboration.md. The app was built across multiple
sessions, but before submitting I will replace the placeholder Session ID there
and in the Devpost form with the Session ID from the Codex conversation
responsible for the majority of the core functionality.

## Challenges we ran into

The central challenge was preventing the experience from becoming a decorative checklist. We needed actions to feel connected: a check should affect a commit, a review should require a response, and a merge should require a rationale. The answer was an append-only activity ledger and server-side workflow rules that derive task state from evidence rather than trusting a browser-only “complete” button.

We also needed an AI-enhanced experience that could be judged reliably. The optional OpenRouter integration adds responsive teammate dialogue, but the deterministic provider means a missing API key or rate limit never turns the demo into a blank screen.

## Accomplishments that we're proud of

- Made “experience” visible as a chain of decisions and evidence, not a self-reported claim.
- Built an end-to-end team workflow that includes the unglamorous but essential parts: stand-ups, review responses, merge rationale, follow-up, and reflection.
- Kept private learner runs and the event ledger separate from browser-trusted state.
- Designed the app to be easy to judge locally or through a demo route without requiring an account or a paid API key.

## What we learned

A useful simulated workplace must preserve cause and effect. A polished UI is not enough: users need to see why an action mattered, what evidence is missing, and what a teammate would ask next. We also learned that resilient AI products need a deterministic path so that a reviewer can always assess the core product.

## What's next for AIWEX

- Multiple scenarios and role-specific coaching.
- Team simulations where learners collaborate with each other.
- Employer-facing portfolios that let candidates selectively share verified evidence.
- More nuanced review rubrics, accessibility improvements, and analytics that identify where learners need practice.

## Judge testing instructions

**Deployed URL:** [PASTE PUBLIC DEPLOYMENT URL]

**Fastest demo path:** open [DEPLOYMENT URL]/demo?onboarding=1. It starts a seeded demo without creating an account.

Before sharing a production deployment, set the server-only environment
variable DEMO_MODE=true. Demo mode is enabled by default only during local
development.

For a local review:

~~~bash
npm ci
npm run dev
~~~

Then open http://localhost:3000/demo?onboarding=1.

No local environment file, Supabase key, or OpenRouter key is required for the
demo flow. Create .env.local from .env.example only if you want to test private
persistence or live teammate responses.

## Final submission checklist

- [ ] Public repository URL with a relevant license, or private access shared with testing@devpost.com and build-week-event@openai.com.
- [ ] Live deployment is free to access through judging and the demo route works.
- [ ] Public YouTube demo is under three minutes, has audio, and shows the product plus Codex/GPT-5.6's role.
- [ ] Replace the Codex Session ID placeholder in the Devpost form and collaboration record.
- [ ] Add the final deployment, YouTube, and repository links to the Devpost form.
- [ ] Do not include secrets, copyrighted music, or third-party material without permission.
- [ ] Submit only after a final preview: Devpost submissions cannot be edited after the deadline.
