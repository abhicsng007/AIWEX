import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activeDeliveryCycle,
  deriveWorkflowState,
  initialWorkflowState,
  validateWorkflowTransition,
} from '../../src/features/simulator/domain/workflow.ts'
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

describe('deriveWorkflowState', () => {
  it('starts with all gates closed', () => {
    assert.deepEqual(deriveWorkflowState([]), initialWorkflowState)
  })

  it('marks standup, checks, commit, and PR as they land', () => {
    const events = [
      event('standup_posted'),
      event('checks_passed', { verified: true }),
      event('commit_created'),
      event('pull_request_opened'),
    ]
    const state = deriveWorkflowState(events)
    assert.equal(state.standupPosted, true)
    assert.equal(state.checksPassed, true)
    assert.equal(state.committed, true)
    assert.equal(state.pullRequestOpened, true)
    assert.equal(state.merged, false)
  })

  it('resets delivery state after a new delivery_cycle_started', () => {
    const events = [
      event('standup_posted'),
      event('checks_passed', { verified: true }),
      event('commit_created'),
      event('pull_request_opened'),
      event('review_addressed'),
      event('review_reply'),
      event('approval_granted'),
      event('merge_rationale_recorded', { rationale: 'enough characters for rationale' }),
      event('pull_request_merged'),
      event('delivery_cycle_started', { level: 'intermediate', taskId: 'PROJ-191', sequence: 1 }),
    ]
    const state = deriveWorkflowState(events)
    assert.deepEqual(state, initialWorkflowState)
  })

  it('resets after scenario_level_selected for a later level', () => {
    const events = [
      event('scenario_level_selected', { level: 'basic' }),
      event('standup_posted'),
      event('checks_passed', { verified: true }),
      event('commit_created'),
      event('pull_request_opened'),
      event('review_addressed'),
      event('review_reply'),
      event('approval_granted'),
      event('merge_rationale_recorded', { rationale: 'enough characters for rationale' }),
      event('pull_request_merged'),
      event('task_completed', { issueId: 'PROJ-184', level: 'basic' }),
      event('scenario_level_selected', { level: 'intermediate' }),
    ]
    assert.deepEqual(deriveWorkflowState(events), initialWorkflowState)
  })
})

describe('activeDeliveryCycle', () => {
  it('returns null when no cycle event exists', () => {
    assert.equal(activeDeliveryCycle([]), null)
  })

  it('returns the latest cycle metadata', () => {
    const events = [
      event('delivery_cycle_started', { level: 'basic', taskId: 'PROJ-184', sequence: 1 }),
      event('delivery_cycle_started', { level: 'intermediate', taskId: 'PROJ-191', sequence: 1 }),
    ]
    const cycle = activeDeliveryCycle(events)
    assert.equal(cycle?.level, 'intermediate')
    assert.equal(cycle?.taskId, 'PROJ-191')
    assert.equal(cycle?.sequence, 1)
  })
})

describe('validateWorkflowTransition', () => {
  it('blocks PR before standup and commit', () => {
    const error = validateWorkflowTransition(initialWorkflowState, 'pull_request_opened')
    assert.match(String(error), /stand-up and commit/i)
  })

  it('blocks commit before checks', () => {
    const state = { ...initialWorkflowState, standupPosted: true }
    assert.match(String(validateWorkflowTransition(state, 'commit_created')), /checks/i)
  })

  it('blocks approval before review response', () => {
    const state = {
      ...initialWorkflowState,
      standupPosted: true,
      checksPassed: true,
      committed: true,
      pullRequestOpened: true,
      reviewAddressed: true,
    }
    assert.match(String(validateWorkflowTransition(state, 'approval_granted')), /respond/i)
  })

  it('blocks short merge rationale', () => {
    const state = {
      ...initialWorkflowState,
      standupPosted: true,
      checksPassed: true,
      committed: true,
      pullRequestOpened: true,
      reviewAddressed: true,
      reviewReplied: true,
      approvalGranted: true,
    }
    assert.match(String(validateWorkflowTransition(state, 'merge_rationale_recorded', { rationale: 'ok' })), /rationale/i)
  })

  it('allows a clear rationale after approval', () => {
    const state = {
      ...initialWorkflowState,
      standupPosted: true,
      checksPassed: true,
      committed: true,
      pullRequestOpened: true,
      reviewAddressed: true,
      reviewReplied: true,
      approvalGranted: true,
    }
    assert.equal(
      validateWorkflowTransition(state, 'merge_rationale_recorded', {
        rationale: 'Safe to merge after checks, review response, and approval.',
      }),
      null,
    )
  })

  it('blocks merge without rationale', () => {
    const state = {
      ...initialWorkflowState,
      standupPosted: true,
      checksPassed: true,
      committed: true,
      pullRequestOpened: true,
      reviewAddressed: true,
      reviewReplied: true,
      approvalGranted: true,
    }
    assert.match(String(validateWorkflowTransition(state, 'pull_request_merged')), /rationale/i)
  })

  it('blocks duplicate standup in the same cycle', () => {
    const state = { ...initialWorkflowState, standupPosted: true }
    assert.match(String(validateWorkflowTransition(state, 'standup_posted')), /already posted/i)
  })

  it('blocks most writes after merge except allowed collaboration events', () => {
    const state = { ...initialWorkflowState, merged: true }
    assert.match(String(validateWorkflowTransition(state, 'commit_created')), /already merged/i)
    assert.equal(validateWorkflowTransition(state, 'chat_message'), null)
    assert.equal(validateWorkflowTransition(state, 'task_completed'), null)
  })
})
