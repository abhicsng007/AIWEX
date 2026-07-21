import type { SimulationEvent } from './types'

export type PerformanceScenario = {
  id: 'usage-dashboard-latency'
  title: string
  service: string
  endpoint: string
  concurrency: number
  durationSeconds: number
  baseline: { p95Ms: number; errorRatePercent: number; requestsPerSecond: number }
  target: { p95Ms: number; errorRatePercent: number; requestsPerSecond: number }
  guardrails: string[]
}

export type LoadTestResult = {
  scenarioId: PerformanceScenario['id']
  runId: string
  environment: 'scenario-staging'
  concurrency: number
  durationSeconds: number
  p95Ms: number
  errorRatePercent: number
  requestsPerSecond: number
  notes: string
  recordedAt: string
}

export const usageDashboardLatencyScenario: PerformanceScenario = {
  id: 'usage-dashboard-latency',
  title: 'Usage dashboard latency under concurrent traffic',
  service: 'SignalDesk web API',
  endpoint: 'GET /api/usage/summary',
  concurrency: 100,
  durationSeconds: 60,
  baseline: { p95Ms: 1820, errorRatePercent: 3.8, requestsPerSecond: 31 },
  target: { p95Ms: 450, errorRatePercent: 1, requestsPerSecond: 70 },
  guardrails: [
    'Run only against the disposable scenario-staging target.',
    'Never point a load test at the Aiwex platform production URL.',
    'Use seeded synthetic data and the assigned concurrency budget.',
  ],
}

const positiveNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0

export function parseLoadTestResult(value: unknown): { result?: LoadTestResult; error?: string } {
  const candidate = value as Partial<LoadTestResult>
  if (candidate.scenarioId !== usageDashboardLatencyScenario.id) return { error: 'Unknown performance scenario.' }
  if (candidate.environment !== 'scenario-staging') return { error: 'Load-test results may only be recorded for scenario-staging.' }
  if (!positiveNumber(candidate.concurrency) || candidate.concurrency! > 200) return { error: 'Concurrency must be between 0 and 200.' }
  if (!positiveNumber(candidate.durationSeconds) || candidate.durationSeconds! < 10 || candidate.durationSeconds! > 300) return { error: 'Duration must be between 10 and 300 seconds.' }
  if (!positiveNumber(candidate.p95Ms) || !positiveNumber(candidate.errorRatePercent) || candidate.errorRatePercent! > 100 || !positiveNumber(candidate.requestsPerSecond)) return { error: 'Metrics must be valid non-negative measurements.' }
  if (typeof candidate.notes !== 'string' || candidate.notes.trim().length < 20 || candidate.notes.trim().length > 1000) return { error: 'Add 20–1000 characters explaining the change and validation.' }
  return { result: {
    scenarioId: candidate.scenarioId,
    runId: crypto.randomUUID(),
    environment: candidate.environment,
    concurrency: candidate.concurrency as number,
    durationSeconds: candidate.durationSeconds as number,
    p95Ms: candidate.p95Ms as number,
    errorRatePercent: candidate.errorRatePercent as number,
    requestsPerSecond: candidate.requestsPerSecond as number,
    notes: candidate.notes.trim(),
    recordedAt: new Date().toISOString(),
  } }
}

export function loadTestResultsFromEvents(events: SimulationEvent[]): LoadTestResult[] {
  return events.filter((event) => event.type === 'load_test_recorded').map((event) => {
    const metadata = event.metadata || {}
    return {
      scenarioId: usageDashboardLatencyScenario.id,
      runId: String(metadata.runId || event.id),
      environment: 'scenario-staging' as const,
      concurrency: Number(metadata.concurrency || 0),
      durationSeconds: Number(metadata.durationSeconds || 0),
      p95Ms: Number(metadata.p95Ms || 0),
      errorRatePercent: Number(metadata.errorRatePercent || 0),
      requestsPerSecond: Number(metadata.requestsPerSecond || 0),
      notes: String(metadata.notes || ''),
      recordedAt: event.createdAt,
    }
  }).filter((result) => result.scenarioId === usageDashboardLatencyScenario.id)
}

export function meetsPerformanceTarget(result: LoadTestResult) {
  const { target } = usageDashboardLatencyScenario
  return result.p95Ms <= target.p95Ms && result.errorRatePercent <= target.errorRatePercent && result.requestsPerSecond >= target.requestsPerSecond
}
