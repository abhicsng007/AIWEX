import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deriveScenarioProgression,
  scenarioLevelChangeError,
  taskCompletionError,
} from '../../src/features/simulator/domain/progression.ts'
import type { SimulationEvent } from '../../src/features/simulator/domain/types.ts'

function event(type: SimulationEvent['type'], metadata: SimulationEvent['metadata'] = {}, createdAt = new Date().toISOString()): SimulationEvent {
  return {
    id: crypto.randomUUID(),
    organizationId: 'run-test',
    type,
    createdAt,
    metadata,
  }
}

function strongDelivery(issueId: string, level: 'basic' | 'intermediate' | 'advanced', base = Date.now()): SimulationEvent[] {
  const t = (offset: number) => new Date(base + offset * 1000).toISOString()
  return [
    event('standup_posted', { issueId, level }, t(1)),
    event('chat_message', {
      channelId: 'engineering',
      message: `@noah For ${issueId}, I need validation of the canManageBilling guard and the legacy empty-state risk before merge.`,
    }, t(2)),
    event('checks_passed', { verified: true }, t(3)),
    event('commit_created', { issueId }, t(4)),
    event('pull_request_opened', { issueId }, t(5)),
    event('review_addressed', { issueId }, t(6)),
    event('review_reply', {
      response: `I validated ${issueId} with allowed and restricted roles because the billing CTA risk needs a test trail.`,
    }, t(7)),
    event('approval_granted', { issueId }, t(8)),
    event('merge_rationale_recorded', {
      rationale: `Safe to merge ${issueId} after checks, review response, and approval evidence.`,
    }, t(9)),
    event('pull_request_merged', { issueId, level }, t(10)),
  ]
}

describe('deriveScenarioProgression', () => {
  it('defaults to basic with no unlocks beyond basic', () => {
    const progression = deriveScenarioProgression([])
    assert.equal(progression.currentLevel, 'basic')
    assert.deepEqual(progression.unlockedLevels, ['basic'])
    assert.equal(progression.completedTaskIds.length, 0)
  })

  it('unlocks intermediate after a strong basic completion', () => {
    const events = [
      event('scenario_level_selected', { level: 'basic' }),
      event('delivery_cycle_started', { level: 'basic', taskId: 'PROJ-184', sequence: 1 }),
      ...strongDelivery('PROJ-184', 'basic'),
      event('task_completed', { issueId: 'PROJ-184', level: 'basic' }),
    ]
    const progression = deriveScenarioProgression(events)
    assert.ok(progression.unlockedLevels.includes('intermediate'))
    assert.ok(progression.overallScore >= 60)
    assert.ok(progression.requirements.every((item) => item.complete))
  })

  it('tracks intermediate completions and can unlock advanced', () => {
    const events = [
      event('scenario_level_selected', { level: 'basic' }),
      ...strongDelivery('PROJ-184', 'basic', Date.now()),
      event('task_completed', { issueId: 'PROJ-184', level: 'basic' }),
      event('scenario_level_selected', { level: 'intermediate' }),
      event('delivery_cycle_started', { level: 'intermediate', taskId: 'PROJ-191', sequence: 1 }),
      ...strongDelivery('PROJ-191', 'intermediate', Date.now() + 20_000),
      event('task_completed', { issueId: 'PROJ-191', level: 'intermediate' }),
      event('delivery_cycle_started', { level: 'intermediate', taskId: 'PROJ-189', sequence: 2 }),
      ...strongDelivery('PROJ-189', 'intermediate', Date.now() + 40_000),
      event('task_completed', { issueId: 'PROJ-189', level: 'intermediate' }),
    ]
    const progression = deriveScenarioProgression(events)
    assert.equal(progression.currentLevel, 'intermediate')
    assert.deepEqual(progression.completedTaskIds.sort(), ['PROJ-189', 'PROJ-191'].sort())
    assert.ok(progression.unlockedLevels.includes('advanced'))
  })
})

describe('scenarioLevelChangeError', () => {
  it('blocks moving backward to basic', () => {
    const events = [event('scenario_level_selected', { level: 'intermediate' })]
    assert.match(String(scenarioLevelChangeError(events, 'basic')), /cannot move backward/i)
  })

  it('blocks advanced before intermediate unlock', () => {
    const events = [event('scenario_level_selected', { level: 'basic' })]
    assert.match(String(scenarioLevelChangeError(events, 'advanced')), /before starting advanced/i)
  })

  it('allows re-selecting the current level when no activity has started', () => {
    const events = [event('scenario_level_selected', { level: 'basic' })]
    assert.equal(scenarioLevelChangeError(events, 'basic'), null)
  })
})

describe('taskCompletionError', () => {
  it('requires issue id and level', () => {
    assert.match(String(taskCompletionError([], {})), /issue and scenario level/i)
  })

  it('requires merge before completion', () => {
    const events = [
      event('scenario_level_selected', { level: 'basic' }),
      event('delivery_cycle_started', { level: 'basic', taskId: 'PROJ-184', sequence: 1 }),
      event('standup_posted'),
    ]
    assert.match(String(taskCompletionError(events, { issueId: 'PROJ-184', level: 'basic' })), /merge/i)
  })

  it('blocks completing a different task than the active cycle', () => {
    const events = [
      event('scenario_level_selected', { level: 'intermediate' }),
      event('delivery_cycle_started', { level: 'intermediate', taskId: 'PROJ-191', sequence: 1 }),
      ...strongDelivery('PROJ-191', 'intermediate'),
    ]
    assert.match(
      String(taskCompletionError(events, { issueId: 'PROJ-189', level: 'intermediate' })),
      /Complete PROJ-191/,
    )
  })

  it('allows completion after full merge gate', () => {
    const events = [
      event('scenario_level_selected', { level: 'basic' }),
      event('delivery_cycle_started', { level: 'basic', taskId: 'PROJ-184', sequence: 1 }),
      ...strongDelivery('PROJ-184', 'basic'),
    ]
    assert.equal(taskCompletionError(events, { issueId: 'PROJ-184', level: 'basic' }), null)
  })
})
