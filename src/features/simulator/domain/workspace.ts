import type { SimulationEvent } from './types'

export type WorkspaceFile = {
  path: string
  language: 'typescript' | 'tsx' | 'markdown' | 'json'
  content: string
  updatedAt: string | null
  revisionId: string | null
}

export const scenarioWorkspaceFiles: WorkspaceFile[] = [
  {
    path: 'app/components/alerts-panel.tsx', language: 'tsx', updatedAt: null, revisionId: null,
    content: `import { EmptyState } from './empty-state'

type UsageAlert = { id: string; currentUsage: number }

/** Restrict the billing-management link by role. */
export function AlertsPanel({ alerts }: { alerts: UsageAlert[] }) {
  if (!alerts.length) {
    return <EmptyState
      title="No usage alerts yet"
      description="We'll let you know when your workspace is close to a limit."
      action={<a href="/settings/billing">Review your plan</a>}
    />
  }
  return <ul>{alerts.map((alert) => <li key={alert.id}>Usage is {alert.currentUsage}</li>)}</ul>
}`,
  },
  {
    path: 'app/components/alert-list.tsx', language: 'tsx', updatedAt: null, revisionId: null,
    content: `import type { UsageAlert } from './types'

export function AlertList({ alerts }: { alerts: UsageAlert[] }) {
  return <ul className="alert-list">{alerts.map((alert) => <li key={alert.id}>{alert.currentUsage}% used</li>)}</ul>
}`,
  },
  {
    path: 'app/components/types.ts', language: 'typescript', updatedAt: null, revisionId: null,
    content: `export type UsageAlert = {
  id: string
  threshold?: number
  currentUsage: number
  status: 'active' | 'resolved'
}`,
  },
  {
    path: 'app/components/empty-state.tsx', language: 'tsx', updatedAt: null, revisionId: null,
    content: `type EmptyStateProps = { title: string; description: string; action?: React.ReactNode }

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <section className="empty-state"><h2>{title}</h2><p>{description}</p>{action}</section>
}`,
  },
  {
    path: 'README.md', language: 'markdown', updatedAt: null, revisionId: null,
    content: [
      '# SignalDesk web',
      '',
      'SignalDesk web is the B2B SaaS codebase used for this AIWEX scenario. It is a safe, curated project with synthetic data, a clear API contract, legacy behaviour, executable checks, and a normal review workflow.',
      '',
      'This workspace shows the files relevant to the current issue. Treat it like a focused checkout of a real organisation project: understand the goal, make a small change, validate it, ask for review, and leave a clear decision record.',
      '',
      '## Current work: PROJ-184',
      '',
      '**Build the usage-alerts empty state.**',
      '',
      'The active implementation surface is `app/components/alerts-panel.tsx`. When a workspace has no usage alerts, the UI should give useful guidance without showing a billing-management action to someone who cannot manage billing.',
      '',
      '### Acceptance criteria',
      '',
      '- Show the empty-state title and guidance when there are no alerts.',
      '- Show the billing-management action only when the supplied role permits it.',
      '- Keep the empty state safe for older workspaces where the threshold is unavailable.',
      '- Preserve the existing alerts list when alerts exist.',
      '- Pass the scenario check before requesting review.',
      '',
      'Keep the change scoped to the issue. Do not redesign the component or change unrelated API behaviour. If an assumption matters, ask a focused question in Team space before choosing a solution.',
      '',
      '## Product context',
      '',
      'SignalDesk helps workspace administrators understand product usage. Some people can view usage without being allowed to manage billing. Some older workspaces were created before a usage threshold was stored. The product must stay useful in both cases.',
      '',
      'The principle is **safe degradation**: missing legacy data must not break the experience, and an unauthorised person must not receive an action they cannot complete.',
      '',
      '## Files in this task',
      '',
      '```text',
      'app/components/alerts-panel.tsx  PROJ-184 implementation surface',
      'app/components/empty-state.tsx   Reusable empty-state presentation',
      'app/components/alert-list.tsx    Existing alert-list rendering',
      'app/components/types.ts          Usage alert shape; threshold may be absent',
      'README.md                        Project purpose, scope, and working agreement',
      '```',
      '',
      'The broader scenario also includes a usage-summary API with a legacy nullable threshold and a later performance work item. Those are context for this task, not permission to enlarge its scope.',
      '',
      '## Verification',
      '',
      'After saving your change, choose **Run scenario checks** in the workspace. The check validates the role-safe usage-alert behaviour against your saved revision. A passing result records the source hash, command, duration, and verification event before the pull-request flow can continue.',
      '',
      'A passing check is evidence that the agreed scenario requirements pass. It is not a reason to skip review.',
      '',
      '## Delivery workflow',
      '',
      '```text',
      'Read the issue',
      '  → clarify a real uncertainty',
      '  → make the smallest safe change',
      '  → save and run checks',
      '  → commit',
      '  → open a pull request',
      '  → address review',
      '  → obtain approval',
      '  → record merge rationale',
      '  → merge and complete the task',
      '```',
      '',
      'When opening a PR, explain four things in plain language:',
      '',
      '```text',
      'What changed: …',
      'Why: …',
      'Validation: …',
      'Risk or follow-up: …',
      '```',
      '',
      'A useful review response names the decision and the evidence. “Fixed” is not enough for another engineer to understand what was changed or why it is safe.',
      '',
      '## Working safely',
      '',
      '- Do not put secrets, credentials, or real customer data into a scenario file or message.',
      '- Do not mark the task complete before the PR is merged.',
      '- Do not combine unrelated work items in the same PR without an explicit request.',
      '- Raise a blocker or delivery risk early; it gives the team time to help.',
      '',
      '## When you are stuck',
      '',
      '1. Re-read the acceptance criteria in the issue.',
      '2. Re-read the tech-lead context in the workspace.',
      '3. State your current interpretation and ask the smallest question needed to continue.',
      '4. Save, validate, and make the result visible through the normal PR workflow.',
      '',
      'The goal is not to guess perfectly. The goal is to make a safe decision with the information available and leave a clear record for the next teammate.',
    ].join('\n'),
  },
]

export function workspaceFromEvents(events: SimulationEvent[]): WorkspaceFile[] {
  const files = new Map(scenarioWorkspaceFiles.map((file) => [file.path, { ...file }]))
  for (const event of events) {
    if (event.type !== 'workspace_revision_saved') continue
    const path = typeof event.metadata?.path === 'string' ? event.metadata.path : ''
    const content = typeof event.metadata?.content === 'string' ? event.metadata.content : null
    if (!path || content === null || !files.has(path)) continue
    const previous = files.get(path)!
    files.set(path, { ...previous, content, updatedAt: event.createdAt, revisionId: event.id })
  }
  return [...files.values()]
}

export function isScenarioWorkspacePath(path: string) {
  return scenarioWorkspaceFiles.some((file) => file.path === path)
}
