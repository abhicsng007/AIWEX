import { NextRequest, NextResponse } from 'next/server'
import { deriveWorkflowState } from '@/features/simulator/domain/workflow'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

type ScheduledReply = { trigger: string; agentId: string; agentName: string; role: string; channelId: string; message: string }

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string }
  if (!body.organizationId) return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  const events = await inMemoryEventStore.list(body.organizationId)
  const workflow = deriveWorkflowState(events)
  const triggers = new Set(events.filter((event) => event.type === 'agent_reply').map((event) => String(event.metadata?.trigger || '')))
  const candidate: ScheduledReply | null = !workflow.standupPosted && !triggers.has('standup-reminder')
    ? { trigger: 'standup-reminder', agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'product-usage', message: '@alex, please post your stand-up before implementation so I can keep the dependency plan accurate.' }
    : workflow.pullRequestOpened && !workflow.reviewAddressed && !triggers.has('review-reminder')
      ? { trigger: 'review-reminder', agentId: 'noah', agentName: 'Noah Patel', role: 'tech_lead', channelId: 'engineering', message: '@alex, I left the role-guard concern on PR #482. Resolve it and explain the tradeoff before we merge.' }
      : workflow.approvalGranted && !workflow.merged && !triggers.has('merge-reminder')
        ? { trigger: 'merge-reminder', agentId: 'maya', agentName: 'Maya Chen', role: 'product_manager', channelId: 'releases', message: 'The review gate is clear. Please record the merge rationale so the release train has a decision trail.' }
        : null
  if (!candidate) return NextResponse.json({ event: null })
  const event = { id: crypto.randomUUID(), organizationId: body.organizationId, type: 'agent_reply' as const, createdAt: new Date().toISOString(), metadata: candidate }
  await inMemoryEventStore.append(event)
  return NextResponse.json({ event }, { status: 201 })
}
