import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import { projectAccessError } from '@/features/simulator/domain/onboarding'
import { deriveWorkflowState, validateWorkflowTransition } from '@/features/simulator/domain/workflow'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { simulationRunIdentity } from '@/features/auth/server-auth'

export const runtime = 'nodejs'

const run = promisify(execFile)
const maxSourceBytes = 100_000
const testFile = resolve(process.cwd(), 'scenarios', 'signaldesk-web', 'tests', 'alerts-panel.test.cjs')

function commandOutput(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const result = error as { stdout?: string; stderr?: string; message?: string }
  return [result.stdout, result.stderr, result.message].filter(Boolean).join('\n').trim()
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; source?: string }
  if (typeof body.source !== 'string') return NextResponse.json({ error: 'Source is required.' }, { status: 400 })
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const organizationId = identity.runId
  if (!body.source.trim() || Buffer.byteLength(body.source, 'utf8') > maxSourceBytes) return NextResponse.json({ error: 'Source must be between 1 and 100,000 bytes.' }, { status: 400 })

  const events = await inMemoryEventStore.list(organizationId)
  const onboardingError = projectAccessError(events, 'checks_passed')
  if (onboardingError) return NextResponse.json({ error: onboardingError }, { status: 409 })
  const transitionError = validateWorkflowTransition(deriveWorkflowState(events), 'checks_passed')
  if (transitionError) return NextResponse.json({ error: transitionError }, { status: 409 })

  const workspace = await fs.mkdtemp(join(tmpdir(), 'aiwex-usage-alerts-'))
  const sourcePath = join(workspace, 'alerts-panel.tsx')
  const sourceHash = createHash('sha256').update(body.source).digest('hex')
  const startedAt = Date.now()
  try {
    await fs.writeFile(sourcePath, body.source, 'utf8')
    await run(process.execPath, ['--test', testFile], {
      env: { ...process.env, SCENARIO_SOURCE_PATH: sourcePath },
      timeout: 10_000,
      maxBuffer: 256 * 1024,
    })
    const durationMs = Date.now() - startedAt
    const event = {
      id: randomUUID(), organizationId, type: 'checks_passed' as const, createdAt: new Date().toISOString(),
      metadata: { verified: true, sourceHash, command: 'node --test tests/alerts-panel.test.cjs', durationMs },
    }
    await inMemoryEventStore.append(event)
    return NextResponse.json({ passed: true, sourceHash, durationMs, output: 'Usage-alerts scenario tests passed. Permission guard and TSX syntax were verified from the submitted source.', event }, { status: 201 })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    return NextResponse.json({ passed: false, sourceHash, durationMs, output: commandOutput(error) || 'Scenario validation failed.' }, { status: 422 })
  } finally {
    await fs.rm(workspace, { recursive: true, force: true })
  }
}
