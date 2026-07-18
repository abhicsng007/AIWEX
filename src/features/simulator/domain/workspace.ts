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
    content: `# SignalDesk usage alerts\n\nScenario workspace for role-safe usage-alert empty states. Keep customer guidance available when a billing action is not permitted.`,
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
