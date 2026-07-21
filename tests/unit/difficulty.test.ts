import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  issuesForScenarioLevel,
  scenarioLevelFromEvents,
  scenarioPolicies,
  taskIdsForScenarioLevel,
} from '../../src/features/simulator/domain/difficulty.ts'

describe('taskIdsForScenarioLevel', () => {
  it('keeps non-overlapping task queues per level', () => {
    const all = [
      ...taskIdsForScenarioLevel.basic,
      ...taskIdsForScenarioLevel.intermediate,
      ...taskIdsForScenarioLevel.advanced,
    ]
    assert.equal(new Set(all).size, all.length)
    assert.deepEqual([...taskIdsForScenarioLevel.basic], ['PROJ-184'])
    assert.deepEqual([...taskIdsForScenarioLevel.intermediate], ['PROJ-191', 'PROJ-189'])
    assert.deepEqual([...taskIdsForScenarioLevel.advanced], ['PROJ-203', 'PROJ-204', 'PROJ-205'])
  })
})

describe('scenarioLevelFromEvents', () => {
  it('defaults to basic and respects the latest selection', () => {
    assert.equal(scenarioLevelFromEvents([]), 'basic')
    assert.equal(scenarioLevelFromEvents([
      { type: 'scenario_level_selected', metadata: { level: 'intermediate' } },
    ]), 'intermediate')
    assert.equal(scenarioLevelFromEvents([
      { type: 'scenario_level_selected', metadata: { level: 'intermediate' } },
      { type: 'scenario_level_selected', metadata: { level: 'advanced' } },
    ]), 'advanced')
  })
})

describe('issuesForScenarioLevel', () => {
  it('assigns intermediate issues to alex', () => {
    const issues = issuesForScenarioLevel('intermediate')
    const assigned = issues.filter((issue) => taskIdsForScenarioLevel.intermediate.includes(issue.id))
    assert.equal(assigned.length, 2)
    assert.ok(assigned.every((issue) => issue.assignee === 'alex'))
  })

  it('introduces advanced-only issues', () => {
    const basicIds = new Set(issuesForScenarioLevel('basic').map((issue) => issue.id))
    const advanced = issuesForScenarioLevel('advanced')
    for (const id of taskIdsForScenarioLevel.advanced) {
      assert.ok(advanced.some((issue) => issue.id === id), `missing ${id}`)
      assert.equal(basicIds.has(id), false)
    }
  })
})

describe('scenarioPolicies', () => {
  it('escalates active task targets and deadline pressure by level', () => {
    assert.equal(scenarioPolicies.basic.activeTaskTarget, 1)
    assert.equal(scenarioPolicies.intermediate.activeTaskTarget, 2)
    assert.equal(scenarioPolicies.advanced.activeTaskTarget, 3)
    assert.ok(scenarioPolicies.advanced.enabledChallenges.length >= scenarioPolicies.basic.enabledChallenges.length)
  })
})
