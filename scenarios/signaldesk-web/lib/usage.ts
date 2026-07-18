export type UsageEvent = { workspaceId: string; amount: number; createdAt: string }

const events: UsageEvent[] = Array.from({ length: 12_000 }, (_, index) => ({
  workspaceId: index % 5 === 0 ? 'legacy-acme' : `workspace-${index % 80}`,
  amount: 1 + (index % 12),
  createdAt: new Date(Date.UTC(2026, 6, 1, 0, index % 60)).toISOString(),
}))

const workspacePlans: Record<string, { plan: string; threshold: number | null }> = {
  'legacy-acme': { plan: 'Pro', threshold: null },
}

/**
 * Intentional legacy implementation for the simulator. It scans every event
 * for each request and returns a nullable threshold. The learner should use
 * this code, the contract, and measured staging data to make a safe fix.
 */
export function usageSummary(workspaceId: string) {
  const plan = workspacePlans[workspaceId] || { plan: 'Starter', threshold: 10_000 }
  const workspaceEvents = events.filter((event) => event.workspaceId === workspaceId)
  const currentUsage = workspaceEvents.reduce((total, event) => total + event.amount, 0)
  return {
    workspaceId,
    plan: plan.plan,
    threshold: plan.threshold,
    currentUsage,
    alerts: plan.threshold !== null && currentUsage >= plan.threshold ? 1 : 0,
    generatedAt: new Date().toISOString(),
  }
}
