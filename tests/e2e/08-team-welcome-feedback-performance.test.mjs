import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { loadTestFailing, loadTestPassing } from '../helpers/fixtures.mjs'
import { bootstrapQualifiedBasic, completeOnboarding, startDemo } from '../helpers/flow.mjs'

describe('team welcome, feedback, and performance evidence', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await bootstrapQualifiedBasic(client)
  })

  it('runs the team welcome ceremony with introduction length rules', async (t) => {
    if (!client) return t.skip('server unavailable')
    const start = await client.post('/api/simulation/team-welcome', { action: 'start' })
    assert.ok(start.status === 200 || start.status === 201)

    const state = await client.get('/api/simulation/team-welcome')
    assert.equal(state.json.state.started, true)

    const shortIntro = await client.post('/api/simulation/team-welcome', {
      action: 'introduce',
      introduction: 'Hi everyone',
    })
    assert.equal(shortIntro.status, 400)
    assert.match(String(shortIntro.json?.error || ''), /45 characters/i)

    const intro = await client.post('/api/simulation/team-welcome', {
      action: 'introduce',
      introduction: 'Hi team — I am Alex. I want to learn clear validation and review habits while shipping the usage-alerts empty state safely.',
    })
    assert.ok(intro.status === 200 || intro.status === 201)

    const after = await client.get('/api/simulation/team-welcome')
    assert.equal(after.json.state.introduced, true)
    assert.equal(after.json.state.concluded, true)
  })

  it('blocks team welcome before qualification', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    const blocked = await fresh.post('/api/simulation/team-welcome', { action: 'start' })
    assert.equal(blocked.status, 409)
  })

  it('returns feedback assessment structure for a fresh qualified run', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await completeOnboarding(fresh)
    const feedback = await fresh.get('/api/simulation/feedback')
    assert.equal(feedback.status, 200)
    assert.ok(feedback.json.report)
    assert.ok(feedback.json.report.scores)
    assert.ok(['technicalExecution', 'collaboration', 'ownershipReliability', 'processFit'].every(
      (key) => typeof feedback.json.report.scores[key] === 'number',
    ))
    assert.ok(Array.isArray(feedback.json.report.evidence))
    assert.ok(Array.isArray(feedback.json.deliveryReports))
  })

  it('records valid load-test results and rejects invalid payloads', async (t) => {
    if (!client) return t.skip('server unavailable')
    const get = await client.get('/api/simulation/performance')
    assert.equal(get.status, 200)
    assert.equal(get.json.scenario?.id, 'usage-dashboard-latency')

    const invalid = await client.post('/api/simulation/performance', {
      result: { scenarioId: 'unknown', environment: 'production' },
    })
    assert.equal(invalid.status, 400)

    const failing = await client.post('/api/simulation/performance', { result: loadTestFailing })
    assert.equal(failing.status, 201)
    assert.equal(failing.json.targetMet, false)
    assert.equal(failing.json.event.type, 'load_test_recorded')

    const passing = await client.post('/api/simulation/performance', { result: loadTestPassing })
    assert.equal(passing.status, 201)
    assert.equal(passing.json.targetMet, true)

    const listed = await client.get('/api/simulation/performance')
    assert.ok(listed.json.results.length >= 2)
    assert.ok(listed.json.latest)
  })
})
