import { EmptyState } from '../../app/components/empty-state'

type UsageAlert = { id: string; currentUsage: number }

export function AlertsPanel({ alerts, canManageBilling }: { alerts: UsageAlert[]; canManageBilling: boolean }) {
  if (!alerts.length) {
    return <EmptyState
      title="No usage alerts yet"
      description="We'll let you know when your workspace is close to a limit."
      action={canManageBilling ? <a href="/settings/billing">Review your plan</a> : undefined}
    />
  }

  return <ul>{alerts.map((alert) => <li key={alert.id}>Usage is {alert.currentUsage}</li>)}</ul>
}
