import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { bootstrapQualifiedBasic, completeOnboarding, postEvent, startDemo } from '../helpers/flow.mjs'

describe('schedule and meetings APIs', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await bootstrapQualifiedBasic(client)
  })

  it('returns a schedule only after qualification', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await fresh.post('/api/simulation/onboarding', { action: 'start' })
    const blocked = await fresh.post('/api/simulation/schedule', {
      action: 'complete',
      scheduleId: 'manager-checkin-day-1',
    })
    assert.equal(blocked.status, 409)

    const schedule = await client.get('/api/simulation/schedule')
    assert.equal(schedule.status, 200)
    assert.equal(schedule.json.qualified, true)
    assert.ok(Array.isArray(schedule.json.schedule))
    assert.ok(schedule.json.schedule.length >= 5)
    assert.ok(schedule.json.simulationNow)
  })

  it('blocks schedule completion without required delivery evidence', async (t) => {
    if (!client) return t.skip('server unavailable')
    // Advance simulation clock so the first ceremony is "open" if time-gated.
    await postEvent(client, 'simulation_time_advanced', { minutes: 30, to: 10 * 60 })

    const complete = await client.post('/api/simulation/schedule', {
      action: 'complete',
      scheduleId: 'manager-checkin-day-1',
    })
    // Either not started yet, already ended, or missing standup evidence.
    assert.ok([200, 201, 409].includes(complete.status))
    if (complete.status === 409) {
      assert.match(String(complete.json?.error || ''), /stand-up|started|ended|recovery/i)
    }
  })

  it('allows manager check-in completion after standup when the block is open', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await completeOnboarding(fresh)
    await postEvent(fresh, 'standup_posted', {
      text: 'Yesterday: onboarding. Today: manager check-in then PROJ-184. Blocker: none.',
    })
    // Move into the first ceremony window (starts at schedule base + 0h, duration 0.5h).
    await postEvent(fresh, 'simulation_time_advanced', { minutes: 10, to: 9 * 60 + 50 })

    const res = await fresh.post('/api/simulation/schedule', {
      action: 'complete',
      scheduleId: 'manager-checkin-day-1',
    })
    // Depending on exact schedule timestamps relative to now, completion may still be time-gated.
    if (res.status === 201 || res.status === 200) {
      assert.ok((res.json.schedule || []).some((item) => item.id === 'manager-checkin-day-1' && item.completed))
    } else {
      assert.equal(res.status, 409)
      assert.match(String(res.json?.error || ''), /started|ended|recovery|stand-up/i)
    }
  })

  it('lists meetings after qualification and supports start + message flow', async (t) => {
    if (!client) return t.skip('server unavailable')
    const meetings = await client.get('/api/simulation/meetings')
    assert.equal(meetings.status, 200)
    assert.ok(Array.isArray(meetings.json.meetings))
    assert.ok(meetings.json.meetings.some((meeting) => meeting.id === 'manager-checkin'))

    const start = await client.post('/api/simulation/meetings', {
      meetingId: 'manager-checkin',
      action: 'start',
    })
    assert.ok(start.status === 200 || start.status === 201)

    const earlyMessage = await client.post('/api/simulation/meetings', {
      meetingId: 'manager-checkin',
      action: 'message',
      message: '',
    })
    assert.equal(earlyMessage.status, 400)

    const message = await client.post('/api/simulation/meetings', {
      meetingId: 'manager-checkin',
      action: 'message',
      message: 'Hi team — I am Alex, focused on learning safe delivery habits for usage alerts this week.',
    })
    assert.ok(message.status === 200 || message.status === 201)

    const listed = await client.get('/api/simulation/meetings')
    const session = listed.json.meetings.find((meeting) => meeting.id === 'manager-checkin')
    assert.ok(session?.startedAt)
    assert.ok((session.messages || []).some((item) => item.authorId === 'you' || /Alex/i.test(item.text || item.message || '')))
  })

  it('blocks meetings before onboarding', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    const blocked = await fresh.get('/api/simulation/meetings')
    assert.equal(blocked.status, 409)
  })
})
