import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { assessSimulation } from '@/features/simulator/domain/assessment'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  return NextResponse.json({ report: assessSimulation(await inMemoryEventStore.list(identity.runId)) })
}
