import type { SimulationEvent } from '../domain/types'

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
  async append(event) { sharedBus.events.push(event); sharedBus.listeners.forEach((listener) => listener(event)) },
  async list(organizationId) { return sharedBus.events.filter((event) => event.organizationId === organizationId) },
  subscribe(listener) { sharedBus.listeners.add(listener); return () => sharedBus.listeners.delete(listener) },
}
