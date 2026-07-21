import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assessSimulation } from '../../src/features/simulator/domain/assessment.ts'
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

describe('assessSimulation', () => {
  it('returns opportunity evidence for an empty run', () => {
    const report = assessSimulation([])
    assert.equal(report.eventCount, 0)
    assert.ok(report.scores.technicalExecution < 40)
    assert.ok(report.evidence.some((item) => item.outcome === 'opportunity'))
    assert.match(report.nextStep, /stand-up/i)
  })

  it('rewards a full delivery trail with context-rich communication', () => {
    const events = [
      event('standup_posted'),
      event('chat_message', {
        channelId: 'engineering',
        message: '@noah I need a decision on the canManageBilling guard because restricted roles must keep the empty state without a billing CTA. Can you validate the risk?',
      }),
      event('checks_passed', { verified: true }),
      event('commit_created'),
      event('pull_request_opened'),
      event('review_addressed'),
      event('review_reply', {
        response: 'I validated allowed and restricted roles because the billing CTA is a customer trust risk, and the scenario tests pass.',
      }),
      event('approval_granted'),
      event('merge_rationale_recorded', { rationale: 'Approved with validation evidence and no open blockers.' }),
      event('pull_request_merged'),
      event('agent_reply', { agentId: 'noah', message: 'Looks good.' }),
    ]
    const report = assessSimulation(events)
    assert.ok(report.scores.technicalExecution >= 80)
    assert.ok(report.scores.collaboration >= 70)
    assert.ok(report.scores.processFit >= 80)
    assert.ok(report.scores.ownershipReliability >= 70)
    assert.ok(report.evidence.some((item) => item.outcome === 'positive' && /stand-up|stand up|commitment/i.test(item.title + item.detail)))
  })

  it('improves technical score when a passing load test is recorded', () => {
    const base = [
      event('standup_posted'),
      event('checks_passed', { verified: true }),
      event('commit_created'),
      event('pull_request_opened'),
      event('approval_granted'),
      event('pull_request_merged'),
    ]
    const without = assessSimulation(base)
    const withLoad = assessSimulation([
      ...base,
      event('load_test_recorded', {
        concurrency: 100,
        p95Ms: 300,
        errorRatePercent: 0.2,
        requestsPerSecond: 90,
      }),
    ])
    assert.ok(withLoad.scores.technicalExecution > without.scores.technicalExecution)
  })
})
