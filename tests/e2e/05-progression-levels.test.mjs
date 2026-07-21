import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { tasksByLevel } from '../helpers/fixtures.mjs'
import {
  bootstrapQualifiedBasic,
  completeDeliveryCycle,
  selectLevel,
} from '../helpers/flow.mjs'

describe('scenario level progression', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await bootstrapQualifiedBasic(client)
  })

  it('blocks advanced before intermediate is unlocked', async (t) => {
    if (!client) return t.skip('server unavailable')
    const early = await selectLevel(client, 'advanced')
    assert.equal(early.status, 409)
    assert.match(String(early.json?.error || ''), /before starting advanced|requirements/i)
  })

  it('walks basic → intermediate → advanced with all assigned tasks', async (t) => {
    if (!client) return t.skip('server unavailable')

    for (const taskId of tasksByLevel.basic) {
      const { complete } = await completeDeliveryCycle(client, { level: 'basic', taskId })
      assert.equal(complete.status, 201, complete.json?.error)
    }

    let snapshot = await client.get('/api/simulation/events')
    assert.ok(snapshot.json.progression.unlockedLevels.includes('intermediate'))

    const intermediateSelect = await selectLevel(client, 'intermediate')
    assert.equal(intermediateSelect.status, 201)
    assert.equal(intermediateSelect.json.cycle?.metadata?.taskId, 'PROJ-191')

    for (const taskId of tasksByLevel.intermediate) {
      const { complete } = await completeDeliveryCycle(client, { level: 'intermediate', taskId })
      assert.equal(complete.status, 201, `${taskId}: ${complete.json?.error}`)
    }

    snapshot = await client.get('/api/simulation/events')
    assert.ok(snapshot.json.progression.unlockedLevels.includes('advanced'))
    assert.deepEqual(
      [...snapshot.json.progression.completedTaskIds].sort(),
      [...tasksByLevel.intermediate].sort(),
    )

    // Cannot go backward
    const back = await selectLevel(client, 'basic')
    assert.equal(back.status, 409)

    const advancedSelect = await selectLevel(client, 'advanced')
    assert.equal(advancedSelect.status, 201)
    assert.equal(advancedSelect.json.cycle?.metadata?.taskId, 'PROJ-203')

    for (const taskId of tasksByLevel.advanced) {
      const { complete } = await completeDeliveryCycle(client, { level: 'advanced', taskId })
      assert.equal(complete.status, 201, `${taskId}: ${complete.json?.error}`)
    }

    snapshot = await client.get('/api/simulation/events')
    const completedAdvanced = snapshot.json.events
      .filter((event) => event.type === 'task_completed' && event.metadata?.level === 'advanced')
      .map((event) => event.metadata.issueId)
    assert.deepEqual([...completedAdvanced].sort(), [...tasksByLevel.advanced].sort())

    const allCompleted = snapshot.json.events
      .filter((event) => event.type === 'task_completed')
      .map((event) => `${event.metadata.level}:${event.metadata.issueId}`)
    assert.equal(allCompleted.length, 6)
    assert.ok(snapshot.json.progression.overallScore >= 70)
  })
})
