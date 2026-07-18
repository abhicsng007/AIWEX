import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

type AuthenticatedActor = {
  id: string
  email: string | null
}

export type SimulationRunIdentity = {
  actor: AuthenticatedActor
  runId: string
}

/**
 * Every simulation run is private to its authenticated learner.  The event
 * ledger deliberately uses an opaque run id rather than a client supplied
 * organization id so callers cannot switch tenants by editing a request.
 */
export function runIdForUser(userId: string) {
  return `run-${userId}`
}

export async function authenticatedActor(request: NextRequest): Promise<AuthenticatedActor | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      // Route handlers only read the session. Session refresh is handled by
      // the auth callback/browser client, so no response cookie is required.
      setAll: () => {},
    },
  })
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email || null }
}

export async function simulationRunIdentity(request: NextRequest, requestedRunId?: string | null): Promise<SimulationRunIdentity | null> {
  const actor = await authenticatedActor(request)
  if (!actor) return null
  const runId = runIdForUser(actor.id)
  // During the migration clients may omit the id, but they can never select a
  // different run. This is the server-side tenancy boundary for every route.
  if (requestedRunId && requestedRunId !== runId) return null
  return { actor, runId }
}
