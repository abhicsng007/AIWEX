# AIWEX

## My vision

I built AIWEX because learning to code is only one part of becoming a software
engineer. The first real job also expects you to understand tickets, communicate
your plan, ask useful questions, work with deadlines, validate changes, respond
to review, and explain why a change is ready to ship.

Those expectations can feel invisible when you have never worked in a software
team before. AIWEX gives new developers a safe place to practise them.

AIWEX is a realistic, private workplace simulation where a learner joins a
fictional product team, works through a delivery scenario, and builds an
evidence trail of the decisions they made along the way.

## What problem I am trying to solve

Many coding platforms stop once a solution passes tests. In real teams, that is
only part of the work. A developer also needs to understand the context behind a
request, protect existing behaviour, make progress visible, invite review, act
on feedback, and close the loop responsibly.

Without workplace experience, it is difficult to practise those habits or show
them credibly. AIWEX is designed to make that process understandable before it
has real-world consequences.

## What a learner can do

A learner joins the SignalDesk product-team scenario and moves through a
complete delivery workflow:

1. Complete onboarding, policies, access preparation, training, and a readiness
   task.
2. Join the workday by posting a stand-up, reading the issue, and communicating
   with teammates.
3. Work in a guided multi-file workspace and run scenario checks against the
   intended change.
4. Record a commit, open a pull request, respond to review, and explain the
   merge decision.
5. Complete the issue and receive an evidence-based task report.
6. Continue through Basic, Intermediate, and Advanced tasks to build a final
   project history.

The simulation is intentionally connected. A review affects the merge, a check
supports a commit, and a task report is based on recorded activity rather than
a self-written claim.

## What is included

- A guided onboarding academy with policies, training, quizzes, readiness
  feedback, remediation, and manager sign-off.
- Role-based simulated teammates, team spaces, contextual chat, meetings,
  notifications, schedules, deadlines, and follow-ups.
- Issues, a work calendar, task progression, and Basic, Intermediate, and
  Advanced learning paths.
- An editable scenario workspace with source revisions, server-side checks,
  commits, pull requests, review, approval, merge rationale, and completion
  gates.
- Private feedback, chronological task reports, and a final project report that
  connect outcomes to supporting evidence.
- Light and dark themes, responsive layouts, a built-in workspace, and an
  optional isolated Theia workbench integration.
- Optional AI teammate responses through OpenRouter, with a deterministic
  fallback so the core learning flow remains usable without an API key.

## How the product works

~~~mermaid
flowchart LR
  A[Onboarding] --> B[Stand-up and team context]
  B --> C[Issue and workspace]
  C --> D[Scenario checks]
  D --> E[Commit and pull request]
  E --> F[Review and merge rationale]
  F --> G[Task report and feedback]
~~~

The browser presents the experience, but important workflow transitions are
validated on the server. AIWEX records simulation events in an append-only
ledger and derives progress from that evidence. This helps prevent a task from
being completed simply by clicking through the interface.

## Technology

- Next.js, React, and TypeScript
- Server route handlers for validated workflow actions
- Supabase Auth, Postgres, Storage, and Row Level Security when configured
- OpenRouter for optional live teammate responses
- A deterministic scenario provider for reliable local use and demos
- Optional Eclipse Theia browser workbench integration

## Run locally

Install dependencies and start the development server:

~~~bash
npm ci
npm run dev
~~~

Then open http://localhost:3000.

For a disposable local demo without signing in, open:

- http://localhost:3000/demo?onboarding=1 for the full onboarding journey
- http://localhost:3000/demo for a pre-qualified run

No API key is required for local demo mode. If you want to configure external
services, copy .env.example to .env.local only if you do not already have a
local configuration.

## Configuration

| Variable | Purpose |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase authentication URL exposed to the browser |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase publishable or anonymous key |
| SUPABASE_URL | Server-side Supabase URL |
| SUPABASE_SERVICE_ROLE_KEY | Server-only persistence and private artifact access |
| OPENROUTER_API_KEY | Optional live teammate messages |
| OPENROUTER_MODEL or OPENROUTER_MODELS | Chooses the OpenRouter model or fallback models |
| DEMO_MODE | Enables the disposable demo route in production |
| THEIA_ENABLED | Enables the optional isolated Theia workbench |

Keep server-only keys out of browser-visible environment variables. For a
production demo deployment, set DEMO_MODE=true explicitly; it is disabled by
default in production.

## Verify changes

~~~bash
npx tsc --noEmit
npm run build
~~~

I use the following acceptance path when checking the core experience:

~~~text
onboarding -> stand-up -> teammate message -> workspace revision
-> scenario checks -> commit -> pull request -> review response
-> approval -> merge rationale -> merge -> issue complete -> task report
~~~

## Security and privacy

- Simulation events and workflow transitions are handled by server routes.
- Authenticated Supabase runs can be scoped to their owner with Row Level
  Security.
- The OpenRouter key and Supabase service-role key remain server-only.
- The SignalDesk scenario uses synthetic data and must not be connected to
  production customer data.
- Feedback is learning-oriented evidence, not a hiring decision or personality
  assessment.

## Documentation

- [Learner workflow guide](docs/learner-workflow-guide.md) explains onboarding,
  stand-ups, pull requests, reviews, meetings, and feedback in plain language.
- [Agent architecture](docs/agent-architecture.md) describes roles, event
  orchestration, and provider boundaries.
- [Supabase backend](docs/supabase-backend.md) covers persistence, auth,
  Row Level Security, and artifact storage.
- [Production deployment](docs/production-deployment.md) covers deployment,
  scheduling, health checks, and launch safeguards.
- [Theia integration](docs/theia-integration.md) explains the optional isolated
  browser workbench.

## How GPT helped me

> **Built with GPT-5.6 Terra (Codex)** — AIWEX was developed from scratch through
> multiple Codex conversations with GPT as a development collaborator.

GPT helped me move from the original idea to a working Next.js product:

- **Design** — workplace simulation structure and learning experience
- **Implementation** — onboarding, role-based collaboration, workspace, and
  pull-request workflow
- **Hardening** — private runs, server-side validation, and reliable local demos
- **Debugging** — integration issues, UI problems, and build failures
- **Documentation** — project docs, learner guides, and this README

I used Codex as a partner for exploration, implementation, debugging, and
review—not as an unexamined code generator. I retained ownership of the product
vision, learning experience, acceptance criteria, credentials, configuration,
deployment, and final decisions. GPT-5.6 Terra was used during development;
optional live teammate responses are provided through the configured OpenRouter
model, with a deterministic fallback for the core simulation.

**Note:** All changes before my commit "resolved missing o auth icons" that accounts for more than 90% of work are done using GPT 5.6 terra only.

## Current direction

AIWEX currently focuses on a single, deeply connected engineering scenario. My
next direction is to add more scenarios, role-specific coaching, team
simulations, accessibility improvements, and shareable evidence portfolios that
still respect a learner's privacy.

## License

No license is currently selected. I will add one deliberately before publishing
the repository for wider reuse.
