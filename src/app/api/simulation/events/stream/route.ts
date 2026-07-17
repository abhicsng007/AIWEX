import { NextRequest } from 'next/server'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) return new Response('organizationId is required', { status: 400 })

  const encoder = new TextEncoder()
  let unsubscribe: () => void = () => {}
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      let existing
      try { existing = await inMemoryEventStore.list(organizationId) }
      catch (error) {
        const message = error instanceof Error ? error.message : 'The simulation backend could not be initialized.'
        send('backend-error', { code: 'BACKEND_SCHEMA_UNAVAILABLE', message, action: 'Run supabase/migrations/202607170001_simulator_backend.sql in the Supabase SQL Editor.' })
        controller.close()
        return
      }
      send('snapshot', existing)
      unsubscribe = inMemoryEventStore.subscribe((event) => {
        if (event.organizationId === organizationId) send('simulation-event', event)
      })
      const heartbeat = setInterval(() => send('ping', { at: new Date().toISOString() }), 25000)
      request.signal.addEventListener('abort', () => { clearInterval(heartbeat); unsubscribe(); controller.close() }, { once: true })
    },
    cancel() { unsubscribe() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } })
}
