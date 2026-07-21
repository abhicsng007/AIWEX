import { NextRequest, NextResponse } from 'next/server'
import { createDemoRunId, demoCookieName, demoModeEnabled } from '@/features/auth/demo-session'
import { authenticatedActor } from '@/features/auth/server-auth'
import { driveCompleteShowcaseJourney } from '@/features/simulator/server/showcase-demo-journey'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

/**
 * Streams NDJSON progress while building the complete showcase demo.
 * Sets the httpOnly demo cookie so the browser can open /demo/workspace afterward.
 */
export async function POST(request: NextRequest) {
  if (!demoModeEnabled()) {
    return NextResponse.json({
      error: 'Demo mode is disabled on this deployment. Set DEMO_MODE=true and redeploy.',
    }, { status: 403 })
  }
  if (await authenticatedActor(request)) {
    return NextResponse.json({
      error: 'You are already signed in. Open your private workspace instead of a disposable demo.',
      redirect: '/app',
    }, { status: 409 })
  }

  const runId = createDemoRunId()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }
      try {
        send({ phase: 'session', message: 'Creating a disposable demo session…', percent: 2 })
        const summary = await driveCompleteShowcaseJourney(request.nextUrl.origin, runId, (update) => {
          send({ phase: update.phase, message: update.message, percent: update.percent ?? null })
        })
        send({
          done: true,
          runId: summary.runId,
          percent: 100,
          message: 'Showcase ready',
          taskCompletions: summary.taskCompletions.length,
          taskReports: summary.taskReports,
        })
      } catch {
        // Client shows a friendly state and returns home — never dump stack traces.
        send({
          error: true,
          message: 'We could not prepare the full journey showcase.',
          redirect: `/?error=${encodeURIComponent('We could not prepare the full journey showcase. Please try again, or open a simpler demo from the home page.')}`,
        })
      } finally {
        controller.close()
      }
    },
  })

  const response = new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
    },
  })

  // Cookie is set while streaming so the browser can enter the workspace on success.
  // On failure the preparing page navigates home and never opens the workspace.
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
