import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { releaseSimulationWork } from '@/features/simulator/server/simulation-director'

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string }
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  try {
    const result = await releaseSimulationWork(identity.runId)
    return NextResponse.json({ events: result.released, event: result.released.find((event) => event.type === 'agent_reply') || null, missedDeadlines: result.missedDeadlines }, { status: result.released.length ? 201 : 200 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'The simulation director is unavailable.' }, { status: 503 }) }
}
