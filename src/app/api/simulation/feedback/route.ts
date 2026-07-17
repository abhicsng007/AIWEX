import { NextRequest, NextResponse } from 'next/server'
import { assessSimulation } from '@/features/simulator/domain/assessment'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  const events = await inMemoryEventStore.list(organizationId)
  return NextResponse.json({ report: assessSimulation(events) })
}
