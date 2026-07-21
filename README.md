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

### Prerequisites

- **Node.js 20+** (LTS recommended) and npm
- Git
- Optional: a Supabase project (only if you want auth + durable persistence)
- Optional: an OpenRouter key (only if you want live AI teammate replies)

The core product and demo mode run **without** Supabase or OpenRouter. Without
them, events stay in the in-memory store for the current server process, and
teammates use the deterministic local provider.

### 1. Clone and install

~~~bash
git clone https://github.com/abhicsng007/AIWEX.git aiwex
cd aiwex
npm ci
~~~

Use `npm install` only if you are intentionally refreshing the lockfile.

### 2. Environment (optional for demos)

Copy the example env file if you want auth, persistence, or live AI:

~~~bash
# Windows (PowerShell)
Copy-Item .env.example .env.local

# macOS / Linux
cp .env.example .env.local
~~~

Minimum notes:

| Goal | What to set |
| --- | --- |
| Local demos only | Nothing required. Demo mode is on in development by default. |
| Sign-in (Google / GitHub / magic link) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Durable events + file uploads | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` + run SQL migrations in `supabase/migrations/` |
| Live AI teammates | `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODELS`) |
| Production / Vercel demos | **`DEMO_MODE=true`** (required — demos are off in production by default) |
| Vercel multi-instance demos | Also set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` so demo ledgers persist |

