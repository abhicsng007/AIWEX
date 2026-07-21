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

  it('GET /demo?complete=1 builds a full Basic→Advanced showcase via real APIs', async (t) => {
    if (!client) return t.skip('server unavailable')
    const demo = new ApiClient()
    // Full journey runs real validate + report endpoints; allow a long timeout.
    const started = await demo.get('/demo?complete=1')
    assert.ok(demo.demoRunId, 'complete demo cookie')
    assert.match(demo.demoRunId, /^demo-[0-9a-f-]{36}$/i)
    assert.ok([200, 302, 303, 307].includes(started.status) || Boolean(demo.demoRunId))

    const onboarding = await demo.get('/api/simulation/onboarding')
    assert.equal(onboarding.status, 200)
    assert.equal(onboarding.json?.state?.phase, 'qualified')

    const events = await demo.get('/api/simulation/events')
    assert.equal(events.status, 200)
    const ledger = events.json?.events || []
    const completions = ledger
      .filter((event) => event.type === 'task_completed')
      .map((event) => `${event.metadata?.level}:${event.metadata?.issueId}`)
    assert.deepEqual(completions, [
      'basic:PROJ-184',
      'intermediate:PROJ-191',
      'intermediate:PROJ-189',
      'advanced:PROJ-203',
      'advanced:PROJ-204',
      'advanced:PROJ-205',
    ])
    assert.ok(ledger.some((event) => event.type === 'task_report_created'))
    assert.ok(ledger.some((event) => event.type === 'project_report_created'))
    assert.ok(ledger.some((event) => event.type === 'checks_passed'))
    assert.ok(ledger.some((event) => event.type === 'agent_reply'))
    assert.ok(ledger.some((event) => event.type === 'schedule_event_completed'))
    assert.ok(ledger.some((event) => event.type === 'meeting_ended'))
    assert.ok(ledger.some((event) => event.type === 'issue_updated' && event.metadata?.status === 'done'))
    assert.ok(ledger.some((event) => event.type === 'scenario_deployment_recorded'))
    assert.ok(ledger.filter((event) => event.type === 'pull_request_merged').length >= 6)

    const schedule = await demo.get('/api/simulation/schedule')
    assert.equal(schedule.status, 200)
    const openBlocks = (schedule.json?.schedule || []).filter((item) => !item.completed)
    assert.equal(openBlocks.length, 0, `calendar still open: ${openBlocks.map((item) => item.id).join(', ')}`)

    const meetings = await demo.get('/api/simulation/meetings')
    assert.equal(meetings.status, 200)
    const openMeetings = (meetings.json?.meetings || []).filter((meeting) => meeting.startedAt && !meeting.endedAt)
    assert.equal(openMeetings.length, 0)
    assert.ok((meetings.json?.meetings || []).every((meeting) => meeting.endedAt))

    const feedback = await demo.get('/api/simulation/feedback')
    assert.equal(feedback.status, 200)
    assert.ok(feedback.json?.report?.scores?.technicalExecution >= 70)
    assert.ok((feedback.json?.deliveryReports || []).length >= 1)
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
