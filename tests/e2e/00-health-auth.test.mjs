import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'

describe('health and demo auth', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
  })

  it('GET /api/health returns ok', async (t) => {
    if (!client) return t.skip('server unavailable')
    const res = await client.get('/api/health')
    assert.equal(res.status, 200)
    assert.equal(res.json?.status, 'ok')
    assert.ok(res.json?.timestamp)
  })

  it('simulation routes require a demo or auth session', async (t) => {
    if (!client) return t.skip('server unavailable')
    const anon = new ApiClient()
    const res = await anon.get('/api/simulation/events')
    assert.equal(res.status, 401)
    assert.match(String(res.json?.error || ''), /sign in/i)
  })

  it('GET /demo?onboarding=1 issues an isolated demo cookie', async (t) => {
    if (!client) return t.skip('server unavailable')
    const a = new ApiClient()
    const b = new ApiClient()
    const first = await a.get('/demo?onboarding=1')
    const second = await b.get('/demo?onboarding=1')
    assert.ok([302, 307, 303].includes(first.status) || first.status === 200 || Boolean(a.demoRunId))
    assert.ok(a.demoRunId, 'first demo run cookie')
    assert.ok(b.demoRunId, 'second demo run cookie')
    assert.notEqual(a.demoRunId, b.demoRunId)
    assert.match(a.demoRunId, /^demo-[0-9a-f-]{36}$/i)
  })

  it('GET /demo seeds a pre-qualified run without onboarding=1', async (t) => {
    if (!client) return t.skip('server unavailable')
    const demo = new ApiClient()
    await demo.get('/demo')
    assert.ok(demo.demoRunId)
    const onboarding = await demo.get('/api/simulation/onboarding')
    assert.equal(onboarding.status, 200)
    assert.equal(onboarding.json?.state?.phase, 'qualified')
  })

  it('rejects cross-tenant organizationId mismatches', async (t) => {
    if (!client) return t.skip('server unavailable')
    const demo = new ApiClient()
    await demo.get('/demo?onboarding=1')
    const res = await demo.post('/api/simulation/events', {
      organizationId: 'run-someone-else',
      type: 'standup_posted',
      metadata: { text: 'should not work' },
    })
    assert.equal(res.status, 401)
  })
})