Never put service-role keys in `NEXT_PUBLIC_*` variables. See [Configuration](#configuration)
and `docs/supabase-backend.md` / `docs/openrouter.md` for details.

### 3. Start the app

~~~bash
npm run dev
~~~

Open http://localhost:3000.

Health check (optional):

~~~bash
curl http://localhost:3000/api/health
~~~

You should see `"status":"ok"`.

### 4. Production-style local run (optional)

~~~bash
npm run build
npm run start
~~~

Still serve on http://localhost:3000. For production demos on this build, set
`DEMO_MODE=true` in `.env.local`.

### Disposable demos (no sign-in)

AIWEX issues an isolated `aiwex_demo_run` cookie for each demo. Demo progress is
not copied into a real account when you later sign up.

| Link | What you get |
| --- | --- |
| http://localhost:3000/demo?onboarding=1 | Clean start: full onboarding academy from profile through readiness |
| http://localhost:3000/demo | Pre-qualified Day-1 access (onboarding already complete; project unlocked) |
| http://localhost:3000/demo/complete | **Full journey showcase** — finished Basic → Intermediate → Advanced run |
| http://localhost:3000/demo?complete=1 | Same showcase (redirects to `/demo/complete`) |

**Complete showcase** (`/demo/complete`, also `/demo?complete=1`):

- Opens a **preparing page** with live progress (session → onboarding →
  Basic/Intermediate/Advanced → meetings/calendar → reports).
- Builds a disposable run on the server via `POST /api/demo/showcase`.
- On success, opens `/demo/workspace` with all six learner tasks complete,
  level badges, calendar/meetings closed, and Feedback reports ready.
- On failure, returns **gracefully to the home page** with a short message
  (never dumps raw server errors over the UI).
- Takes about **30–60 seconds**; keep the tab open while it runs.
- Linked from the landing page as **Full journey showcase**.

### 5. Verify with tests (optional)

Keep `npm run dev` running in one terminal for e2e, then:

~~~bash
# Domain logic only (no server)
npm run test:unit

# HTTP e2e against localhost:3000
npm run test:e2e

# Unit + e2e
npm test

# Optional long journey script
npm run test:e2e:journey
~~~

### Common issues

| Symptom | What to try |
| --- | --- |
| Port 3000 already in use | Stop the other process, or run `npx next dev -p 3001` and open that port |
| `/demo` asks for login or lands on home with demo disabled | On **Vercel**, set `DEMO_MODE=true` (Production + Preview) and **redeploy**. Demos are off in production by default. |
| Complete showcase empty after load on Vercel | Set Supabase service-role vars so demo events persist across serverless instances |
| Complete showcase times out on Vercel Hobby | Needs longer function duration (Pro ≥60s) or use `/demo` / `/demo?onboarding=1` instead |
| Complete showcase: `node --test ... alerts-panel.test.cjs` failed | Fixed in current code: Vercel uses in-process fixture verification. Redeploy latest main. |
| Auth UI says keys are missing | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Events disappear after restart | Expected without Supabase; configure service-role env + migrations for durability |
| Workspace checks fail | Ensure you ran `npm ci` at the repo root (scenario tests live under `scenarios/`) |
| Complete showcase times out | Wait up to ~60s; first open runs real scenario validation for each task |

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

## Deployed app (Vercel)

Public deployment: **https://aiwex.vercel.app**

The production build is the same Next.js app as local, with a few important
differences from `npm run dev`.

### Required production settings

In the Vercel project → **Settings → Environment Variables** (Production, and
Preview if you want demos on preview URLs), then **redeploy**:

| Variable | Production value | Notes |
| --- | --- | --- |
| `DEMO_MODE` | `true` | **Required** for `/demo` links. Off by default in production. |
| `SUPABASE_URL` | project URL | Recommended so demo/auth ledgers survive serverless instances |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | Server-only; never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | Only if you enable real sign-in |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key | Only if you enable real sign-in |
| `OPENROUTER_API_KEY` | optional | Live AI teammates; omit to use the deterministic provider |
| `THEIA_ENABLED` | `false` | **Keep disabled** on the shared Vercel deployment |

More detail: `docs/production-deployment.md`.

### Theia IDE on Vercel

The optional Eclipse Theia workbench is **disabled** on https://aiwex.vercel.app.

- Production uses the **built-in workspace** only.
- Leave `THEIA_ENABLED=false` (or unset). Do not point a shared Vercel deploy at
  a local Theia URL.
- Theia is a separate, heavier stack for isolated local/beta experiments; see
  `docs/theia-integration.md` if you run it yourself.

### Demo links (same paths as localhost)

Disposable demos do **not** require sign-in. Use the same routes as local, with
the production host:

| Link | What you get |
| --- | --- |
| https://aiwex.vercel.app/demo?onboarding=1 | Clean start: full onboarding academy |
| https://aiwex.vercel.app/demo | Pre-qualified Day-1 project access |
| https://aiwex.vercel.app/demo/complete | Full Basic → Intermediate → Advanced showcase (with progress UI) |
| https://aiwex.vercel.app/demo?complete=1 | Same showcase (redirects to `/demo/complete`) |

Also available from the landing page:

- https://aiwex.vercel.app — **Try the demo** / **Full journey showcase**
- https://aiwex.vercel.app/sign-in — create or continue a real account

Compared to localhost:

| | Local (`localhost:3000`) | Vercel (`aiwex.vercel.app`) |
| --- | --- | --- |
| Demo mode default | On (unless `DEMO_MODE=false`) | Off until `DEMO_MODE=true` |
| Event storage without Supabase | Process memory (fine for one `next dev`) | Not reliable across instances — configure Supabase |
| Theia workbench | Optional local experiment | Disabled on this deployment |
| Complete showcase | ~30–60s | Same path; allow enough function duration (prefer ≥60s) |

If `/demo` sends you back to the home page with a demo-disabled message, set
`DEMO_MODE=true` on Vercel and redeploy.

## Tests

AIWEX uses Node’s built-in test runner (`node:test`). There are two automated
layers, plus an optional long journey script.

| Layer | Location | Needs server? | What it covers |
| --- | --- | --- | --- |
| Unit | `tests/unit` | No | Domain pure logic: workflow gates, onboarding phases, progression unlocks, assessment scores, accountability, performance evidence, difficulty queues, delivery reports |
| End-to-end | `tests/e2e` | Yes (`npm run dev`) | Real HTTP APIs: demo auth, full onboarding, workflow gates, workspace validate, basic→advanced delivery, agent turns, schedule/meetings, team welcome, feedback, load tests |
| Journey script | `scripts/e2e-workflow-simulation.mjs` | Yes | One disposable demo run from onboarding through all Basic, Intermediate, and Advanced tasks; uses OpenRouter when `OPENROUTER_API_KEY` is set |

Shared helpers live in `tests/helpers` (cookie-aware HTTP client, fixtures, and
onboarding/delivery flow builders). Each e2e test uses its own demo cookie so
runs stay isolated.

### Commands

~~~bash
# Typecheck and production build
npx tsc --noEmit
npm run build

# Unit tests only (no server)
npm run test:unit

# End-to-end HTTP tests (start the app first)
npm run dev
# in another terminal
npm run test:e2e

# Unit + e2e together
npm run test

# Scenario fixture checks for the usage-alerts workspace
npm run test:scenario

# Long scripted journey (onboarding → all levels)
npm run test:e2e:journey

# Agent/journey cases that require live OpenRouter replies
npm run test:e2e:live-ai
~~~

### Environment notes for tests

| Variable | Effect |
| --- | --- |
| `AIWEX_BASE_URL` | Override the e2e base URL (default `http://localhost:3000`) |
| `AIWEX_REQUIRE_SERVER=1` | Fail e2e instead of skipping when the app is not reachable |
| `AIWEX_LIVE_AI=1` | Assert teammate turns came from OpenRouter (not the deterministic fallback) |
| `OPENROUTER_API_KEY` | Enables live AI on the server for agent-turn e2e and the journey script |
| `DEMO_MODE` | Must not be `false` in development so `/demo` cookies work for e2e |

If the server is down, e2e tests skip with a short message unless
`AIWEX_REQUIRE_SERVER=1` is set.

### Manual acceptance path

I still use this path when checking the core UI experience by hand:

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

## 🌟 How GPT helped me


> <mark>**Built with GPT-5.6 Terra (Codex)** — AIWEX was developed from scratch through</mark>
> <mark>multiple Codex conversations with GPT as a development collaborator.</mark>


<mark>GPT helped me move from the original idea to a working Next.js product:</mark>

- <mark>**Design** — workplace simulation structure and learning experience</mark>
- <mark>**Implementation** — onboarding, role-based collaboration, workspace, and
  pull-request workflow</mark>
- <mark>**Hardening** — private runs, server-side validation, and reliable local demos</mark>
- <mark>**Debugging** — integration issues, UI problems, and build failures</mark>
- <mark>**Documentation** — project docs, learner guides, and this README</mark>

<mark>I used Codex as a partner for exploration, implementation, debugging, and
review—not as an unexamined code generator. I retained ownership of the product
vision, learning experience, acceptance criteria, credentials, configuration,
deployment, and final decisions. GPT-5.6 Terra was used during development;
optional live teammate responses are provided through the configured OpenRouter
model, with a deterministic fallback for the core simulation.</mark>

**Note:** All changes before my commit "resolved missing o auth icons" that accounts for more than 90% of work are done using GPT 5.6 terra only.

## Current direction

AIWEX currently focuses on a single, deeply connected engineering scenario. My
next direction is to: 
- Add real production-level projects that closely resemble professional software development and open-source contributions.
- Support collaborative teams where multiple learners can work together in a shared environment, fostering teamwork, competition, and community-driven learning.
- Build an admin dashboard and recruiter portal that allows employers to evaluate candidates based on verified performance and workplace behavior.
- Introduce user stories and AI-powered client interactions to simulate gathering requirements and building projects from scratch.
- Expand the capabilities of the in-app IDE.
- Simulate a complete DevOps workflow using real cloud infrastructure and deployment pipelines.
- Add support for non-technical career paths, making AIWEX valuable to a broader audience.
- Integrate voice and video collaboration with AI avatars and speech-to-speech conversations to create an even more realistic workplace experience.

## License

No license is currently selected. I will add one deliberately before publishing
the repository for wider reuse.
