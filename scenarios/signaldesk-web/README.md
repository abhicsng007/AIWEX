# SignalDesk web

SignalDesk web is a small, curated B2B SaaS application used as the codebase
inside the AIWEX work simulation. It is intentionally compact, but it behaves
like an organisation-owned project: it has an API contract, legacy behaviour,
known issues, automated checks, a staging-only performance scenario, and clear
delivery expectations.

This repository contains synthetic data only. It is safe to explore and change
as part of a learner scenario; it is not a customer-facing production service.

## Current work: PROJ-184

**Build the usage-alerts empty state.**

The active task is in `app/components/alerts-panel.tsx`. When a workspace has
no usage alerts, the UI should give the user useful guidance without exposing a
billing-management action to a user who does not have permission to manage
billing.

### Acceptance criteria

- Show the empty-state title and guidance when there are no alerts.
- Show the billing-management action only when the supplied user role permits
  it.
- Keep the empty state working for older workspaces where the usage threshold
  is unavailable.
- Preserve the existing alerts list when alerts exist.
- Pass the scenario check before requesting review.

The task is deliberately scoped. Do not redesign the entire component, change
the API contract, or “fix” unrelated legacy performance work while completing
PROJ-184. If a requirement is unclear, ask a focused question in the project
channel and record the answer before assuming.

## Product and technical context

SignalDesk helps workspace administrators understand product usage. The
dashboard reads a usage summary, shows current usage and threshold information,
and may show an alert state. Some older workspaces were created before a
threshold was stored, so `threshold` can be `null`. Some team members can view
usage without being allowed to manage billing.

The important principle is **safe degradation**: missing legacy data should not
break the experience, and an unauthorised user should not receive an action
they cannot complete.

## Repository map

```text
app/
  api/
    health/route.ts                 Service health endpoint
    usage/summary/route.ts          Usage-summary HTTP contract
  components/
    alerts-panel.tsx                PROJ-184 implementation surface
    empty-state.tsx                 Reusable empty-state presentation
  page.tsx                          Small scenario dashboard

lib/
  usage.ts                          Legacy aggregation and nullable threshold data

tests/
  alerts-panel.test.cjs             Executable PROJ-184 validation

docs/
  architecture.md                   Component and API ownership
  known-issues.md                   Available scenario work, risks, and signals

load-tests/
  usage-summary.js                  Staging-only performance scenario
```

Read `docs/architecture.md` and `docs/known-issues.md` before making a material
assumption about API behaviour or the scope of work.

## Run the project locally

### Prerequisites

- Node.js 22 or later.
- npm.
- Docker and k6 only for the optional disposable-staging performance scenario.

### Start the application

```bash
npm install
npm run dev
```

Useful endpoints:

| Endpoint | Use |
| --- | --- |
| `GET /api/health` | Confirms the scenario service is running. |
| `GET /api/usage/summary?workspaceId=legacy-acme` | Exercises the legacy workspace contract. |
| `GET /api/usage/summary?workspaceId=<slug>` | Returns a synthetic usage summary for a valid workspace slug. |

## Verify your change

Run the scenario check after saving the change:

```bash
npm run test:usage-alerts
```

The test verifies the role-safe usage-alerts behaviour and parses the component
as TSX. In AIWEX, the workspace submits the learner’s saved source to the same
test in an isolated temporary directory. A passing result records the source
hash, command, duration, and verification event before the pull-request flow
can continue.

Passing a check is evidence that the agreed scenario requirements pass. It is
not permission to skip review. Commit the passing work, open a PR, respond to
any review request with what changed and how it was validated, then record the
merge rationale.

## Working agreement

Use this delivery order for the scenario:

```text
Read the issue
  → clarify a real uncertainty
  → make the smallest safe change
  → run the check
  → commit
  → open a pull request
  → address review
  → obtain approval
  → record merge rationale
  → merge and complete the task
```

Good PR notes are brief and factual:

```text
What changed: …
Why: …
Validation: …
Risk or follow-up: …
```

Do not put credentials, customer data, tokens, or secrets in a scenario commit
or a team-space message.

## Legacy behaviour and future work

The project intentionally contains linked work that is not part of PROJ-184:

| ID | Area | Current signal | Next safe action |
| --- | --- | --- | --- |
| `PROJ-184` | Usage alerts UI | Restricted members can see a billing CTA. | Role-safe empty state and review. |
| `DATA-8` | Legacy data | Older workspaces have a nullable threshold. | Preserve the contract and regression coverage. |
| `PERF-21` | Usage API | Legacy aggregation scans events on each request. | Measure only in disposable staging before proposing a change. |

Do not combine these items into one PR unless a maintainer explicitly requests
it. Small changes are easier to review, test, roll back, and explain.

## Disposable staging and performance work

Performance work is a later, controlled scenario. Build and run the included
image only against a learner-specific or cohort-specific non-production target:

```bash
docker build -t signaldesk-scenario .
docker run --rm -p 3000:3000 signaldesk-scenario
SCENARIO_BASE_URL=http://localhost:3000 k6 run load-tests/usage-summary.js
```

`SCENARIO_BASE_URL` must point to a disposable scenario target, never the
AIWEX platform or a real production service. Keep the test within the scenario
limits and record the measured result and trade-off in the relevant issue or
PR.

## When you are stuck

1. Re-read the acceptance criteria in the issue.
2. Check the component, API contract, and known-issues documents.
3. State your interpretation and ask the smallest question needed to continue.
4. Make the result visible through the normal check and PR workflow.

The goal is not to guess perfectly. The goal is to make a safe decision with
the information available and leave a clear record for the next teammate.
