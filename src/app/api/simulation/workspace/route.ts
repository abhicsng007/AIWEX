import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { projectAccessError } from '@/features/simulator/domain/onboarding'
import { isScenarioWorkspacePath, workspaceFromEvents } from '@/features/simulator/domain/workspace'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

const maxSourceBytes = 100_000

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this workspace.' }, { status: 401 })
  const events = await inMemoryEventStore.list(identity.runId)
  return NextResponse.json({ files: workspaceFromEvents(events) })
}

export async function PUT(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; path?: string; content?: string; baseRevisionId?: string | null }
  if (typeof body.path !== 'string' || typeof body.content !== 'string') return NextResponse.json({ error: 'A workspace path and source content are required.' }, { status: 400 })
  if (!isScenarioWorkspacePath(body.path) || Buffer.byteLength(body.content, 'utf8') > maxSourceBytes) return NextResponse.json({ error: 'This file cannot be saved or exceeds the 100 KB workspace limit.' }, { status: 400 })
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this workspace.' }, { status: 401 })
  const events = await inMemoryEventStore.list(identity.runId)
  const accessError = projectAccessError(events, 'workspace_revision_saved')
  if (accessError) return NextResponse.json({ error: accessError }, { status: 409 })
  const current = workspaceFromEvents(events).find((file) => file.path === body.path)
  if (body.baseRevisionId && current?.revisionId && body.baseRevisionId !== current.revisionId) return NextResponse.json({ error: 'This file was updated in another session. Reload its latest revision before saving.' }, { status: 409 })
  const event = { id: crypto.randomUUID(), organizationId: identity.runId, type: 'workspace_revision_saved' as const, createdAt: new Date().toISOString(), metadata: { path: body.path, content: body.content, baseRevisionId: body.baseRevisionId || '' } }
  await inMemoryEventStore.append(event)
  return NextResponse.json({ file: workspaceFromEvents([...events, event]).find((file) => file.path === body.path), event }, { status: 201 })
}
