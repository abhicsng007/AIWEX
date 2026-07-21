import { NextRequest, NextResponse } from 'next/server'
import { clearDemoCookie, createDemoRunId, demoCookieName, demoModeEnabled, demoRunFromRequest } from '@/features/auth/demo-session'
import { authenticatedActor } from '@/features/auth/server-auth'
import { accessCatalog, nextScheduleStart, policyRequirements, trainingSlides } from '@/features/simulator/domain/onboarding'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { driveCompleteShowcaseJourney } from '@/features/simulator/server/showcase-demo-journey'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

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

function setDemoCookie(response: NextResponse, request: NextRequest, runId: string) {
  response.cookies.set({
    name: demoCookieName,
    value: runId,
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 4 * 60 * 60,
  })
  return response
}

/**
 * Demo entry points:
 * - /demo?onboarding=1  → clean onboarding journey
 * - /demo               → pre-qualified Day-1 project access (seeded events)
 * - /demo?complete=1    → full Basic→Advanced journey via real HTTP APIs + reports
 */
export async function GET(request: NextRequest) {
  if (!demoModeEnabled()) return NextResponse.redirect(new URL('/sign-in?error=Demo+mode+is+disabled.', request.url))
  // Signed-in learners already own a private run. Never attach a demo cookie to
  // an authenticated browser — that previously made demo UI state feel "saved"
  // into the real account after sign-up.
  if (await authenticatedActor(request)) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  const startAtOnboarding = request.nextUrl.searchParams.get('onboarding') === '1'
  const completeJourney = request.nextUrl.searchParams.get('complete') === '1'
    || request.nextUrl.searchParams.get('journey') === 'complete'

  if (completeJourney) {
    // Always use a fresh disposable run so the showcase is isolated and complete.
    const runId = createDemoRunId()
    try {
      await driveCompleteShowcaseJourney(request.nextUrl.origin, runId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not build the complete demo journey.'
      const failed = clearDemoCookie(NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(message)}`, request.url)), request)
      return failed
    }
    const response = NextResponse.redirect(new URL('/demo/workspace', request.url))
    return setDemoCookie(response, request, runId)
  }

  // A clean onboarding recording still bypasses sign-in, but deliberately
  // starts before policies, training, and readiness have been completed.
  const runId = startAtOnboarding ? createDemoRunId() : demoRunFromRequest(request) || createDemoRunId()
  if (!startAtOnboarding) await seedQualifiedDemo(runId)
  const response = NextResponse.redirect(new URL('/demo/workspace', request.url))
  return setDemoCookie(response, request, runId)
}
