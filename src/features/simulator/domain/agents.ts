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
  action: Extract<AgentActionType, 'post_message'>
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
}
