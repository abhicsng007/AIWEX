import { NextRequest, NextResponse } from 'next/server'
import { projectAccessError } from '@/features/simulator/domain/onboarding'
import { isScenarioWorkspacePath, workspaceFromEvents } from '@/features/simulator/domain/workspace'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { getTheiaConfig, verifyTheiaSession } from '@/features/simulator/server/theia-session'

export const runtime = 'nodejs'

const maxSourceBytes = 100_000

function corsHeaders(request: NextRequest) {
  const config = getTheiaConfig()
  const origin = request.headers.get('origin')
  if (!config.enabled || !config.workbenchOrigin || origin !== config.workbenchOrigin) return null
  return {
    'Access-Control-Allow-Origin': config.workbenchOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export async function OPTIONS(request: NextRequest) {
  const headers = corsHeaders(request)
  return new NextResponse(null, { status: headers ? 204 : 403, headers: headers || undefined })
}

/**
 * The custom Theia bridge may save only allow-listed scenario files. It never
 * receives database credentials and cannot call the broader event API.
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  if (!headers) return NextResponse.json({ error: 'This origin is not allowed to synchronize workspace revisions.' }, { status: 403 })
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const claims = verifyTheiaSession(token)
  if (!claims) return NextResponse.json({ error: 'Theia session is invalid or expired.' }, { status: 401, headers })
  const body = await request.json().catch(() => ({})) as { path?: string; content?: string; baseRevisionId?: string | null }
  if (typeof body.path !== 'string' || typeof body.content !== 'string') return NextResponse.json({ error: 'A workspace path and content are required.' }, { status: 400, headers })
  if (!isScenarioWorkspacePath(body.path) || Buffer.byteLength(body.content, 'utf8') > maxSourceBytes) return NextResponse.json({ error: 'This file cannot be saved or exceeds the 100 KB workspace limit.' }, { status: 400, headers })
  const events = await inMemoryEventStore.list(claims.runId)
  const accessError = projectAccessError(events, 'workspace_revision_saved')
  if (accessError) return NextResponse.json({ error: accessError }, { status: 409, headers })
  const current = workspaceFromEvents(events).find((file) => file.path === body.path)
  if (body.baseRevisionId && current?.revisionId && body.baseRevisionId !== current.revisionId) return NextResponse.json({ error: 'This file was updated in another session. Reload the latest revision before saving.' }, { status: 409, headers })
  const event = { id: crypto.randomUUID(), organizationId: claims.runId, type: 'workspace_revision_saved' as const, createdAt: new Date().toISOString(), metadata: { path: body.path, content: body.content, baseRevisionId: body.baseRevisionId || '', source: 'theia' } }
  await inMemoryEventStore.append(event)
  return NextResponse.json({ file: workspaceFromEvents([...events, event]).find((file) => file.path === body.path), event }, { status: 201, headers })
}
