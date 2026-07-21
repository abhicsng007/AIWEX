import { parseAddressedAgentId, type TeamAgent } from '@/features/simulator/domain/agents'

export const teamAgents: TeamAgent[] = [
  { id: 'maya', name: 'Maya Chen', role: 'product_manager', channelIds: ['product-usage', 'releases'], goals: ['Protect customer value', 'Make scope and priority explicit'], voice: 'Clear, outcome-focused, and concise.', permittedActions: ['post_message', 'reprioritize_work', 'schedule_ceremony'] },
  { id: 'noah', name: 'Noah Patel', role: 'tech_lead', channelIds: ['product-usage', 'engineering'], goals: ['Protect technical correctness', 'Make assumptions visible'], voice: 'Specific, calm, and evidence-oriented.', permittedActions: ['post_message', 'request_review', 'approve_review', 'raise_blocker'] },
  { id: 'devon', name: 'Devon Reeves', role: 'peer_engineer', channelIds: ['engineering'], goals: ['Coordinate implementation', 'Surface integration risks'], voice: 'Pragmatic and collaborative.', permittedActions: ['post_message', 'request_review', 'raise_blocker'] },
  { id: 'adele', name: 'Adele Okafor', role: 'product_designer', channelIds: ['product-usage'], goals: ['Defend user clarity', 'Keep handoffs actionable'], voice: 'Empathetic and direct.', permittedActions: ['post_message', 'raise_blocker'] },
  { id: 'marcus', name: 'Marcus Hall', role: 'engineering_manager', channelIds: ['releases', 'engineering'], goals: ['Maintain team health', 'Keep delivery predictable'], voice: 'Supportive and accountability-focused.', permittedActions: ['post_message', 'reprioritize_work', 'schedule_ceremony'] },
]

export type SelectAgentOptions = {
  /** Restrict replies to these agents (e.g. meeting attendees). */
  allowedAgentIds?: string[]
  /** Used when nobody is @mentioned and channel heuristics do not apply. */
  fallbackAgentId?: string
}

export function selectAgent(channelId: string, message: string, options: SelectAgentOptions = {}): TeamAgent {
  const normalized = message.toLowerCase()
  const allowed = options.allowedAgentIds?.length
    ? new Set(options.allowedAgentIds)
    : null
  // Explicit attendee lists (meetings) ignore channel membership so any invitee can be tagged.
  const pool = teamAgents.filter((agent) => {
    if (allowed) return allowed.has(agent.id)
    return agent.channelIds.includes(channelId)
  })
  if (!pool.length) throw new Error(`No AI teammate is assigned to #${channelId}. Add an assigned team member before requesting a response.`)
  return pickFromPool(pool, message, normalized, channelId, options.fallbackAgentId)
}

function pickFromPool(
  pool: TeamAgent[],
  message: string,
  normalized: string,
  channelId: string,
  fallbackAgentId?: string,
): TeamAgent {
  const mentionedId = parseAddressedAgentId(message, pool)
  if (mentionedId) {
    const mentioned = pool.find((agent) => agent.id === mentionedId)
    if (mentioned) return mentioned
  }

  // Channel heuristics only when not in an explicit attendee-restricted room.
  if (!fallbackAgentId) {
    if (channelId === 'releases') return pool.find((agent) => agent.id === 'maya') || pool[0]
    if (channelId === 'engineering' && /(review|test|api|bug|guard|error)/.test(normalized)) return pool.find((agent) => agent.id === 'noah') || pool[0]
    if (channelId === 'engineering') return pool.find((agent) => agent.id === 'devon') || pool[0]
    if (/(design|empty state|copy|accessib)/.test(normalized)) return pool.find((agent) => agent.id === 'adele') || pool[0]
    return pool.find((agent) => agent.id === 'noah') || pool[0]
  }

  // Meetings / rooms with a convener: default the floor to the convener, not always Noah.
  return pool.find((agent) => agent.id === fallbackAgentId) || pool[0]
}
