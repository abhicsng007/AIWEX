import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { deriveScenarioProgression } from '@/features/simulator/domain/progression'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  try { return NextResponse.json({ progression: deriveScenarioProgression(await inMemoryEventStore.list(identity.runId)) }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Progression is unavailable.' }, { status: 503 }) }
}
