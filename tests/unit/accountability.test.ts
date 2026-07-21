import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { followUpCompletionError } from '../../src/features/simulator/domain/accountability.ts'
import type { SimulationEvent } from '../../src/features/simulator/domain/types.ts'

function event(type: SimulationEvent['type'], metadata: SimulationEvent['metadata'] = {}): SimulationEvent {
  return {
    id: crypto.randomUUID(),
    organizationId: 'run-test',
    type,
    createdAt: new Date().toISOString(),
    metadata,
  }
}

describe('followUpCompletionError', () => {
  it('returns not found for unknown follow-ups', () => {
    assert.match(String(followUpCompletionError([], 'missing')), /not found/i)
  })

  it('enforces standup requirement', () => {
    const events = [
      event('followup_created', {
        followUpId: 'followup-standup',
        requirement: 'standup',
        followUp: { id: 'followup-standup' },
      }),
    ]
    assert.match(String(followUpCompletionError(events, 'followup-standup')), /stand-up/i)
    events.push(event('standup_posted'))
    assert.equal(followUpCompletionError(events, 'followup-standup'), null)
  })

  it('enforces merge requirement', () => {
    const events = [
      event('followup_created', {
        followUpId: 'followup-merge',
        requirement: 'merge',
      }),
      event('standup_posted'),
      event('checks_passed', { verified: true }),
      event('commit_created'),
      event('pull_request_opened'),
      event('review_addressed'),
      event('review_reply'),
      event('approval_granted'),
      event('merge_rationale_recorded', { rationale: 'enough characters for rationale gate' }),
    ]
    assert.match(String(followUpCompletionError(events, 'followup-merge')), /merge/i)
    events.push(event('pull_request_merged'))
    assert.equal(followUpCompletionError(events, 'followup-merge'), null)
  })

  it('enforces recovery_plan requirement in releases channel', () => {
    const events = [
      event('followup_created', {
        followUpId: 'followup-recovery',
        requirement: 'recovery_plan',
      }),
    ]
    assert.match(String(followUpCompletionError(events, 'followup-recovery')), /recovery plan/i)
    events.push(event('chat_message', {
      channelId: 'releases',
      message: 'Recovery plan: impact is delayed release note; risk is support confusion; revised plan ships tomorrow.',
    }))
    assert.equal(followUpCompletionError(events, 'followup-recovery'), null)
  })
})
