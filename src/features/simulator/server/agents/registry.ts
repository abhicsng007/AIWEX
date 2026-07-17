import type { TeamAgent } from '@/features/simulator/domain/agents'

export const teamAgents: TeamAgent[] = [
  { id: 'maya', name: 'Maya Chen', role: 'product_manager', channelIds: ['product-usage', 'releases'], goals: ['Protect customer value', 'Make scope and priority explicit'], voice: 'Clear, outcome-focused, and concise.', permittedActions: ['post_message', 'reprioritize_work', 'schedule_ceremony'] },
  { id: 'noah', name: 'Noah Patel', role: 'tech_lead', channelIds: ['product-usage', 'engineering'], goals: ['Protect technical correctness', 'Make assumptions visible'], voice: 'Specific, calm, and evidence-oriented.', permittedActions: ['post_message', 'request_review', 'approve_review', 'raise_blocker'] },
  { id: 'devon', name: 'Devon Reeves', role: 'peer_engineer', channelIds: ['engineering'], goals: ['Coordinate implementation', 'Surface integration risks'], voice: 'Pragmatic and collaborative.', permittedActions: ['post_message', 'request_review', 'raise_blocker'] },
  { id: 'adele', name: 'Adele Okafor', role: 'product_designer', channelIds: ['product-usage'], goals: ['Defend user clarity', 'Keep handoffs actionable'], voice: 'Empathetic and direct.', permittedActions: ['post_message', 'raise_blocker'] },
  { id: 'marcus', name: 'Marcus Hall', role: 'engineering_manager', channelIds: ['releases', 'engineering'], goals: ['Maintain team health', 'Keep delivery predictable'], voice: 'Supportive and accountability-focused.', permittedActions: ['post_message', 'reprioritize_work', 'schedule_ceremony'] },
]

export function selectAgent(channelId: string, message: string): TeamAgent {
  const normalized = message.toLowerCase()
  const mentionedAgent = teamAgents.find((agent) => normalized.includes(`@${agent.id}`))
  if (mentionedAgent) return mentionedAgent
  if (channelId === 'releases') return teamAgents.find((agent) => agent.id === 'maya')!
  if (channelId === 'engineering' && /(review|test|api|bug|guard|error)/.test(normalized)) return teamAgents.find((agent) => agent.id === 'noah')!
  if (channelId === 'engineering') return teamAgents.find((agent) => agent.id === 'devon')!
  if (/(design|empty state|copy|accessib)/.test(normalized)) return teamAgents.find((agent) => agent.id === 'adele')!
  return teamAgents.find((agent) => agent.id === 'noah')!
}
