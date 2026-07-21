import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { tasksByLevel } from '../helpers/fixtures.mjs'
import {
  completeDeliveryCycle,
  completeOnboarding,
  selectLevel,
  startDemo,
} from '../helpers/flow.mjs'

/**
 * Long-form journey covering onboarding through advanced completion.
 * Enable live OpenRouter assertions with AIWEX_LIVE_AI=1.
 */
describe('full learner journey: onboarding → advanced', () => {
  /** @type {ApiClient} */
  let client
  const liveAi = process.env.AIWEX_LIVE_AI === '1' || process.env.AIWEX_LIVE_AI === 'true'
  /** @type {{ live: number, total: number }} */
  const agentStats = { live: 0, total: 0 }

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
  })

  it('executes the complete product path claimed by the README', async (t) => {
    if (!client) return t.skip('server unavailable')

    await startDemo(client, { onboarding: true })
    await completeOnboarding(client, { includeFailedReadiness: true })

    const onboarding = await client.get('/api/simulation/onboarding')
    assert.equal(onboarding.json.state.phase, 'qualified')

    // Team welcome ceremony
    await client.post('/api/simulation/team-welcome', { action: 'start' })
    await client.post('/api/simulation/team-welcome', {
      action: 'introduce',
      introduction: 'I am Alex Morgan. I want to practice validation, review communication, and safe delivery for usage alerts.',
    })

    // Basic
    assert.equal((await selectLevel(client, 'basic')).status, 201)
    for (const taskId of tasksByLevel.basic) {
      const agent = await client.post('/api/simulation/agent-turns', {
        channelId: 'engineering',
        userMessage: `@noah For ${taskId}, confirm restricted roles keep the empty-state copy when canManageBilling is false, and that legacy threshold-less workspaces stay supported.`,
      })
      assert.equal(agent.status, 201)
      agentStats.total += 1
      if (/OpenRouter responded/i.test(String(agent.json.turn?.reasoningSummary || ''))) agentStats.live += 1

      const { complete } = await completeDeliveryCycle(client, { level: 'basic', taskId })
      assert.equal(complete.status, 201)
      assert.equal(complete.json.unlock?.metadata?.level, 'intermediate')
    }

    // Intermediate
    assert.equal((await selectLevel(client, 'intermediate')).status, 201)
    for (const taskId of tasksByLevel.intermediate) {
      const { complete } = await completeDeliveryCycle(client, { level: 'intermediate', taskId })
      assert.equal(complete.status, 201, `${taskId}: ${complete.json?.error}`)
    }

    let events = await client.get('/api/simulation/events')
    assert.ok(events.json.progression.unlockedLevels.includes('advanced'))

    // Advanced
    assert.equal((await selectLevel(client, 'advanced')).status, 201)
    for (const taskId of tasksByLevel.advanced) {
      const { complete } = await completeDeliveryCycle(client, { level: 'advanced', taskId })
      assert.equal(complete.status, 201, `${taskId}: ${complete.json?.error}`)
    }

    events = await client.get('/api/simulation/events')
    const completed = events.json.events
      .filter((event) => event.type === 'task_completed')
      .map((event) => `${event.metadata.level}:${event.metadata.issueId}`)

    assert.deepEqual(completed, [
      'basic:PROJ-184',
      'intermediate:PROJ-191',
      'intermediate:PROJ-189',
      'advanced:PROJ-203',
      'advanced:PROJ-204',
      'advanced:PROJ-205',
    ])

    const required = [
      'onboarding_started',
      'policy_acknowledged',
      'access_provisioned',
      'quiz_passed',
      'readiness_task_passed',
      'manager_signoff_recorded',
      'team_welcome_concluded',
      'standup_posted',
      'checks_passed',
      'pull_request_merged',
      'task_report_created',
      'agent_reply',
    ]
    const types = new Set(events.json.events.map((event) => event.type))
    for (const type of required) assert.ok(types.has(type), `missing ledger type ${type}`)

    const feedback = await client.get('/api/simulation/feedback')
    assert.ok(feedback.json.report.scores.technicalExecution >= 70)
    assert.ok(feedback.json.deliveryReports.length >= 1)

    if (liveAi) {
      assert.ok(agentStats.live >= 1, `expected live OpenRouter turns, got ${JSON.stringify(agentStats)}`)
    }
  })
})
