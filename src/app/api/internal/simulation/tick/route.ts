import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/features/simulator/server/supabase'
import { releaseSimulationWork } from '@/features/simulator/server/simulation-director'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest) {
  const secret = process.env.SIMULATION_CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized scheduler request.' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'A persistent backend is required for the scheduler.' }, { status: 503 })
  const { data, error } = await supabase.from('simulation_runs').select('id').eq('status', 'active').limit(10_000)
  if (error) return NextResponse.json({ error: `Could not list simulation runs: ${error.message}` }, { status: 503 })
  const runIds = [...new Set((data || []).map((row) => row.id))]
  const results = await Promise.all(runIds.map(async (runId) => ({ runId, ...(await releaseSimulationWork(runId)) })))
  return NextResponse.json({ processed: results.length, released: results.reduce((total, result) => total + result.released.length, 0), missedDeadlines: results.reduce((total, result) => total + result.missedDeadlines, 0) })
}
