import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { loadTestResultsFromEvents, meetsPerformanceTarget, parseLoadTestResult, usageDashboardLatencyScenario } from '@/features/simulator/domain/performance'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  try {
    const results = loadTestResultsFromEvents(await inMemoryEventStore.list(identity.runId))
    return NextResponse.json({ scenario: usageDashboardLatencyScenario, results, latest: results.at(-1) || null })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Performance evidence is unavailable.' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; result?: unknown }
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const parsed = parseLoadTestResult(body.result)
  if (!parsed.result) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = parsed.result
  const event = { id: crypto.randomUUID(), organizationId: identity.runId, type: 'load_test_recorded' as const, createdAt: result.recordedAt, metadata: { runId: result.runId, scenarioId: result.scenarioId, environment: result.environment, concurrency: result.concurrency, durationSeconds: result.durationSeconds, p95Ms: result.p95Ms, errorRatePercent: result.errorRatePercent, requestsPerSecond: result.requestsPerSecond, notes: result.notes } }
  try { await inMemoryEventStore.append(event); return NextResponse.json({ result, targetMet: meetsPerformanceTarget(result), event }, { status: 201 }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not record performance evidence.' }, { status: 503 }) }
}
