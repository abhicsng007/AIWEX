import type { SimulationEvent } from '../domain/types'
import { getSupabaseAdmin } from './supabase'

/**
 * Persistence seam for the alpha. Replace with a repository backed by the
 * application database; route handlers and agent tools depend on this shape,
 * not the database implementation.
 */
export interface SimulationEventStore {
  append(event: SimulationEvent): Promise<void>
  list(organizationId: string): Promise<SimulationEvent[]>
  subscribe(listener: (event: SimulationEvent) => void): () => void
}

type SharedEventBus = { events: SimulationEvent[]; listeners: Set<(event: SimulationEvent) => void> }
const globalBus = globalThis as typeof globalThis & { __shiftlineEventBus?: SharedEventBus }
const sharedBus = globalBus.__shiftlineEventBus ||= { events: [], listeners: new Set<(event: SimulationEvent) => void>() }

export const inMemoryEventStore: SimulationEventStore = {
  async append(event) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from('simulation_events').insert({ id: event.id, organization_id: event.organizationId, type: event.type, created_at: event.createdAt, metadata: event.metadata || {} })
      if (error) throw new Error(`Could not persist simulation event: ${error.message}`)
    }
    sharedBus.events.push(event); sharedBus.listeners.forEach((listener) => listener(event))
  },
  async list(organizationId) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { data, error } = await supabase.from('simulation_events').select('id, organization_id, type, created_at, metadata').eq('organization_id', organizationId).order('created_at', { ascending: true })
      if (error) throw new Error(`Could not load simulation events: ${error.message}`)
      return (data || []).map((event) => ({ id: event.id, organizationId: event.organization_id, type: event.type as SimulationEvent['type'], createdAt: event.created_at, metadata: event.metadata as SimulationEvent['metadata'] }))
    }
    return sharedBus.events.filter((event) => event.organizationId === organizationId)
  },
  subscribe(listener) { sharedBus.listeners.add(listener); return () => sharedBus.listeners.delete(listener) },
}
