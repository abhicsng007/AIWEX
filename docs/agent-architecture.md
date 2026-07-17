# Agent architecture

## Runtime loop

1. A learner action is written as an immutable simulation event.
2. The orchestrator reads the organization’s recent event history and derives workflow state.
3. The role selector chooses an eligible teammate for the channel and subject.
4. The selected provider produces a constrained `AgentTurn` with a permitted action, due time, message, and compact reasoning summary.
5. The route records the agent action as an event; the client renders it in the originating team space.

The result is auditable: every agent response has the triggering event, assigned role, channel, action, and timestamp.

## Role model

| Role | Primary behavior | Example permitted actions |
| --- | --- | --- |
| Product manager | Protects scope, customer value, and priority | Post update, reprioritize, schedule ceremony |
| Tech lead | Challenges assumptions and enforces technical quality | Post update, request/approve review, raise blocker |
| Peer engineer | Coordinates implementation and integration | Post update, request review, raise blocker |
| Product designer | Protects clarity and handoff quality | Post update, raise blocker |
| Engineering manager | Maintains team health and delivery rhythm | Post update, reprioritize, schedule ceremony |

The registry is the source of truth for each agent’s channel scope, goals, voice, and permissions. Agents can only be selected for their assigned spaces and only emit actions within their allowed action set.

## Providers

`AgentTextProvider` is the model boundary. The current `RuleBasedTeamProvider` runs without credentials and makes the local alpha deterministic and testable. A production provider should implement the same interface and receive only the assembled `OrganizationContext`, the selected role profile, and validated tool/action schemas.

Do not let the model directly mutate tickets, PRs, or organization state. It proposes an action; a server-side action executor validates the agent’s permissions, preconditions, and event idempotency before recording it.

## Production extension

- Persist events, agent schedules, and message threads in a relational database.
- Add a durable job queue that releases due agent turns, escalation reminders, ceremony prompts, and dependent-task follow-ups.
- Replace the local provider with an OpenAI-backed implementation behind `AgentTextProvider`; keep API keys server-only.
- Add role-specific tool handlers for review, task reprioritization, blockers, and ceremony scheduling.
- Record provider trace IDs, selected context IDs, validation outcomes, and user-visible evidence for evaluation and debugging.
