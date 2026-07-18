import { EmptyState } from './empty-state'

type UsageAlert = { id: string; currentUsage: number }

/** Intentional learner task: restrict the billing-management link by role. */
export function AlertsPanel({ alerts }: { alerts: UsageAlert[] }) {
  if (!alerts.length) {
    return <EmptyState
      title="No usage alerts yet"
      description="We'll let you know when your workspace is close to a limit."
      action={<a href="/settings/billing">Review your plan</a>}
    />
  }
  return <ul>{alerts.map((alert) => <li key={alert.id}>Usage is {alert.currentUsage}</li>)}</ul>
}
