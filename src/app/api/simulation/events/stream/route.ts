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
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      try { send('snapshot', await inMemoryEventStore.list(identity.runId)) }
      catch (error) {
        const message = error instanceof Error ? error.message : 'The simulation backend could not be initialized.'
        send('backend-error', { code: 'BACKEND_SCHEMA_UNAVAILABLE', message, action: 'Run the simulator migrations before starting a run.' })
        controller.close()
        return
      }
      unsubscribe = inMemoryEventStore.subscribe((event) => {
        if (event.organizationId === identity.runId) send('simulation-event', event)
      })
      const heartbeat = setInterval(() => send('ping', { at: new Date().toISOString() }), 25_000)
      request.signal.addEventListener('abort', () => { clearInterval(heartbeat); unsubscribe(); controller.close() }, { once: true })
    },
    cancel() { unsubscribe() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } })
}
