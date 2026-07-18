import { NextRequest, NextResponse } from 'next/server'
import { simulationRunIdentity } from '@/features/auth/server-auth'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import { getSupabaseAdmin } from '@/features/simulator/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Sign in to access your private simulation run.' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { error } = await supabase.from('simulation_runs').upsert({ id: identity.runId, owner_user_id: identity.actor.id, scenario_key: 'signaldesk-usage-alerts', status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) return NextResponse.json({ error: `Your simulation run could not be initialized: ${error.message}`, action: 'Run supabase/migrations/202607180002_private_simulation_runs.sql.' }, { status: 503 })
  }
  const events = await inMemoryEventStore.list(identity.runId)
  return NextResponse.json({
    run: {
      id: identity.runId,
      owner: { id: identity.actor.id, email: identity.actor.email },
      created: events.length > 0,
      eventCount: events.length,
    },
  })
}
