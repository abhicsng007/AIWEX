# Codex and GPT-5.6 Collaboration Record

AIWEX was built from scratch by its project owner across multiple Codex sessions
using GPT-5.6 Terra as a development collaborator. This record explains that
collaboration plainly for Build Week reviewers. It does not claim that Codex or
GPT-5.6 is the production runtime model.

## Required Devpost field

**Codex /feedback Session ID:** [PASTE THE SESSION ID HERE BEFORE SUBMITTING]

Get this value from the Codex conversation that contributed to the majority of AIWEX's core functionality. Do not invent, reuse, or guess a Session ID. Paste the same value into the Devpost submission form.

## Multi-session development record

AIWEX was not produced in one prompt or from a pre-existing template. Its
product, workflow, interface, server boundaries, persistence, testing, and
documentation were developed iteratively from scratch across multiple
GPT-5.6 Terra/Codex conversations.

Devpost requires the Session ID for the thread responsible for the **majority
of the core functionality**, not a list of every conversation. Select that
primary thread for the required field. Keep this compact supporting record for
the other material conversations:

| Date or period | Area developed with GPT-5.6 Terra/Codex | Outcome or evidence |
| --- | --- | --- |
| [fill in] | Product and scenario design | [for example: SignalDesk workflow and learner journey] |
| [fill in] | Core simulation implementation | [for example: events, workflow gates, reports] |
| [fill in] | Workspace, PR, collaboration, and feedback UX | [for example: relevant commits or source directories] |
| [fill in] | Security, persistence, and deployment | [for example: Supabase migrations and route reviews] |
| [fill in] | Testing, polish, documentation, and demo | [for example: build output, README, and video script] |

Do not publish private chat transcripts or sensitive prompts unless you want to.
This summary, your Git history, and the required primary Session ID are the
useful review evidence.

## What Codex contributed

| Area | Codex contribution | Project-owner decision |
| --- | --- | --- |
| Product and architecture | Helped restructure the app around Next.js and model a coherent simulated workplace: organisations, projects, sprints, issues, team activity, workspaces, branches, commits, pull requests, reviews, CI state, deadlines, and coaching. | Chose the early-career learner audience, the SignalDesk scenario, and the evidence-first product goal. |
| Learning experience | Helped design the onboarding academy, training slides, quizzes, readiness review, manager sign-off, schedules, recovery windows, and Basic, Intermediate, and Advanced progression. | Decided the learning outcomes, assessment standards, and what professional behaviours should be practised. |
| Collaboration and agents | Helped build contextual team spaces, chat, threads, decisions, risks, hand-offs, meetings, notifications, follow-ups, and role-based agents such as manager, PM, tech lead, QA, designer, peer engineer, and stakeholder. | Set the team roles, tone, workflow gates, and the learner-facing coaching approach. |
| Engineering simulation | Helped implement the editable workspace, server-side scenario validation, source and test evidence, commits, PR review, approval, merge rationale, and evidence-based task reports. | Defined the safe scenario behaviour and reviewed the implementation and acceptance criteria. |
| Security and platform | Helped strengthen Supabase SSR authentication, OAuth callback handling, protected route checks, private simulation runs, persistence, row-level security, organisation scoping, and the optional OpenRouter model boundary. | Controlled credentials, provider configuration, data policies, and deployment choices. |
| Quality and release | Helped diagnose migration, authentication, UI, encoding, dependency, and build issues; refine responsive and dark-mode UX; run API/scenario checks and production builds; and create the guide, runbook, README, and Devpost materials. | Reviewed results, chose final UI and wording, and approved the released code and submission claims. |

## Architecture decisions made during the collaboration

- **Evidence first:** the activity ledger is append-only; task state is derived from events rather than a browser-only completion flag.
- **Server-enforced workflow:** server routes validate actions and progression. Client UI is a view of the workflow, not the trusted source of truth.
- **Private runs:** authenticated Supabase deployments can isolate a learner's run with row-level security.
- **Reliable reviewing:** the core simulation works deterministically. Optional OpenRouter teammate responses enrich the experience but are not required to test it.
- **Accurate model disclosure:** GPT-5.6 and Codex were development tools. The optional runtime provider uses the configured OpenRouter model; this project must not be described as serving GPT-5.6 at runtime unless that configuration is actually changed and verified.

## Evidence reviewers can inspect

~~~bash
git log --oneline --decorate -20
git show --stat HEAD
npx tsc --noEmit
npm run build
~~~

The following areas contain the core product work:

- src/features/simulator/ — workflow state, task gates, reports, notifications, and AI-provider boundary.
- src/app/api/ — validated server routes.
- supabase/migrations/ — private simulation tenancy and event-ledger storage.
- docs/ — workflow, deployment, model configuration, and submission documentation.

## Honest runtime-AI disclosure

With OPENROUTER_API_KEY configured, AIWEX can request teammate responses from the selected OpenRouter model. Without it, it uses deterministic scenario responses so the application remains functional for every reviewer. This is an intentional product resilience decision, not a hidden downgrade.

If the deployed project has a different model configuration, update the Devpost copy before submission so it matches the deployed reality.
