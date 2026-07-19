import { NextRequest, NextResponse } from 'next/server'
import { createDemoRunId, demoCookieName, demoModeEnabled, demoRunFromRequest } from '@/features/auth/demo-session'
import { accessCatalog, nextScheduleStart, policyRequirements, trainingSlides } from '@/features/simulator/domain/onboarding'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export const runtime = 'nodejs'

function event(organizationId: string, type: SimulationEvent['type'], metadata: SimulationEvent['metadata'] = {}): SimulationEvent {
  return { id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata }
}

async function seedQualifiedDemo(runId: string) {
  if ((await inMemoryEventStore.list(runId)).length) return
  const events: SimulationEvent[] = [
    event(runId, 'onboarding_started'),
    event(runId, 'onboarding_profile_confirmed', { employeeId: 'DEMO-SD-001', role: 'Full-stack Engineer', manager: 'Marcus Reed' }),
    ...policyRequirements.map((policy) => event(runId, 'policy_acknowledged', { policyId: policy.id, owner: policy.owner, evidence: policy.evidence })),
    ...accessCatalog.map((access) => event(runId, 'access_provisioned', { accessId: access.id, system: access.system, owner: access.owner, requiredForProject: access.requiredForProject })),
    ...trainingSlides.map((slide) => event(runId, 'training_slide_completed', { slideId: slide.id })),
    event(runId, 'readiness_task_started', { attempt: 1 }),
    event(runId, 'readiness_task_passed', { evidence: 'demo_bypass', score: 100 }),
    event(runId, 'manager_signoff_recorded', { reviewer: 'Marcus Reed', score: 100, decision: 'approved_for_project_access' }),
    event(runId, 'schedule_created', { startAt: nextScheduleStart(), timezone: 'UTC' }),
  ]
  for (const item of events) await inMemoryEventStore.append(item)
}

/** Creates a disposable, in-memory, pre-qualified demo run. */
export async function GET(request: NextRequest) {
  if (!demoModeEnabled()) return NextResponse.redirect(new URL('/sign-in?error=Demo+mode+is+disabled.', request.url))
  const runId = demoRunFromRequest(request) || createDemoRunId()
  await seedQualifiedDemo(runId)
  const response = NextResponse.redirect(new URL('/demo/workspace', request.url))
  response.cookies.set({ name: demoCookieName, value: runId, httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 4 * 60 * 60 })
  return response
}
