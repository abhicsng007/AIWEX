import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'

export const demoCookieName = 'aiwex_demo_run'
const demoRunPattern = /^demo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Demos are separate, disposable runs and never map to Supabase users. */
export function demoModeEnabled() {
  return process.env.NODE_ENV === 'production' ? process.env.DEMO_MODE === 'true' : process.env.DEMO_MODE !== 'false'
}

export function isDemoRunId(value: string | null | undefined): value is string {
  return typeof value === 'string' && demoRunPattern.test(value)
}

export function demoRunFromRequest(request: NextRequest) {
  if (!demoModeEnabled()) return null
  const runId = request.cookies.get(demoCookieName)?.value
  return isDemoRunId(runId) ? runId : null
}

export function createDemoRunId() {
  return `demo-${randomUUID()}`
}
