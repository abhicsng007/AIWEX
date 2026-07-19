import { NextRequest } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return new Response('Sign in to access this simulation run.', { status: 401 })
  const encoder = new TextEncoder()
  let unsubscribe: () => void = () => {}
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let reconciliation: ReturnType<typeof setInterval> | undefined
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      const sentIds = new Set<string>()
      const remember = (event: { id: string }) => {
        sentIds.add(event.id)
      }
      const sendSimulationEvent = (event: Awaited<ReturnType<typeof inMemoryEventStore.list>>[number]) => {
        if (sentIds.has(event.id)) return
        remember(event)
        send('simulation-event', event)
      }
      const reconcileLedger = async () => {
        try {
          const events = await inMemoryEventStore.list(identity.runId)
          events.forEach(sendSimulationEvent)
          send('sync', { at: new Date().toISOString() })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The simulation event ledger could not be refreshed.'
          send('backend-error', { code: 'BACKEND_LEDGER_UNAVAILABLE', message, action: 'Retry the connection after the backend is available.' })
        }
      }
      const close = () => {
        if (heartbeat) clearInterval(heartbeat)
        if (reconciliation) clearInterval(reconciliation)
        unsubscribe()
        controller.close()
      }
      try {
        const snapshot = await inMemoryEventStore.list(identity.runId)
        snapshot.forEach(remember)
        send('snapshot', snapshot)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : 'The simulation backend could not be initialized.'
        send('backend-error', { code: 'BACKEND_SCHEMA_UNAVAILABLE', message, action: 'Run the simulator migrations before starting a run.' })
        controller.close()
        return
      }
      unsubscribe = inMemoryEventStore.subscribe((event) => {
        if (event.organizationId === identity.runId) sendSimulationEvent(event)
      })
      heartbeat = setInterval(() => send('ping', { at: new Date().toISOString() }), 25_000)
      // A local listener is instant in development. This reconciliation path
      // also observes durable events appended by a scheduler or another app
      // instance without requiring a process-local shared memory bus.
      reconciliation = setInterval(() => { void reconcileLedger() }, 5_000)
      request.signal.addEventListener('abort', close, { once: true })
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      if (reconciliation) clearInterval(reconciliation)
      unsubscribe()
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } })
}
