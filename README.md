# AIWEX - practise the work around the code

> A safe, evidence-based simulator that teaches new developers how software teams communicate, validate, review, and ship.

| Hackathon recommendation | [OpenAI Build Week](https://openai.devpost.com/) - **Education** track |
| --- | --- |
| Built with | **Codex and GPT-5.6** during development; see [Codex collaboration](docs/codex-collaboration.md) |
| Runtime AI | Optional OpenRouter teammate responses using Llama 3.1 8B; a deterministic fallback works with no model key |
| Judge fast path | npm ci, npm run dev, then http://localhost:3000/demo?onboarding=1 |
| Demo path | Onboarding -> stand-up -> workspace checks -> PR -> review -> merge -> evidence report |

> **Deployment note:** set server-only DEMO_MODE=true in the judge deployment
> before sharing the /demo link. Demo mode is deliberately enabled by default
> in local development and disabled by default in production.

## The problem

New developers are often taught how to write code but not how professional
software delivery works around the code. Terms such as stand-up, issue, pull
request, review, deadline risk, and handoff can feel like an unexplained second
curriculum. That gap makes an early-career developer less confident and makes
their first team experience unnecessarily high-stakes.

Most coding exercises stop at "tests pass." Real work does not. Before a change
is complete, a developer normally needs to make a plan visible, understand a
ticket, preserve customer and permission behaviour, validate the change, invite
review, respond with evidence, and document why it is safe to merge.

## The solution

AIWEX is a runnable simulation of that missing workflow. A learner joins the
fictional SignalDesk product team and completes a controlled delivery cycle:

~~~mermaid
flowchart LR
  A[Onboarding and readiness] --> B[Stand-up and team context]
  B --> C[Issue and safe workspace change]
  C --> D[Server-verified scenario checks]
  D --> E[Commit and pull request]
  E --> F[Review response, approval, merge rationale]
  F --> G[Task report and private feedback]
~~~

The simulation does not reward button-clicking alone. Its append-only event
ledger records the actions that matter, while server-side workflow gates prevent
out-of-order completion. The result is a private, readable delivery trail that
helps a learner explain *how* they worked, not merely claim that they did.

## What makes it different

- **A complete product experience, not a mock dashboard.** Learners move from
  onboarding through a workday, editable code workspace, issue board, team
  spaces, meetings, pull requests, and feedback.
- **Evidence over self-reporting.** Task and project reports are derived from
  timestamped events such as a verified check, review response, approval, and
  merge - not from a learner-written achievement statement.
- **Safe failure modes.** A learner cannot mark an issue complete before merge
  evidence exists. The simulator creates a visible follow-up instead of silently
  accepting an unsupported claim.
- **Designed for first-time professionals.** Plain-language onboarding and the
  in-app guide explain why each ceremony exists and provide a low-risk place to
  practise it.
- **Optional AI, deterministic core.** AI teammates can respond through
  OpenRouter when configured; the workflow and demo remain usable without an
  external model call.

## Judge fast path

### Run the app

~~~bash
npm ci
npm run dev
~~~

Then open one of these URLs:

- **Full onboarding demo:** http://localhost:3000/demo?onboarding=1
- **Fast pre-qualified demo:** http://localhost:3000/demo
- **Public landing page:** http://localhost:3000

No local environment file or API key is needed for the demo. If you want to
configure integrations, create .env.local from .env.example only when you do
not already have a local configuration.

Demo runs are disposable and isolated. They bypass sign-in only for evaluation;
the normal /app experience uses Supabase authentication when configured.

### What to try in three minutes

1. Complete onboarding, including policy acknowledgements and the readiness
   assessment. The manager approval screen should reach 100/100.
2. On Home, post the async stand-up and send one contextual question in
   #product-usage.
3. Open Workspace, save the safe canManageBilling implementation, run the
   server-verified scenario checks, and commit the change.
4. Open the pull request, mark the review addressed, send a validation-backed
   response, wait for approval, record a merge rationale, and merge.
5. Set the active issue to Done, then open Feedback to inspect the generated
   task report and its linked evidence trail.

For the full six-task journey and exact onboarding answers, use the
[recording runbook](output/pdf/signaldesk-video-workflow-runbook.pdf).

## How Codex and GPT-5.6 contributed

AIWEX was built from scratch across multiple Codex sessions during OpenAI Build
Week, using GPT-5.6 Terra as a development collaborator. Codex helped turn an
initial learning-product idea into a working Next.js simulation: a realistic
organisation, project, sprint, issue, collaboration, workspace, pull-request,
and feedback flow rather than a collection of disconnected screens.

Its contribution covered the most important product areas:

- **Learning and workflow:** onboarding academy, readiness checks, schedules,
  deadlines, role-based teammates, team spaces, chat, meetings, and progressive
  Basic, Intermediate, and Advanced tasks.
- **Engineering simulation:** an editable multi-file workspace, server-side
  scenario validation, evidence from checks, commits, pull requests, review,
  approval, merge decisions, and recruiter-readable reports.
- **Trust and resilience:** authenticated private runs, Supabase persistence
  and row-level security, protected server routes, organisation-aware data, and
  an optional OpenRouter provider with a deterministic fallback.
- **Quality and delivery:** responsive light/dark UI refinement, debugging
  authentication and build issues, API and scenario verification, production
  builds, a novice guide, a recording runbook, and this submission package.

The human builder retained ownership of the problem, product direction,
acceptance decisions, external integrations, and final submission. The app does
**not** claim that GPT-5.6 is a runtime dependency: its optional live teammate
provider uses OpenRouter, and the core simulation has a deterministic fallback.

Read the detailed, reviewable [Codex collaboration record](docs/codex-collaboration.md).
It includes a compact multi-session evidence table. Before submitting to
Devpost, replace the marked session-ID field with the /feedback Codex Session
ID from the conversation responsible for most of the core implementation.

## Technical implementation

~~~mermaid
flowchart TB
  Client[Next.js and React client]
  Routes[Server route handlers]
  Domain[Workflow and onboarding domains]
  Ledger[(Immutable simulation events)]
  Auth[Supabase Auth and RLS]
  Storage[Private artifacts]
  Agents[Rule-based provider or OpenRouter]

  Client --> Routes
  Routes --> Domain
  Domain --> Ledger
  Routes --> Auth
  Routes --> Storage
  Routes --> Agents
~~~

| Decision | Why it matters |
| --- | --- |
| Server-enforced workflow transitions | The server refuses invalid transitions such as merging before approval or completing an issue before merge evidence. |
| Immutable event ledger | Feedback and delivery reports are reproducible from recorded activity rather than an opaque score. |
| Private simulation runs | Authenticated runs are derived from the server-side user identity; a browser cannot select another learner's run. |
| Role-aware scenario checks | The core task requires both a useful legacy empty state and a guarded billing-management action. |
| Deterministic AI fallback | Evaluation and learner progress are not blocked by a missing provider key, quota, or model outage. |

## Security and privacy

- Browser code never receives the Supabase service-role key or the OpenRouter
  key.
- Protected writes happen in server route handlers.
- Supabase row-level security scopes durable simulation runs to their owner.
- The scenario uses synthetic data. It must never be pointed at production
  customer data or a production load-test target.
- Feedback is private, event-derived coaching - not a hiring decision or a
  personality assessment.

## Configuration

Copy .env.example to .env.local. The app can be explored with no secrets.

| Variable | Needed for | Browser-visible? |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Sign-in with Supabase | Yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Sign-in with Supabase | Yes |
| SUPABASE_URL | Durable server-side data | No |
| SUPABASE_SERVICE_ROLE_KEY | Durable data and private artifacts | **No** |
| OPENROUTER_API_KEY | Optional live teammate messages | **No** |
| OPENROUTER_MODEL or OPENROUTER_MODELS | Select the OpenRouter model(s) | No |
| DEMO_MODE | Enable /demo in production | No |

The configured OpenRouter provider is server-only. Leave its key unset to use
the local deterministic teammate provider.

## Verification

~~~bash
npx tsc --noEmit
npm run build
git diff --check
~~~

Manual acceptance path:

~~~text
onboarding -> stand-up -> contextual teammate message -> saved workspace revision
-> verified checks -> commit -> pull request -> review response -> approval
-> merge rationale -> merge -> issue complete -> feedback report
~~~

## Documentation

| Document | Purpose |
| --- | --- |
| [Devpost submission pack](docs/devpost-submission.md) | Paste-ready project copy, judge checklist, track recommendation, and safeguards. |
| [Codex collaboration record](docs/codex-collaboration.md) | Transparent Codex/GPT-5.6 contribution record and Session ID field. |
| [Three-minute demo script](docs/devpost-video-script.md) | Spoken narration and shot list for the public demo video. |
| [Learner workflow guide](docs/learner-workflow-guide.md) | Plain-English explanation of onboarding, stand-ups, PRs, reviews, meetings, and feedback. |
| [Agent architecture](docs/agent-architecture.md) | Role model, event orchestration, and provider constraints. |
| [Supabase backend](docs/supabase-backend.md) | Durable events, auth boundary, RLS, and artifact storage. |
| [Production deployment](docs/production-deployment.md) | Deployment, scheduler, health checks, and launch safeguards. |

## Submission checklist

- [ ] Choose **Education** as the Devpost track unless the final framing is
  primarily about team productivity rather than learning.
- [ ] Provide a public repository URL, or share a private repository with
  testing@devpost.com and build-week-event@openai.com.
- [ ] Provide a working deployment or the judge fast-path instructions above.
- [ ] Upload a public YouTube demo under three minutes with audio that explains
  the product and how Codex/GPT-5.6 contributed.
- [ ] Add the /feedback Codex Session ID to
  [docs/codex-collaboration.md](docs/codex-collaboration.md).
- [ ] Choose and add an explicit open-source license if making the repository
  public. Do not copy a license without confirming that it matches your intent.
- [ ] Use the [Devpost submission pack](docs/devpost-submission.md) to keep the
  written description, demo, and testing instructions consistent.

## License

No license is currently selected. Before publishing the repository, the owner
should choose a license deliberately and add it here.
