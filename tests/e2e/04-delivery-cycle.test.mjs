import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { bootstrapQualifiedBasic, completeDeliveryCycle } from '../helpers/flow.mjs'

describe('basic delivery cycle end-to-end', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await bootstrapQualifiedBasic(client)
  })

  it('completes PROJ-184 through merge, task report, and intermediate unlock', async (t) => {
    if (!client) return t.skip('server unavailable')

    const { complete } = await completeDeliveryCycle(client, {
      level: 'basic',
      taskId: 'PROJ-184',
    })

    assert.equal(complete.status, 201)
    assert.equal(complete.json.event.type, 'task_completed')
    assert.equal(complete.json.taskReport?.type, 'task_report_created')
    assert.ok(complete.json.taskReport?.metadata?.report || complete.json.taskReport)
    assert.equal(complete.json.unlock?.metadata?.level, 'intermediate')

    const events = await client.get('/api/simulation/events')
    assert.equal(events.status, 200)
    assert.ok(events.json.progression.completedTaskIds.includes('PROJ-184'))
    assert.ok(events.json.progression.unlockedLevels.includes('intermediate'))
    assert.ok(events.json.progression.overallScore >= 60)

    const types = events.json.events.map((event) => event.type)
    for (const required of [
      'standup_posted',
      'workspace_revision_saved',
      'checks_passed',
      'commit_created',
      'pull_request_opened',
      'review_addressed',
      'review_reply',
      'approval_granted',
      'merge_rationale_recorded',
      'pull_request_merged',
      'task_completed',
      'task_report_created',
      'level_unlocked',
    ]) {
      assert.ok(types.includes(required), `missing ${required}`)
    }

    const feedback = await client.get('/api/simulation/feedback')
    assert.equal(feedback.status, 200)
    assert.ok(feedback.json.report?.scores)
    assert.ok(Array.isArray(feedback.json.deliveryReports))
    assert.ok(feedback.json.deliveryReports.length >= 1)
  })

  it('exposes progression via dedicated endpoint', async (t) => {
    if (!client) return t.skip('server unavailable')
    const res = await client.get('/api/simulation/progression')
    assert.equal(res.status, 200)
    assert.ok(res.json.progression.unlockedLevels.includes('intermediate'))
  })
})
