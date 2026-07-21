export type AgentRole = 'engineering_manager' | 'product_manager' | 'tech_lead' | 'qa_engineer' | 'product_designer' | 'peer_engineer' | 'stakeholder'

export type AgentActionType = 'post_message' | 'request_review' | 'approve_review' | 'reprioritize_work' | 'raise_blocker' | 'schedule_ceremony'

export type TeamAgent = {
  id: string
  name: string
  role: AgentRole
  channelIds: string[]
  goals: string[]
  voice: string
  permittedActions: AgentActionType[]
}

export type AgentTurn = {
  agent: Pick<TeamAgent, 'id' | 'name' | 'role'>
  action: AgentActionType
  channelId: string
  message: string
  dueAt: string
  reasoningSummary: string
}

export type OrganizationContext = {
  organizationId: string
  channelId: string
  workflow: {
    standupPosted: boolean
    checksPassed: boolean
    pullRequestOpened: boolean
    reviewAddressed: boolean
    approvalGranted: boolean
    merged: boolean
  }
  recentActions: string[]
  scenarioLevel: 'basic' | 'intermediate' | 'advanced'
  channelType?: string
  channelPurpose?: string
  recentDecisions?: string[]
  openFollowUps?: number
}

export type MentionCandidate = { id: string; name: string }

/** Resolve who a learner is addressing via @id, @First, or @Full Name. */
export function parseAddressedAgentId(message: string, candidates: MentionCandidate[]): string | null {
  if (!message.trim() || !candidates.length) return null
  const text = message.toLowerCase()
  const ranked = [...candidates].sort((left, right) => right.name.length - left.name.length || right.id.length - left.id.length)

  for (const agent of ranked) {
    const first = agent.name.split(/\s+/)[0]?.toLowerCase() || agent.id
    const needles = [
      `@${agent.id.toLowerCase()}`,
      `@${agent.name.toLowerCase()}`,
      `@${first}`,
    ]
    if (needles.some((needle) => text.includes(needle))) return agent.id
  }

  // Natural address: "Maya," / "Maya:" / "Hey Noah "
  for (const agent of ranked) {
    const first = agent.name.split(/\s+/)[0] || agent.id
    if (first.length < 3) continue
    const pattern = new RegExp(`(?:^|[\\s"'(])@?${escapeRegExp(first)}(?:\\b|[,:!?])`, 'i')
    if (pattern.test(message)) return agent.id
  }

  return null
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
