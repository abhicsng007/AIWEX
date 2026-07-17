import type { SimulationEvent } from '../domain/types'

/**
 * Persistence seam for the alpha. Replace with a repository backed by the
 * application database; route handlers and agent tools depend on this shape,
 * not the database implementation.
 */
export interface SimulationEventStore {
  append(event: SimulationEvent): Promise<void>
  list(organizationId: string): Promise<SimulationEvent[]>
}

const memoryEvents: SimulationEvent[] = []

export const inMemoryEventStore: SimulationEventStore = {
  async append(event) { memoryEvents.push(event) },
  async list(organizationId) { return memoryEvents.filter((event) => event.organizationId === organizationId) },
}
