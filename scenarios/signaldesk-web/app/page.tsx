async function getSummary() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SCENARIO_URL || 'http://localhost:3000'}/api/usage/summary?workspaceId=legacy-acme`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Usage service is unavailable')
  return response.json() as Promise<{ workspaceId: string; plan: string; currentUsage: number; threshold: number | null; alerts: number; generatedAt: string }>
}

export const dynamic = 'force-dynamic'

export default async function ScenarioHome() {
  const summary = await getSummary()
  return <main>
    <p className="eyebrow">SIGNALDESK · DISPOSABLE STAGING</p>
    <h1>Usage overview</h1>
    <p className="intro">This is a deliberately imperfect B2B SaaS surface. Learners improve it through tickets, tests, review, and measured staging releases.</p>
    <section className="grid">
      <article><small>Workspace</small><strong>{summary.workspaceId}</strong></article>
      <article><small>Plan</small><strong>{summary.plan}</strong></article>
      <article><small>Current usage</small><strong>{summary.currentUsage.toLocaleString()}</strong></article>
      <article><small>Threshold</small><strong>{summary.threshold?.toLocaleString() || 'Legacy data missing'}</strong></article>
    </section>
    <section className="notice"><b>{summary.alerts} active usage alert{summary.alerts === 1 ? '' : 's'}</b><span>API generated at {new Date(summary.generatedAt).toLocaleTimeString()}</span></section>
  </main>
}
