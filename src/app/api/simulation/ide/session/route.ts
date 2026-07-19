import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { projectAccessError } from '@/features/simulator/domain/onboarding'
import { workspaceFromEvents } from '@/features/simulator/domain/workspace'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { createTheiaSession, getTheiaConfig } from '@/features/simulator/server/theia-session'

export const runtime = 'nodejs'

async function identityForWorkspace(request: NextRequest, requestedRunId?: string | null) {
  const identity = await simulationRunIdentity(request, requestedRunId)
  if (!identity) return { error: NextResponse.json({ error: 'Sign in to access the workbench.' }, { status: 401 }) }
  const events = await inMemoryEventStore.list(identity.runId)
  const accessError = projectAccessError(events, 'workspace_revision_saved')
  if (accessError) return { error: NextResponse.json({ error: accessError }, { status: 409 }) }
  return { identity, events }
}

/** Returns only availability; the browser receives a short-lived token on POST. */
export async function GET(request: NextRequest) {
  const workspace = await identityForWorkspace(request, request.nextUrl.searchParams.get('organizationId'))
  if ('error' in workspace) return workspace.error
  const config = getTheiaConfig()
  return NextResponse.json({ available: config.enabled, reason: config.enabled ? undefined : config.reason })
}

/**
 * The AIWEX app is the only service that may mint a Theia session. The token
 * is delivered to the isolated iframe with postMessage, not placed in its URL.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { organizationId?: string }
  const workspace = await identityForWorkspace(request, body.organizationId)
  if ('error' in workspace) return workspace.error
  const config = getTheiaConfig()
  if (!config.enabled) return NextResponse.json({ error: 'Theia workbench is not configured.', reason: config.reason }, { status: 503 })
  const session = createTheiaSession(workspace.identity.runId, workspace.identity.actor.id)
  return NextResponse.json({
    workbenchUrl: session.workbenchUrl,
    workbenchOrigin: session.workbenchOrigin,
    token: session.token,
    expiresAt: new Date(session.claims.expiresAt * 1000).toISOString(),
    files: workspaceFromEvents(workspace.events),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
